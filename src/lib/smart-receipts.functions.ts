import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Fetch pública (sem auth) do recibo pelo código — usado pela página /r/$code. */
export const validateReceiptPublic = createServerFn({ method: "GET" })
  .inputValidator((data: { code: string }) => {
    if (!data?.code || typeof data.code !== "string") throw new Error("Código inválido");
    return { code: data.code.trim().toUpperCase() };
  })
  .handler(async ({ data }) => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: rows, error } = await supabase.rpc("get_public_receipt" as never, { _code: data.code } as never);
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return { found: false as const };
    return { found: true as const, receipt: row };
  });

/** URL assinada de 60s para download do PDF — somente vendedor/comprador/admin. */
export const getReceiptSignedUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => ({ code: String(data.code).toUpperCase() }))
  .handler(async ({ data, context }) => {
    const { data: path, error } = await context.supabase.rpc("get_receipt_pdf_path" as never, { _code: data.code } as never);
    if (error) throw new Error(error.message);
    if (!path) return { url: null as string | null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("smart-receipts").createSignedUrl(String(path), 60);
    if (sErr) throw new Error(sErr.message);
    return { url: signed?.signedUrl ?? null };
  });

export interface GenerateInput {
  motorcycle_id: string;
  buyer: { user_id?: string | null; full_name: string; cpf?: string | null; email?: string | null };
  negotiation: {
    amount: number;
    payment_method: string;
    date: string;
    location?: string | null;
    notes?: string | null;
  };
  lgpd_consent: boolean;
  previous_receipt_id?: string | null;
}

/** Emite um novo Recibo Inteligente (PDF + hash + upload) para uma moto do vendedor. */
export const generateSmartReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: GenerateInput) => {
    if (!data?.motorcycle_id) throw new Error("motorcycle_id obrigatório");
    if (!data?.buyer?.full_name) throw new Error("Nome do comprador obrigatório");
    if (!data?.negotiation?.amount || data.negotiation.amount <= 0) throw new Error("Valor da negociação inválido");
    if (!data?.negotiation?.payment_method) throw new Error("Forma de pagamento obrigatória");
    if (!data?.negotiation?.date) throw new Error("Data da negociação obrigatória");
    if (!data?.lgpd_consent) throw new Error("É necessário aceitar o consentimento LGPD");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Fetch moto (RLS garante que é do vendedor)
    const { data: moto, error: mErr } = await supabase
      .from("motorcycles")
      .select("id, brand, model, year_model, chassis, plate, hours_total, km_total, owner_id")
      .eq("id", data.motorcycle_id).single();
    if (mErr || !moto) throw new Error("Motocicleta não encontrada ou sem permissão");
    if (moto.owner_id !== userId) throw new Error("Apenas o proprietário atual pode emitir o recibo");

    // Vendedor (perfil do usuário logado)
    const { data: sellerProfile } = await supabase
      .from("profiles").select("full_name, cpf, email").eq("id", userId).single();
    if (!sellerProfile?.full_name) throw new Error("Complete seu perfil (nome) antes de emitir o recibo");

    // Descobre próximo número/versão
    const { data: lastByYear } = await supabase
      .from("smart_receipts")
      .select("code")
      .like("code", `TB-RCV-${new Date().getFullYear()}-%`)
      .order("code", { ascending: false })
      .limit(1).maybeSingle();

    let version = 1;
    let previousId: string | null = data.previous_receipt_id ?? null;
    if (previousId) {
      const { data: prev } = await supabase
        .from("smart_receipts").select("version").eq("id", previousId).maybeSingle();
      if (prev?.version) version = prev.version + 1;
    }

    const { buildReceiptPdf, nextReceiptCode } = await import("./smart-receipts.server");
    const code = nextReceiptCode(lastByYear?.code ?? null);
    const issuedAt = new Date().toISOString();

    const originHeader = getRequestHeader("origin") || getRequestHeader("host") || "trailbook.com.br";
    const origin = originHeader.startsWith("http") ? originHeader : `https://${originHeader}`;

    const { pdfBytes, sha256 } = await buildReceiptPdf({
      code, version, issuedAt,
      motorcycle: {
        brand: moto.brand, model: moto.model, year_model: moto.year_model,
        chassis: moto.chassis, plate: moto.plate,
        hours_total: moto.hours_total as unknown as number,
        km_total: moto.km_total as unknown as number,
      },
      seller: { full_name: sellerProfile.full_name, cpf: sellerProfile.cpf, email: sellerProfile.email },
      buyer: { full_name: data.buyer.full_name, cpf: data.buyer.cpf ?? null, email: data.buyer.email ?? null },
      negotiation: data.negotiation,
    }, origin);

    const pdfPath = `motorcycles/${moto.id}/${code}-v${version}.pdf`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.storage
      .from("smart-receipts")
      .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: false });
    if (upErr) throw new Error(`Falha no upload do PDF: ${upErr.message}`);

    const { data: inserted, error: iErr } = await supabase
      .from("smart_receipts")
      .insert({
        motorcycle_id: moto.id,
        code,
        sha256,
        pdf_path: pdfPath,
        seller_id: userId,
        buyer_id: data.buyer.user_id ?? null,
        seller_snapshot: sellerProfile,
        buyer_snapshot: {
          full_name: data.buyer.full_name,
          cpf: data.buyer.cpf ?? null,
          email: data.buyer.email ?? null,
        },
        motorcycle_snapshot: moto,
        negotiation: {
          amount: data.negotiation.amount,
          payment_method: data.negotiation.payment_method,
          date: data.negotiation.date,
          location: data.negotiation.location ?? null,
          notes: data.negotiation.notes ?? null,
          lgpd_consent_at: issuedAt,
        },
        status: "issued",
        version,
        previous_receipt_id: previousId,
        issued_at: issuedAt,
        created_by: userId,
      } as never)
      .select("id, code, version, status, issued_at")
      .single();
    if (iErr) throw new Error(iErr.message);

    return { ok: true as const, receipt: inserted, url: `/r/${code}` };
  });

/** Lista recibos de uma moto para o vendedor/comprador (RLS aplica). */
export const listReceiptsForMotorcycle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { motorcycle_id: string }) => ({ motorcycle_id: String(data.motorcycle_id) }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("smart_receipts")
      .select("id, code, version, status, issued_at, sha256, previous_receipt_id, buyer_snapshot, seller_snapshot, negotiation")
      .eq("motorcycle_id", data.motorcycle_id)
      .order("issued_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Revoga um recibo (somente vendedor original ou admin). */
export const revokeSmartReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; reason: string }) => {
    if (!data?.id) throw new Error("id obrigatório");
    if (!data?.reason?.trim()) throw new Error("Informe o motivo da revogação");
    return { id: data.id, reason: data.reason.trim() };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("smart_receipts")
      .update({ status: "revoked", cancelled_at: new Date().toISOString(), cancel_reason: data.reason } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });