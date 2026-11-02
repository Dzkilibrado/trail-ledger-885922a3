/**
 * RegisterUsageForm
 *
 * Conteúdo reutilizável do fluxo de Registrar Uso:
 * - Etapa 1: formulário (data, leitura, local)
 * - Etapa 2: tela de conferência
 * - Etapa 3: alerta de uso atípico (AlertDialog)
 *
 * Usado tanto no RegisterUsageDialog (standalone) quanto no NewEventDialog
 * quando o tipo "Uso" é selecionado — mantendo a mesma UX em ambos os contextos.
 */
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ChevronLeft } from "lucide-react";
import {
  TBButton,
  TBDateInput,
  TBFormField,
  TBHourmeterInput,
  TBInput,
  TBOdometerInput,
} from "@/design-system";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Motorcycle } from "@/lib/trailbook";
import { usageDate } from "@/lib/til/usage-reading";
import {
  usageIncrementPreview,
  validateUsageIncrement,
  computeUsageAverage,
  isUsageAtypical,
} from "@/lib/til/usage-increment";

type Step = "form" | "confirm" | "atypical";

interface Props {
  moto: Motorcycle | null;
  onClose: () => void;
  /** Botão de cancelar na etapa 1 — label e ação customizáveis. */
  cancelLabel?: string;
  onCancel?: () => void;
}

export function RegisterUsageForm({ moto, onClose, cancelLabel = "Cancelar", onCancel }: Props) {
  const qc = useQueryClient();
  const [date, setDate] = useState(usageDate);
  const [reading, setReading] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("form");
  const busy = useRef(false);
  const request = useRef<string | null>(null);

  const supported = moto?.control_type === "hours" || moto?.control_type === "km";
  const current = Number(moto?.control_type === "hours" ? moto.hours_total : moto?.km_total);
  const preview = usageIncrementPreview(moto?.control_type ?? "", current, reading);
  const unit = moto?.control_type === "hours" ? "h" : "km";
  const format = (value: number) =>
    `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unit}`;

  const usageHistory = useQuery({
    queryKey: ["usage-history-avg", moto?.id],
    queryFn: async () => {
      if (!moto?.id) return [];
      const field = moto.control_type === "hours" ? "hours_delta" : "km_delta";
      const { data } = await supabase
        .from("events")
        .select(field)
        .eq("motorcycle_id", moto.id)
        .eq("type", "usage")
        .not(field, "is", null)
        .order("occurred_at", { ascending: false })
        .limit(3);
      return (data ?? [])
        .map((r: Record<string, unknown>) => Number(r[field]))
        .filter((v: number) => Number.isFinite(v) && v > 0);
    },
    enabled: !!moto?.id && supported,
    staleTime: 60_000,
  });

  const average = computeUsageAverage(usageHistory.data ?? []);
  const amount = preview?.amount ?? 0;
  const atypical = isUsageAtypical(amount, average);

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validation = validateUsageIncrement(moto!.control_type, reading, date);
    if (validation) { setError(validation); return; }
    setError(null);
    setStep("confirm");
  }

  function handleConfirmed() {
    if (atypical) {
      setStep("atypical");
    } else {
      commitSave();
    }
  }

  async function commitSave() {
    if (busy.current || !moto) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    setStep("form");
    request.current ??= crypto.randomUUID();
    try {
      const { data, error: failure } = await supabase.rpc("commit_usage_increment", {
        _moto: moto.id,
        _date: date,
        _amount: Number(reading.replace(",", ".")),
        _location: location.trim(),
        _request_id: request.current,
      });
      if (failure) {
        if (["P0001", "42501", "22003", "PGRST202", "42883"].includes(failure.code)) {
          request.current = null;
        }
        throw failure;
      }
      const row = (Array.isArray(data) ? data[0] : data) as { event_id?: string } | null;
      if (!row?.event_id) throw new Error("Registro não confirmado");
      await qc.invalidateQueries();
      onClose();
      toast.success("Uso registrado. Leituras e acompanhamento atualizados.");
    } catch (failure) {
      await qc.invalidateQueries();
      const message = (failure as { message?: string }).message ?? "";
      const code = (failure as { code?: string }).code;
      const known = ["A data deve", "Use até", "Informe", "Data inválida", "Defina uma única", "Motocicleta indisponível"];
      setError(
        code === "PGRST202" || code === "42883"
          ? "O registro de uso adicional aguarda liberação. Nenhum uso foi gravado."
          : known.some((prefix) => message.startsWith(prefix))
          ? message
          : "Não foi possível confirmar o registro. Tente novamente com os mesmos dados.",
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  const handleCancel = onCancel ?? onClose;
  const labelField = moto?.control_type === "hours" ? "Horas utilizadas (h)" : "Quilômetros percorridos (km)";
  const dateFormatted = date
    ? new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : "—";

  if (!supported) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {moto
          ? "Defina uma única unidade de medição no cadastro da moto antes de registrar o uso."
          : "Selecione uma motocicleta ativa para registrar o uso."}
      </p>
    );
  }

  return (
    <>
      {step === "form" ? (
        /* ── ETAPA 1: Formulário ── */
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <TBFormField label="Data do uso" htmlFor="usage-date">
            <TBDateInput
              id="usage-date"
              required
              max={usageDate()}
              value={date}
              disabled={saving}
              onChange={(e) => setDate(e.target.value)}
            />
          </TBFormField>
          <TBFormField label={labelField} htmlFor="usage-reading">
            {moto?.control_type === "hours" ? (
              <TBHourmeterInput
                id="usage-reading"
                required
                value={reading}
                disabled={saving}
                onChange={(e) => setReading(e.target.value)}
              />
            ) : (
              <TBOdometerInput
                id="usage-reading"
                required
                value={reading}
                disabled={saving}
                onChange={(e) => setReading(e.target.value)}
              />
            )}
          </TBFormField>
          <TBFormField label="Local (opcional)" htmlFor="usage-location">
            <TBInput
              id="usage-location"
              maxLength={300}
              value={location}
              disabled={saving}
              onChange={(e) => setLocation(e.target.value)}
            />
          </TBFormField>
          <dl className="space-y-2 border-t border-border pt-3 text-sm" aria-live="polite">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Total atual</dt>
              <dd>{format(current)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Uso informado</dt>
              <dd>{preview ? format(preview.amount) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3 font-medium">
              <dt>Novo total previsto</dt>
              <dd>{preview ? format(preview.total) : "—"}</dd>
            </div>
          </dl>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <TBButton type="button" variant="outline" className="flex-1" disabled={saving} onClick={handleCancel}>
              {cancelLabel}
            </TBButton>
            <TBButton type="submit" className="flex-1" disabled={saving || !preview}>
              {saving ? "Salvando…" : "Continuar →"}
            </TBButton>
          </div>
        </form>
      ) : (
        /* ── ETAPA 2: Tela de conferência ── */
        <div className="space-y-5">
          <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm font-medium text-primary">
              Confira os dados antes de salvar
            </p>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3 border-b border-border pb-3">
              <dt className="text-muted-foreground">Data do uso</dt>
              <dd className="font-medium">{dateFormatted}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-border pb-3">
              <dt className="text-muted-foreground">{labelField}</dt>
              <dd className="text-lg font-bold text-foreground">
                {preview ? format(preview.amount) : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-border pb-3">
              <dt className="text-muted-foreground">Total atual</dt>
              <dd>{format(current)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-medium">Novo total após salvar</dt>
              <dd className="font-bold text-primary">
                {preview ? format(preview.total) : "—"}
              </dd>
            </div>
            {location.trim() && (
              <div className="flex justify-between gap-3 border-t border-border pt-3">
                <dt className="text-muted-foreground">Local</dt>
                <dd className="text-right">{location.trim()}</dd>
              </div>
            )}
          </dl>
          {average !== null && (
            <p className="text-xs text-muted-foreground">
              Sua média recente: <span className="font-medium">{format(average)}</span> por saída
              {atypical && (
                <span className="ml-1 font-semibold text-amber-500"> — valor acima do habitual</span>
              )}
            </p>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <TBButton
              type="button"
              variant="outline"
              className="flex-1 gap-1"
              disabled={saving}
              onClick={() => setStep("form")}
            >
              <ChevronLeft className="h-4 w-4" /> Corrigir
            </TBButton>
            <TBButton
              type="button"
              className="flex-1"
              disabled={saving}
              onClick={handleConfirmed}
            >
              {saving ? "Salvando…" : "Confirmar e salvar"}
            </TBButton>
          </div>
        </div>
      )}

      {/* ── ETAPA 3: Alerta de uso atípico ── */}
      <AlertDialog open={step === "atypical"} onOpenChange={(open) => { if (!open) setStep("confirm"); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Uso acima do habitual
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  O valor informado{" "}
                  <strong>({preview ? format(preview.amount) : "—"})</strong> está acima da sua
                  média recente de{" "}
                  <strong>{average !== null ? format(average) : "—"}</strong> por saída.
                </p>
                <p>
                  Isso pode acontecer — mas vale conferir se o valor está certo antes de salvar,
                  pois ele impacta a agenda de manutenção da sua moto.
                </p>
                <p className="font-medium">O valor informado está correto?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStep("form")}>
              Revisar dados
            </AlertDialogCancel>
            <AlertDialogAction onClick={commitSave} className="btn-glow">
              Sim, está correto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
