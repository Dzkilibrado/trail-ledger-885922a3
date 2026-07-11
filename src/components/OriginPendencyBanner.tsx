import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileWarning, Paperclip, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PendencyRow } from "@/hooks/useDocumentPendencies";
import { isOriginSnoozed, snoozeOriginPendency } from "@/lib/origin-status";
import { toast } from "sonner";

/**
 * Banner amigável de "Documento de origem pendente".
 *
 * Regras:
 * - Só aparece quando `pendency.has_origin_pendency === true` e a moto
 *   não está silenciada localmente (por usuário + moto, 7 dias).
 * - "Anexar documento" leva à Central de Documentos da moto com o
 *   formulário pré-configurado (query `?kind=origin`).
 * - "Lembrar mais tarde" apenas silencia por 7 dias; não remove a pendência.
 */
export function OriginPendencyBanner({
  motoId,
  userId,
  pendency,
}: {
  motoId: string;
  userId: string | null;
  pendency: PendencyRow | null | undefined;
}) {
  const [snoozedTick, setSnoozedTick] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Reavalia silêncio quando o usuário loga.
  useEffect(() => {
    setDismissed(false);
  }, [userId, motoId]);

  if (!pendency?.has_origin_pendency) return null;
  if (dismissed) return null;
  if (isOriginSnoozed(userId, motoId)) return null;
  // `snoozedTick` só existe para forçar rerender após snooze; leitura acima é a verdade.
  void snoozedTick;

  function handleSnooze() {
    snoozeOriginPendency(userId, motoId);
    setDismissed(true);
    setSnoozedTick((n) => n + 1);
    toast.success("Aviso silenciado por 7 dias", {
      description: "A pendência continua registrada — você pode anexar o documento a qualquer momento.",
    });
  }

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-300">
          <FileWarning className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="text-sm font-semibold text-amber-100">
            🟠 Documento de origem pendente
          </div>
          <p className="text-amber-100/85 leading-relaxed">
            Ainda não foi informado um documento que comprove a origem desta motocicleta.
          </p>
          <p className="text-amber-100/85 leading-relaxed">
            Anexe a <strong>Nota Fiscal</strong> ou o <strong>Recibo de Compra e Venda</strong> para manter o
            histórico completo e aumentar a confiabilidade das informações.
          </p>
          <p className="text-amber-100/70 leading-relaxed">
            Você pode enviar esse documento a qualquer momento. O uso do TrailBook continua normalmente.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-amber-500/20 pt-3">
        <Button
          size="sm"
          variant="ghost"
          className="text-amber-100/80 hover:bg-amber-500/10 hover:text-amber-50"
          onClick={handleSnooze}
        >
          <Clock className="h-4 w-4" /> Lembrar mais tarde
        </Button>
        <Button size="sm" asChild className="bg-amber-500 text-amber-950 hover:bg-amber-400">
          <Link
            to="/documents/$id"
            params={{ id: motoId }}
            search={{ kind: "origin" }}
          >
            <Paperclip className="h-4 w-4" /> Anexar documento
          </Link>
        </Button>
      </div>
    </div>
  );
}