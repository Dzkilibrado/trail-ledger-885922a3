import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { NewEventDialog } from "@/components/NewEventDialog";
import { ComponentIcon } from "./componentIcon";
import type { ComponentView } from "@/lib/til/components";
import { MAINT_CATEGORY_LABEL, type MaintenanceCategory, formatDate } from "@/lib/trailbook";
import type { Motorcycle } from "@/lib/trailbook";
import { Pin, PinOff, EyeOff, Eye, RotateCcw, Wrench, ChevronDown, ChevronUp } from "lucide-react";

/**
 * ComponentSheet — identidade do COMPONENTE (não do "plano").
 * Mobile-first. Toda a informação exibida responde a
 * "o que preciso fazer agora?".
 */
export function ComponentSheet({
  moto,
  component,
  open,
  onOpenChange,
  isOwner,
}: {
  moto: Motorcycle;
  component: ComponentView | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isOwner: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  useEffect(() => { if (!open) { setEditing(false); setShowHistory(false); } }, [open]);

  if (!component) return null;
  const c = component;

  async function update(patch: Record<string, unknown>) {
    const { error } = await supabase.from("maintenance_schedules").update(patch as never).eq("id", c.scheduleId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries();
  }

  async function togglePinned() { await update({ pinned: !c.pinned }); }
  async function toggleHidden() { await update({ hidden: !c.hidden }); }
  async function markNotApplicable() {
    await update({ status: "not_applicable" });
    toast.success("Componente marcado como não aplicável.");
  }
  async function restoreDefault() {
    await update({ status: "active", pinned: false, hidden: false, sort_order: null });
    toast.success("Componente restaurado.");
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto sm:max-w-lg sm:mx-auto sm:rounded-t-3xl">
          <SheetHeader className="text-left">
            <div className="flex items-start gap-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/10">
                <ComponentIcon category={c.category} className="h-7 w-7 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{c.categoryLabel}</div>
                <SheetTitle className="truncate font-display text-xl">{c.name}</SheetTitle>
                <SheetDescription className="mt-0.5 text-sm">{c.statusLabel}</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Ação principal */}
          {isOwner && c.rawStatus !== "not_applicable" && (
            <div className="mt-4">
              <Button className="btn-glow w-full" onClick={() => setRegisterOpen(true)}>
                <Wrench className="h-4 w-4" /> Registrar manutenção
              </Button>
            </div>
          )}

          {/* Próxima prevista + última */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <MiniStat title="Última manutenção">
              {c.lastMaintenance
                ? <>
                    <div className="font-medium">{c.lastMaintenance.date ? formatDate(c.lastMaintenance.date) : "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {[
                        c.lastMaintenance.hours != null && `${c.lastMaintenance.hours.toFixed(1)} h`,
                        c.lastMaintenance.km != null && `${c.lastMaintenance.km.toFixed(0)} km`,
                      ].filter(Boolean).join(" · ") || "sem leitura"}
                    </div>
                  </>
                : <div className="text-sm text-muted-foreground">Sem registro</div>}
            </MiniStat>
            <MiniStat title="Próxima prevista">
              {c.nextPrevision
                ? <>
                    {c.nextPrevision.hoursLeft != null && <div className="font-medium">{c.nextPrevision.hoursLeft.toFixed(1)} h</div>}
                    {c.nextPrevision.kmLeft != null && <div className="text-xs text-muted-foreground">{c.nextPrevision.kmLeft.toFixed(0)} km</div>}
                    {c.nextPrevision.daysLeft != null && <div className="text-xs text-muted-foreground">{c.nextPrevision.daysLeft} dias</div>}
                    {c.nextPrevision.hoursLeft == null && c.nextPrevision.kmLeft == null && c.nextPrevision.daysLeft == null && (
                      <div className="text-sm text-muted-foreground">—</div>
                    )}
                  </>
                : <div className="text-sm text-muted-foreground">—</div>}
            </MiniStat>
          </div>

          {/* Observações */}
          {c.notes && (
            <div className="mt-4 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
              {c.notes}
            </div>
          )}

          {/* Histórico */}
          <div className="mt-5">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-sm font-medium hover:bg-muted/40"
            >
              <span>Histórico deste componente ({c.history.length})</span>
              {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showHistory && (
              c.history.length === 0
                ? <div className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">Nenhuma manutenção registrada.</div>
                : <ul className="space-y-2">
                    {c.history.map((h) => (
                      <li key={h.eventId} className="rounded-xl border border-border bg-card p-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="truncate font-medium">{h.title}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(h.occurredAt)}</div>
                        </div>
                        <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                          {h.hoursAtEvent != null && <span>{h.hoursAtEvent.toFixed(1)} h</span>}
                          {h.kmAtEvent != null && <span>{h.kmAtEvent.toFixed(0)} km</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
            )}
          </div>

          {/* Personalização mínima */}
          {isOwner && (
            <div className="mt-5 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={togglePinned}>
                {c.pinned ? <><PinOff className="h-4 w-4" /> Desafixar</> : <><Pin className="h-4 w-4" /> Fixar</>}
              </Button>
              <Button size="sm" variant="outline" onClick={toggleHidden}>
                {c.hidden ? <><Eye className="h-4 w-4" /> Mostrar</> : <><EyeOff className="h-4 w-4" /> Ocultar</>}
              </Button>
              {c.rawStatus !== "not_applicable"
                ? <Button size="sm" variant="ghost" onClick={markNotApplicable}>Não se aplica</Button>
                : <Button size="sm" variant="outline" onClick={restoreDefault}><RotateCcw className="h-4 w-4" /> Restaurar</Button>}
              <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
                {editing ? "Fechar edição" : "Editar componente"}
              </Button>
            </div>
          )}

          {/* Editor inline */}
          {editing && isOwner && (
            <ComponentEditorInline
              scheduleId={c.scheduleId}
              initial={{
                name: c.name,
                category: c.category,
                interval_hours: null, // preenchido pelo banco via patch parcial
                interval_km: null,
                interval_days: null,
                notes: c.notes,
              }}
              onDone={() => { setEditing(false); qc.invalidateQueries(); }}
            />
          )}
        </SheetContent>
      </Sheet>

      {registerOpen && (
        <NewEventDialog
          moto={moto}
          preset={{ scheduleId: c.scheduleId, name: c.name, category: c.category }}
          open={registerOpen}
          onOpenChange={setRegisterOpen}
        />
      )}
    </>
  );
}

function MiniStat({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="mt-1 space-y-0.5">{children}</div>
    </div>
  );
}

function ComponentEditorInline({
  scheduleId, initial, onDone,
}: {
  scheduleId: string;
  initial: { name: string; category: MaintenanceCategory; interval_hours: number | null; interval_km: number | null; interval_days: number | null; notes: string | null };
  onDone: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [category, setCategory] = useState<MaintenanceCategory>(initial.category);
  const [h, setH] = useState<string>(initial.interval_hours?.toString() ?? "");
  const [km, setKm] = useState<string>(initial.interval_km?.toString() ?? "");
  const [d, setD] = useState<string>(initial.interval_days?.toString() ?? "");
  const [notes, setNotes] = useState<string>(initial.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("maintenance_schedules")
      .update({
        name: name.trim() || initial.name,
        category,
        interval_hours: h ? Number(h) : null,
        interval_km: km ? Number(km) : null,
        interval_days: d ? Number(d) : null,
        notes: notes.trim() || null,
      } as never)
      .eq("id", scheduleId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Componente atualizado.");
    onDone();
  }

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Nome</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Categoria</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as MaintenanceCategory)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(MAINT_CATEGORY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5"><Label className="text-xs">A cada (h)</Label><Input type="number" step="0.1" value={h} onChange={(e) => setH(e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">A cada (km)</Label><Input type="number" value={km} onChange={(e) => setKm(e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">A cada (dias)</Label><Input type="number" value={d} onChange={(e) => setD(e.target.value)} /></div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Observações</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>Cancelar</Button>
        <Button className="btn-glow" onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
      </div>
    </div>
  );
}