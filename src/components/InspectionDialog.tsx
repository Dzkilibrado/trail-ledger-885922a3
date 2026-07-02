import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Decision = Database["public"]["Enums"]["inspection_decision"];

const DECISION_LABEL: Record<Decision, string> = {
  good: "Está em bom estado",
  attention: "Requer atenção",
  replace_recommended: "Troca recomendada",
  replaced: "Troca realizada",
  postpone: "Postergar",
  ignore: "Ignorar",
};

export function InspectionDialog({
  open, onOpenChange, motoId, schedule, currentHours, currentKm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  motoId: string;
  schedule: { id: string; name: string; category: string };
  currentHours: number;
  currentKm: number;
}) {
  const qc = useQueryClient();
  const [decision, setDecision] = useState<Decision>("good");
  const [notes, setNotes] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [snoozeDays, setSnoozeDays] = useState(14);

  const signs = useQuery({
    queryKey: ["wear-signs", schedule.category],
    enabled: open,
    queryFn: async () => (await supabase.from("maintenance_wear_signs").select("*").eq("category", schedule.category as any).order("sort_order")).data ?? [],
  });

  async function save() {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const foundSigns = Object.entries(checked).filter(([, v]) => v).map(([k]) => k);

      // 1) Registra evento na linha do tempo
      const title = `Inspeção — ${schedule.name}${decision === "replaced" ? " · Trocado" : ""}`;
      const { data: ev, error: evErr } = await supabase.from("events").insert({
        motorcycle_id: motoId,
        created_by: uid,
        type: decision === "replaced" ? "maintenance" : "revision",
        title,
        description: notes || null,
        occurred_at: new Date().toISOString(),
        hours_at_event: currentHours,
        km_at_event: currentKm,
      } as never).select("id").single();
      if (evErr) throw evErr;

      // 2) Registra inspeção
      await supabase.from("maintenance_inspections").insert({
        motorcycle_id: motoId,
        schedule_id: schedule.id,
        event_id: ev?.id,
        decision,
        signs: foundSigns,
        notes: notes || null,
        hours_at: currentHours,
        km_at: currentKm,
        created_by: uid,
      } as never);

      // 3) Atualiza a programação conforme a decisão
      const patch: any = { updated_at: new Date().toISOString() };
      if (decision === "good" || decision === "attention" || decision === "replaced") {
        patch.last_done_at = new Date().toISOString();
        patch.last_done_hours = currentHours;
        patch.last_done_km = currentKm;
        patch.last_completed_event_id = ev?.id ?? null;
        patch.status = "active";
        patch.snoozed_until = null;
      } else if (decision === "postpone") {
        patch.status = "snoozed";
        patch.snoozed_until = new Date(Date.now() + snoozeDays * 86400000).toISOString();
      } else if (decision === "ignore") {
        patch.status = "ignored";
      } else if (decision === "replace_recommended") {
        patch.status = "active"; // permanece visível como pendente
      }
      await supabase.from("maintenance_schedules").update(patch).eq("id", schedule.id);

      toast.success("Inspeção registrada.");
      qc.invalidateQueries({ queryKey: ["schedules"] });
      qc.invalidateQueries({ queryKey: ["events", motoId] });
      qc.invalidateQueries({ queryKey: ["motorcycle", motoId] });
      onOpenChange(false);
      setNotes(""); setChecked({});
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao salvar inspeção.");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" /> Registrar inspeção
          </DialogTitle>
          <DialogDescription>{schedule.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sinais de desgaste */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Sinais encontrados</Label>
            {signs.isLoading ? (
              <div className="text-xs text-muted-foreground">Carregando sinais…</div>
            ) : (signs.data?.length ?? 0) === 0 ? (
              <div className="text-xs text-muted-foreground">Nenhum sinal cadastrado para esta categoria.</div>
            ) : (
              <ul className="space-y-1.5">
                {signs.data!.map((s) => (
                  <li key={s.id} className="flex items-start gap-2 rounded-lg border border-border p-2 text-sm">
                    <Checkbox
                      id={`s-${s.id}`}
                      checked={!!checked[s.label]}
                      onCheckedChange={(v) => setChecked((c) => ({ ...c, [s.label]: !!v }))}
                    />
                    <label htmlFor={`s-${s.id}`} className="cursor-pointer text-sm">{s.label}</label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Observações</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas técnicas, estado visual…" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Decisão</Label>
            <Select value={decision} onValueChange={(v) => setDecision(v as Decision)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(DECISION_LABEL) as Decision[]).map((d) => (
                  <SelectItem key={d} value={d}>{DECISION_LABEL[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {decision === "postpone" && (
              <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                <span>Adiar por</span>
                <input
                  type="number" min={1} max={365} value={snoozeDays}
                  onChange={(e) => setSnoozeDays(Number(e.target.value))}
                  className="w-20 rounded-md border border-border bg-transparent px-2 py-1 text-sm"
                />
                <span>dias</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="btn-glow">
            {saving ? "Salvando…" : "Salvar inspeção"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}