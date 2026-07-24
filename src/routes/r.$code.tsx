import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { validateReceiptPublic } from "@/lib/smart-receipts.functions";
import { supabase } from "@/integrations/supabase/client";
import { ReceiptStatusBadge } from "@/components/receipts/ReceiptStatusBadge";
import { formatIssuedAt, formatVersion, sha256HexBytes, type ReceiptStatus } from "@/lib/smart-receipts";
import { Button } from "@/components/ui/button";
import { BadgeCheck, Eye, FileWarning, ShieldCheck, ShieldX, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/r/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Recibo ${params.code} — TrailBook` },
      { name: "description", content: `Validação pública do Recibo Inteligente ${params.code} emitido pelo TrailBook.` },
      { property: "og:title", content: `Recibo ${params.code} — TrailBook` },
      { property: "og:description", content: "Documento eletrônico com QR Code e hash SHA-256." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ params }) => validateReceiptPublic({ data: { code: params.code } }),
  component: PublicReceipt,
});

function PublicReceipt() {
  const initial = Route.useLoaderData();
  const { code } = Route.useParams();
  const [verifyResult, setVerifyResult] = useState<null | { ok: boolean; sha256: string }>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const q = useQuery({
    queryKey: ["public-receipt", code],
    queryFn: () => validateReceiptPublic({ data: { code } }),
    initialData: initial,
  });

  if (!q.data?.found) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <FileWarning className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 font-display text-2xl font-bold">Recibo não encontrado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O código <code className="font-mono">{code}</code> não corresponde a nenhum Recibo Inteligente emitido pelo TrailBook.
        </p>
      </div>
    );
  }

  const r = q.data.receipt as any;

  async function onVerify(file: File) {
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const hex = await sha256HexBytes(bytes);
      setVerifyResult({ ok: hex.toLowerCase() === String(r.sha256).toLowerCase(), sha256: hex });
    } finally { setBusy(false); }
  }

  async function openInternalViewer() {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      toast.info("Faça login como vendedor ou comprador para visualizar o PDF.");
      return;
    }
    navigate({
      to: "/recibos/$code/visualizar",
      params: { code },
      search: { variant: (r.status === "completed" ? "signed" : "original") as "signed" | "original" },
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <BadgeCheck className="h-6 w-6" />
            <span className="font-display text-lg font-bold">TrailBook</span>
          </div>
          <ReceiptStatusBadge status={r.status as ReceiptStatus} />
        </div>
        <h1 className="font-display text-2xl font-bold">Recibo Inteligente</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>Código: <code className="font-mono text-foreground">{code}</code></span>
          <span>Versão: <strong className="text-foreground">{formatVersion(r.version)}</strong></span>
          <span>Emitido em: <strong className="text-foreground">{formatIssuedAt(r.issued_at)}</strong></span>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Motocicleta</h2>
        <p className="font-semibold">
          {r.moto_brand} {r.moto_model}{r.moto_year_model ? ` — ${r.moto_year_model}` : ""}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-muted/10 p-4 text-sm text-muted-foreground">
        <p>
          Detalhes das partes (vendedor e comprador), CPF, chassi e valor da negociação
          são visíveis apenas para as partes envolvidas autenticadas no TrailBook.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-muted/20 p-4">
        <h2 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Autenticidade</h2>
        <p className="break-all font-mono text-[11px] text-muted-foreground">SHA-256: {r.sha256}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={openInternalViewer}>
            <Eye className="h-4 w-4" /> Visualizar PDF (partes)
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
            <Upload className="h-4 w-4" />
            Verificar arquivo
            <input type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && onVerify(e.target.files[0])} disabled={busy} />
          </label>
        </div>
        {verifyResult && (
          <div className={`mt-3 flex items-start gap-2 rounded-lg border p-3 text-sm ${verifyResult.ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
            {verifyResult.ok ? <ShieldCheck className="h-4 w-4" /> : <ShieldX className="h-4 w-4" />}
            <div>
              <div className="font-semibold">{verifyResult.ok ? "Arquivo autêntico" : "Hash não confere — arquivo alterado"}</div>
              <div className="break-all font-mono text-[10px] opacity-80">Calculado: {verifyResult.sha256}</div>
            </div>
          </div>
        )}
      </section>

      <footer className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
        Documento emitido eletronicamente pelo TrailBook — não substitui ATPV-e, CRV ou registro no DETRAN.
      </footer>
    </div>
  );
}