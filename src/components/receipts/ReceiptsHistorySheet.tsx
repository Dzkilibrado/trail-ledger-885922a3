import { ListRowsSkeleton } from "@/components/Skeletons";
import { useState } from "react";
import { TBBottomSheet } from "@/design-system/overlays/TBBottomSheet";
import { Button } from "@/components/ui/button";
import { ReceiptStatusBadge } from "@/components/receipts/ReceiptStatusBadge";
import { EmitReceiptDialog } from "@/components/receipts/EmitReceiptDialog";
import { useReceiptsForMoto } from "@/hooks/useActiveNegotiation";
import { formatCurrencyBRL, formatIssuedAt, formatVersion } from "@/lib/smart-receipts";
import type { ReceiptStatus } from "@/lib/smart-receipts";
import { FileSignature, ExternalLink, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";

export function ReceiptsHistorySheet({
  motoId,
  isOwner,
  trigger,
}: {
  motoId: string;
  isOwner: boolean;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { data: rows, isLoading } = useReceiptsForMoto(open ? motoId : undefined);

  // Bug 2: abre PDF via rota mesma-origem (trailbook.com.br) para evitar
  // ERR_BLOCKED_BY_CLIENT causado por extensões/DNS filters bloqueando
  // *.supabase.co. A autorização é validada no handler (mesmo RPC).
  function openPdf(code: string, variant: "signed" | "original") {
    try {
      const url = `/api/receipts/${encodeURIComponent(code)}/pdf?variant=${variant}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao abrir PDF");
    }
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <TBBottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Recibos & Transferências"
        description="Histórico oficial de propriedade da motocicleta"
        footer={
          isOwner ? (
            <EmitReceiptDialog
              motorcycleId={motoId}
              trigger={
                <Button className="w-full">
                  <FileSignature className="h-4 w-4" /> Emitir novo recibo
                </Button>
              }
            />
          ) : null
        }
      >
        {isLoading ? (
          <div className="py-4"><ListRowsSkeleton rows={3} /></div>
        ) : !rows || rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhum recibo emitido ainda.
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold tracking-wider text-primary">
                        {r.code}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {formatVersion(r.version)}
                      </span>
                      <ReceiptStatusBadge status={r.status as ReceiptStatus} />
                    </div>
                    <div className="mt-1 truncate text-sm font-medium">
                      {r.buyer_snapshot?.full_name ?? "Comprador"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.negotiation?.amount != null && (
                        <>{formatCurrencyBRL(r.negotiation.amount)} · </>
                      )}
                      {formatIssuedAt(r.issued_at)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openPdf(r.code, r.status === "completed" ? "signed" : "original")}
                    >
                      <Download className="h-3.5 w-3.5" /> PDF
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/r/${r.code}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> Ver
                      </a>
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </TBBottomSheet>
    </>
  );
}

export function ReceiptsSummaryRow({
  motoId,
  isOwner,
  count,
}: {
  motoId: string;
  isOwner: boolean;
  count: number;
}) {
  return (
    <ReceiptsHistorySheet
      motoId={motoId}
      isOwner={isOwner}
      trigger={
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent/40"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
              <FileSignature className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Recibos & Transferências</div>
              <div className="text-xs text-muted-foreground">
                {count === 0 ? "Nenhum recibo emitido" : `${count} ${count === 1 ? "recibo" : "recibos"}`}
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      }
    />
  );
}