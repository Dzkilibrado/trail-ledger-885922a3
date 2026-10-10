import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TBButton, TBDateInput, TBDialog, TBFormField, TBHourmeterInput, TBInput, TBOdometerInput } from "@/design-system";
import { supabase } from "@/integrations/supabase/client";
import type { Motorcycle } from "@/lib/trailbook";
import { usageDate } from "@/lib/til/usage-reading";
import { usageIncrementPreview, validateUsageIncrement } from "@/lib/til/usage-increment";

export function RegisterUsageDialog({ moto, onClose }: { moto: Motorcycle | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(usageDate);
  const [reading, setReading] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const request = useRef<string | null>(null);
  const submitted = useRef(false);
  const supported = moto?.control_type === "hours" || moto?.control_type === "km";
  const current = Number(moto?.control_type === "hours" ? moto.hours_total : moto?.km_total);
  const preview = usageIncrementPreview(moto?.control_type ?? "", current, reading);
  const unit = moto?.control_type === "hours" ? "h" : "km";
  const format = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unit}`;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current || !moto) return;
    const validation = submitted.current ? null : validateUsageIncrement(moto.control_type, reading, date);
    if (validation) { setError(validation); return; }
    busy.current = true; setSaving(true); setError(null);
    request.current ??= crypto.randomUUID();
    submitted.current = true;
    try {
      const { data, error: failure } = await supabase.rpc("commit_usage_increment" as never, {
        _moto: moto.id, _date: date, _amount: Number(reading.replace(",", ".")), _location: location.trim(), _request_id: request.current,
      } as never);
      if (failure) {
        // A confirmed RPC rejection rolls back; a transport failure retains the retry identity.
        if (["P0001", "42501", "22003", "PGRST202", "42883"].includes(failure.code)) { request.current = null; submitted.current = false; }
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
      setError(code === "PGRST202" || code === "42883" ? "O registro de uso adicional aguarda liberação. Nenhum uso foi gravado." : known.some(prefix => message.startsWith(prefix)) ? message : "Não foi possível confirmar o registro. Tente novamente com os mesmos dados.");
    } finally { busy.current = false; setSaving(false); }
  }
  return <TBDialog open onOpenChange={open => { if (!open && !busy.current) onClose(); }} title="Registrar Uso" description={moto?.nickname || moto?.model || "Motocicleta ativa"}>
    {!supported ? <p role="alert" className="text-sm text-destructive">{moto ? "Defina uma única unidade de medição no cadastro da moto antes de registrar o uso." : "Selecione uma motocicleta ativa para registrar o uso."}</p> :
      <form onSubmit={save} className="space-y-4">
        <TBFormField label="Data do uso" htmlFor="usage-date"><TBDateInput id="usage-date" required max={usageDate()} value={date} disabled={saving || submitted.current} onChange={e => setDate(e.target.value)} /></TBFormField>
        <TBFormField label={moto?.control_type === "hours" ? "Horas utilizadas (h)" : "Quilômetros percorridos (km)"} htmlFor="usage-reading">
          {moto?.control_type === "hours" ? <TBHourmeterInput id="usage-reading" required value={reading} disabled={saving || submitted.current} onChange={e => setReading(e.target.value)} /> : <TBOdometerInput id="usage-reading" required value={reading} disabled={saving || submitted.current} onChange={e => setReading(e.target.value)} />}
        </TBFormField>
        <TBFormField label="Local (opcional)" htmlFor="usage-location"><TBInput id="usage-location" maxLength={300} value={location} disabled={saving || submitted.current} onChange={e => setLocation(e.target.value)} /></TBFormField>
        <dl className="space-y-2 border-t border-border pt-3 text-sm" aria-live="polite">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Total atual</dt><dd>{format(current)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Uso informado</dt><dd>{preview ? format(preview.amount) : "—"}</dd></div>
          <div className="flex justify-between gap-3 font-medium"><dt>Novo total previsto</dt><dd>{preview ? format(preview.total) : "—"}</dd></div>
        </dl>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2"><TBButton type="button" variant="outline" className="flex-1" disabled={saving} onClick={onClose}>Cancelar</TBButton><TBButton type="submit" className="flex-1" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</TBButton></div>
      </form>}
  </TBDialog>;
}