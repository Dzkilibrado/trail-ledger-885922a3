import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { recomposeTimeline, toDecimalHours } from "@/lib/activity-recalc";

type EventRow = {
  id: string;
  motorcycle_id: string;
  type: string;
  title: string;
  description: string | null;
  occurred_at: string;
  hours_delta: number | null;
  km_delta: number | null;
  cost: number | null;
};

/**
 * Menu de ações por atividade — editar, excluir. Edita apenas os campos
 * comuns e recalcula automaticamente saldos + programações vinculadas.
 * Toda operação grava em `audit_log`.
 */
export function EventActionsMenu({ event, onChanged }: { event: EventRow; onChanged?: () => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [occurredAt, setOccurredAt] = useState(event.occurred_at.slice(0, 16));
  const initH = Math.floor(Number(event.hours_delta ?? 0));
  const initM = Math.round((Number(event.hours_delta ?? 0) - initH) * 60);
  const [hoursInt, setHoursInt] = useState(String(initH));
  const [minutes, setMinutes] = useState(String(initM));
  const [km, setKm] = useState(event.km_delta != null ? String(event.km_delta) : "");
  const [cost, setCost] = useState(event.cost != null ? String(event.cost) : "");

  async function save() {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      const newHoursDelta = (hoursInt || minutes) ? toDecimalHours(Number(hoursInt || 0), Number(minutes || 0)) : null;
      const newKmDelta = km ? Number(km) : null;
      const newCost = cost ? Number(cost) : null;
      const newOccurred = new Date(occurredAt).toISOString();

      const oldValues = {
        title: event.title, description: event.description, occurred_at: event.occurred_at,
        hours_delta: event.hours_delta, km_delta: event.km_delta, cost: event.cost,
      };
      const newValues = {
        title, description: description || null, occurred_at: newOccurred,
        hours_delta: newHoursDelta, km_delta: newKmDelta, cost: newCost,
      };

      const { error } = await supabase.from("events").update({
        ...newValues,
      } as never).eq("id", event.id);
      if (error) throw error;

      await supabase.from("audit_log").insert({
        table_name: "events",
        record_id: event.id,
        motorcycle_id: event.motorcycle_id,
        actor_id: uid,
        action: "update",
        old_values: oldValues,
        new_values: newValues,
      } as never);

      // Recomposição cronológica exata: reescreve hours_at_event/km_at_event
      // de todos os eventos em ordem, atualiza totais da moto e last_done_*
      // de cada programação. Não há mais snapshot "best-effort".
      await recomposeTimeline(event.motorcycle_id);
      toast.success("Atividade atualizada. Histórico e agenda recalculados.");
      setEditing(false);
      qc.invalidateQueries();
      onChanged?.();
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao atualizar atividade.");
    } finally { setSaving(false); }
  }

  async function remove() {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;

      // Auditoria antes da exclusão (guarda o old_values)
      await supabase.from("audit_log").insert({
        table_name: "events",
        record_id: event.id,
        motorcycle_id: event.motorcycle_id,
        actor_id: uid,
        action: "delete",
        old_values: {
          type: event.type, title: event.title, occurred_at: event.occurred_at,
          hours_delta: event.hours_delta, km_delta: event.km_delta, cost: event.cost,
        },
      } as never);

      // Exclusão em cascata: maintenance_items e attachments ficam órfãos
      // apenas se não houver ON DELETE CASCADE no banco. Apagamos manualmente
      // para garantir integridade e recálculo correto.
      await supabase.from("maintenance_items").delete().eq("event_id", event.id);
      await supabase.from("event_attachments").delete().eq("event_id", event.id);
      const { error } = await supabase.from("events").delete().eq("id", event.id);
      if (error) throw error;

      await recomposeTimeline(event.motorcycle_id);

      toast.success("Atividade excluída. Histórico, agenda e saúde recalculados.");
      setConfirming(false);
      qc.invalidateQueries();
      onChanged?.();
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao excluir atividade.");
    } finally { setSaving(false); }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Ações da atividade" className="h-7 w-7">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Editar atividade
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setConfirming(true)} className="text-destructive focus:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Excluir atividade
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar atividade</DialogTitle>
            <DialogDescription>
              Ao salvar, o TrailBook recalcula automaticamente o histórico, a agenda e os alertas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Data</Label>
              <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Horas</Label>
                <Input type="number" step="1" min="0" value={hoursInt} onChange={(e) => setHoursInt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Minutos</Label>
                <Input type="number" step="1" min="0" max="59" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">KM</Label>
                <Input type="number" step="1" min="0" value={km} onChange={(e) => setKm(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Custo R$</Label>
                <Input type="number" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Observações</Label>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving} className="btn-glow">
                {saving ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta atividade?</AlertDialogTitle>
            <AlertDialogDescription>
              A atividade será removida do histórico. O TrailBook vai recalcular
              agenda, saúde da moto, índice de conservação e alertas.
              A operação fica registrada na auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving ? "Excluindo…" : "Excluir atividade"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}