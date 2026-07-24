// BUG 2 — Visualização do PDF: navegadores/extensões/DNS corporativos
// bloqueiam abertura direta de URLs assinadas do domínio *.supabase.co
// (ERR_BLOCKED_BY_CLIENT). Esta rota faz stream do PDF a partir do
// mesmo domínio da aplicação (trailbook.com.br), mantendo exatamente o
// mesmo controle de autorização usado por `getReceiptSignedUrl`.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function makeAuthedClient(token: string) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const isNewKey = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(
          typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
        );
        if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
        if (isNewKey && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const Route = createFileRoute("/api/receipts/$code/pdf")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const code = String(params.code || "").toUpperCase();
        if (!code) return new Response("Missing code", { status: 400 });

        // Autorização: mesmo modelo do getReceiptSignedUrl — token do usuário
        // vem via Authorization (fetch autenticado) OU via cookie de sessão.
        const authHeader = request.headers.get("authorization");
        let token: string | null = null;
        if (authHeader?.startsWith("Bearer ")) token = authHeader.slice(7);
        if (!token) {
          // Tenta extrair do cookie sb-<ref>-auth-token (JSON com access_token).
          const cookie = request.headers.get("cookie") ?? "";
          const match = cookie.match(/sb-[^=]+-auth-token(?:\.\d+)?=([^;]+)/);
          if (match) {
            try {
              const raw = decodeURIComponent(match[1]);
              const parsed = JSON.parse(raw.startsWith("base64-") ? atob(raw.slice(7)) : raw);
              token = parsed?.access_token ?? null;
            } catch { /* ignore */ }
          }
        }
        if (!token) return new Response("Unauthorized", { status: 401 });

        const url = new URL(request.url);
        const variant = url.searchParams.get("variant") === "original" ? "original" : "signed";
        const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";

        const supabase = makeAuthedClient(token);

        // RPC valida se o solicitante é vendedor/comprador/admin.
        const { data: path, error } = await supabase.rpc(
          "get_receipt_pdf_path" as never,
          { _code: code, _prefer_signed: variant === "signed" } as never,
        );
        if (error) return new Response(error.message, { status: 403 });
        if (!path) return new Response("PDF indisponível", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: blob, error: dErr } = await supabaseAdmin.storage
          .from("smart-receipts")
          .download(String(path));
        if (dErr || !blob) return new Response("Falha ao carregar PDF", { status: 502 });

        const bytes = new Uint8Array(await blob.arrayBuffer());
        const filename = `${code}${variant === "signed" ? "-assinado" : ""}.pdf`;
        return new Response(bytes, {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-length": String(bytes.byteLength),
            "content-disposition": `${disposition}; filename="${filename}"`,
            "cache-control": "private, no-store",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});