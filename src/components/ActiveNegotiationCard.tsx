import { useState } from "react";
import { FileSignature, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrencyBRL, formatIssuedAt, RECEIPT_STATUS_LABEL, type ReceiptStatus } from "@/lib/smart-receipts";
import { EmitReceiptDialog } from "@/components/receipts/EmitReceiptDialog";
import type { ActiveNegotiation } from "@/hooks/useActiveNegotiation";

/**
 * Card resumido de negociação em andamento (recibo em rascunho / emitido / aguardando aceite).
 * "Continuar" reabre o wizard no ponto correto do fluxo — nunca vai para a página pública.
 */
export function ActiveNegotiationCard({
  motoId, negotiation,
}: {
  motoId: string;
  negotiation: ActiveNegotiation;
}) {
  const [open, setOpen] = useState(false);
  const label = RECEIPT_STATUS_LABEL[(negotiation.status as ReceiptStatus)] ?? negotiation.status;
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
            <FileSignature className="h-3.5 w-3.5" /> Compra e Venda · {label}
          </div>
          <div className="mt-1 truncate font-display text-base font-semibold">
            {negotiation.buyer_name || "Comprador"}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {negotiation.amount != null && <>{formatCurrencyBRL(negotiation.amount)} · </>}
            iniciado {formatIssuedAt(negotiation.created_at)}
          </div>
          {(negotiation.has_signed_document || negotiation.seller_accepted || negotiation.buyer_accepted) && (
            <div className="mt-1 text-[11px] text-muted-foreground">
              {negotiation.has_signed_document && "PDF assinado anexado · "}
              {negotiation.seller_accepted ? "Vendedor aceitou · " : ""}
              {negotiation.buyer_accepted ? "Comprador aceitou" : ""}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <EmitReceiptDialog
            motorcycleId={motoId}
            receiptId={negotiation.id}
            open={open}
            onOpenChange={setOpen}
            trigger={
              <Button size="sm">
                <Play className="h-3.5 w-3.5" /> Continuar
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
}