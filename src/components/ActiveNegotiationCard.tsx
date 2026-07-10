import { FileSignature, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { formatCurrencyBRL, formatIssuedAt } from "@/lib/smart-receipts";
import type { ActiveNegotiation } from "@/hooks/useActiveNegotiation";

/**
 * Card resumido de negociação em andamento (recibo em rascunho).
 * Filosofia: Resumo → Ação → Detalhe. Só aparece quando existe rascunho.
 */
export function ActiveNegotiationCard({
  motoId,
  negotiation,
}: {
  motoId: string;
  negotiation: ActiveNegotiation;
}) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
            <FileSignature className="h-3.5 w-3.5" /> Compra e Venda · Rascunho
          </div>
          <div className="mt-1 truncate font-display text-base font-semibold">
            {negotiation.buyer_name || "Comprador"}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {negotiation.amount != null && <>{formatCurrencyBRL(negotiation.amount)} · </>}
            iniciado {formatIssuedAt(negotiation.created_at)}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" asChild>
            <Link to="/r/$code" params={{ code: negotiation.code }}>
              <ExternalLink className="h-3.5 w-3.5" /> Continuar
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}