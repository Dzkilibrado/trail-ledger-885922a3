import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { MAINT_CATEGORY_LABEL, type MaintenanceCategory } from "@/lib/trailbook";
import { SEVERITY_LABEL, type ComponentSeverity } from "@/lib/til/components";

type Status = "active" | "no_info" | "not_applicable";

const STATUS_LABEL: Record<Status, string> = {
  active: "Ativo",
  no_info: "Sem informação",
  not_applicable: "Não se aplica",
};

/**
 * Cria um COMPONENTE PERSONALIZADO para uma moto específica.
 * Marcado com `is_custom = true`. Não altera o Catálogo Mestre nem templates oficiais.
 */
export function NewComponentDialog({ motorcycleId, trigger }: { motorcycleId: string; trigger?: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<MaintenanceCategory>("other" as MaintenanceCategory);
  const [h, setH] = useState("");
  const [km, setKm] = useState("");
  const [d, setD] = useState("");
  const [notes, setNotes] = useState("");
  const [severity, setSeverity] = useState<ComponentSeverity>("medium");
  const [status, setStatus] = useState<Status>("active");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName(""); setH(""); setKm(""); setD(""); setNotes("");
    setSeverity("medium"); setStatus("active");
  }

  async function create() {
    if (!name.trim()) { toast.error("Informe um nome para o componente."); return; }
    setSaving(true);
    const { error } = await supabase.from("maintenance_schedules").insert({
      motorcycle_id: motorcycleId,
      name: name.trim(),
      category,
      interval_hours: h ? Number(h) : null,
      interval_km: km ? Number(km) : null,
      interval_days: d ? Number(d) : null,
      notes: notes.trim() || null,
      severity,
      status,
      is_custom: true,
      pinned: false,
      hidden: false,
    } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Componente personalizado adicionado.");
    reset();
    setOpen(false);
    qc.invalidateQueries();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline" size="sm"><Plus className="h-4 w-4" /> Adicionar componente</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar componente</DialogTitle>
          <DialogDescription>
            Crie um componente exclusivo desta moto — ideal para acessórios ou peças fora do catálogo padrão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Protetor de motor, GPS, Farol auxiliar" autoFocus />
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

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Status inicial</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Severidade</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as ComponentSeverity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SEVERITY_LABEL) as ComponentSeverity[]).map((s) => <SelectItem key={s} value={s}>{SEVERITY_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button className="btn-glow" onClick={create} disabled={saving}>
            {saving ? "Adicionando…" : "Adicionar componente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}