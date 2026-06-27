import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MoreHorizontal, CheckCircle2, Clock, EyeOff, Pencil, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Schedule = { id: string; name: string; status?: string | null };

export function ScheduleActionsMenu({
  schedule,
  onComplete,
  onEdit,
}: {
  schedule: Schedule;
  onComplete: () => void;
  onEdit?: () => void;
}) {
  const qc = useQueryClient();
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [snoozeDays, setSnoozeDays] = useState(14);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["schedules"] });
    qc.invalidateQueries({ queryKey: ["schedules", schedule.id] });
  }

  async function setStatus(status: "active" | "snoozed" | "ignored" | "done", snoozed_until: string | null = null) {
    const { error } = await supabase
      .from("maintenance_schedules")
      .update({ status, snoozed_until } as never)
      .eq("id", schedule.id);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function snooze() {
    const until = new Date(Date.now() + snoozeDays * 86400000).toISOString();
    await setStatus("snoozed", until);
    toast.success(`Postergada por ${snoozeDays} dias`);
    setSnoozeOpen(false);
  }

  async function ignore() {
    await setStatus("ignored");
    toast.success("Programação ignorada");
  }

  async function reactivate() {
    await setStatus("active", null);
    toast.success("Programação reativada");
  }

  async function destroy() {
    const { error } = await supabase.from("maintenance_schedules").delete().eq("id", schedule.id);
    if (error) return toast.error(error.message);
    toast.success("Programação removida");
    setConfirmDelete(false);
    refresh();
  }

  const isDormant = schedule.status === "snoozed" || schedule.status === "ignored" || schedule.status === "done";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Ações da programação">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={onComplete}>
            <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Registrar como concluída
          </DropdownMenuItem>
          {isDormant ? (
            <DropdownMenuItem onSelect={reactivate}>
              <CalendarIcon className="mr-2 h-4 w-4" /> Reativar programação
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onSelect={() => setSnoozeOpen(true)}>
                <Clock className="mr-2 h-4 w-4 text-amber-400" /> Postergar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={ignore}>
                <EyeOff className="mr-2 h-4 w-4" /> Ignorar
              </DropdownMenuItem>
            </>
          )}
          {onEdit && (
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="mr-2 h-4 w-4" /> Editar programação
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirmDelete(true)} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Excluir programação
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={snoozeOpen} onOpenChange={setSnoozeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Postergar programação</DialogTitle>
            <DialogDescription>Defina por quantos dias deseja esconder esta programação da agenda.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="snooze">Adiar por (dias)</Label>
            <Input id="snooze" type="number" min={1} max={365} value={snoozeDays} onChange={(e) => setSnoozeDays(Number(e.target.value))} />
            <div className="flex flex-wrap gap-2 text-xs">
              {[7, 14, 30, 60].map((d) => (
                <button key={d} type="button" onClick={() => setSnoozeDays(d)} className="rounded-full border border-border px-2 py-1 hover:border-primary">{d} dias</button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSnoozeOpen(false)}>Cancelar</Button>
            <Button onClick={snooze}>Postergar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta programação de manutenção?</AlertDialogTitle>
            <AlertDialogDescription>
              A programação <strong>{schedule.name}</strong> será removida. Esta ação <strong>não afeta a motocicleta nem o histórico</strong> de eventos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={destroy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir programação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}