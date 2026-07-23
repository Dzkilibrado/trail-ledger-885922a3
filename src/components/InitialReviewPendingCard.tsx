import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InitialReviewSheet } from "@/components/onboarding/InitialReviewSheet";

/**
 * Card oficial "Revisão inicial recomendada".
 *
 * Aparece no lugar do "Tudo em dia" quando:
 *   - a moto foi cadastrada como usada (baseline de horas/km informada);
 *   - `initial_review_done_at` ainda está nulo.
 *
 * Comunicação: informativa/atenção moderada (âmbar), nunca alarmista.
 * Deixa claro que o motor calculou "sem vencimentos" a partir da baseline,
 * mas o estado físico dos componentes ainda não foi confirmado.
 *
 * IMPORTANTE: não altera nenhuma lógica de cálculo — apenas comunicação.
 */
export function InitialReviewPendingCard({
  motoId,
  motoHours,
  motoKm,
}: {
  motoId: string;
  motoHours: number;
  motoKm: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section
      aria-label="Revisão inicial recomendada"
      className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-400">
          <ClipboardCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-sm font-semibold text-amber-100">
            Revisão inicial recomendada
          </div>
          <p className="text-xs leading-relaxed text-amber-200/80">
            Esta moto foi cadastrada como usada. As previsões estão sendo
            calculadas a partir das horas e quilômetros informados, mas o
            estado real dos componentes ainda não foi confirmado.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 pl-12">
        <Button
          size="sm"
          className="btn-glow"
          onClick={() => setOpen(true)}
        >
          Revisar agora
        </Button>
        <span className="text-[11px] text-muted-foreground">
          ou continue depois — o aviso permanece até a confirmação.
        </span>
      </div>
      <InitialReviewSheet
        motoId={motoId}
        motoHours={motoHours}
        motoKm={motoKm}
        open={open}
        onOpenChange={setOpen}
      />
    </section>
  );
}

/**
 * Regra oficial de "revisão inicial pendente".
 * Compartilhada por Dashboard, Cockpit e demais telas para garantir
 * consistência de comunicação.
 */
export function needsInitialReview(moto: {
  condition?: string | null;
  hours_initial?: number | null;
  km_initial?: number | null;
  initial_review_done_at?: string | null;
}): boolean {
  if (moto.initial_review_done_at) return false;
  const isUsed =
    moto.condition === "used" ||
    Number(moto.hours_initial ?? 0) > 0 ||
    Number(moto.km_initial ?? 0) > 0;
  return isUsed;
}