import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVENT_TYPE_LABEL, MAINT_CATEGORY_LABEL, uploadFile, type EventType, type Motorcycle, ACTIVITY_EVENT_TYPES } from "@/lib/trailbook";
import { Plus, Upload } from "lucide-react";
import { INCIDENT_TYPES } from "@/lib/motorcycle-catalog";
import { toast } from "sonner";

type SchedulePreset = {
  scheduleId: string;
  name: string;
  category: string;
};

export function NewEventDialog({
  moto,
  preset,
  open: controlledOpen,
  onOpenChange,
  triggerLabel,
}: {
  moto: Motorcycle;
  preset?: SchedulePreset;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  triggerLabel?: string;
}) {
  const qc = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => { onOpenChange ? onOpenChange(v) : setInternalOpen(v); };
  const [type, setType] = useState<EventType>(preset ? "maintenance" : "usage");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);

  useEffect(() => {
    if (preset && open) setType("maintenance");
  }, [preset, open]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const title = String(fd.get("title") || EVENT_TYPE_LABEL[type]);
      const description = String(fd.get("description") || "") || null;
      const location = String(fd.get("location") || "") || null;
      const hours_delta = fd.get("hours_delta") ? Number(fd.get("hours_delta")) : null;
      const km_delta = fd.get("km_delta") ? Number(fd.get("km_delta")) : null;
      const cost = fd.get("cost") ? Number(fd.get("cost")) : null;
      const occurred_at = fd.get("occurred_at") ? new Date(String(fd.get("occurred_at"))).toISOString() : new Date().toISOString();

      const newHours = Number(moto.hours_total) + (hours_delta ?? 0);
      const newKm = Number(moto.km_total) + (km_delta ?? 0);

      const { data: ev, error } = await supabase.from("events").insert({
        motorcycle_id: moto.id,
        created_by: uid,
        type,
        title,
        description,
        location,
        occurred_at,
        hours_delta,
        km_delta,
        hours_at_event: newHours,
        km_at_event: newKm,
        cost,
      }).select("id").single();
      if (error) throw error;

      // Maintenance item
      if (type === "maintenance" || type === "revision") {
        const category = String(fd.get("category") || preset?.category || "other");
        const service = String(fd.get("service") || title);
        const product = String(fd.get("product") || "") || null;
        const brand = String(fd.get("brand_used") || "") || null;
        await supabase.from("maintenance_items").insert({
          event_id: ev.id,
          category: category as any,
          service,
          product,
          brand,
        });

        // Atualiza a programação: explícita (preset) ou por nome.
        const targetIds: string[] = [];
        if (preset) targetIds.push(preset.scheduleId);
        else {
          const { data: match } = await supabase
            .from("maintenance_schedules")
            .select("id")
            .eq("motorcycle_id", moto.id)
            .eq("name", service);
          for (const m of match ?? []) targetIds.push(m.id);
        }
        if (targetIds.length > 0) {
          await supabase
            .from("maintenance_schedules")
            .update({
              last_done_at: occurred_at,
              last_done_hours: newHours,
              last_done_km: newKm,
              last_completed_event_id: ev.id,
              status: "active",
              snoozed_until: null,
            } as never)
            .in("id", targetIds);
        }
      }

      // Attachments
      if (files && files.length > 0) {
        const uploads = await Promise.all(Array.from(files).map(async (f) => {
          const up = await uploadFile("event-media", f, uid);
          const kind = f.type.startsWith("video/") ? "video" : f.type.startsWith("image/") ? "photo" : "document";
          return { event_id: ev.id, storage_path: up.path, bucket: up.bucket, kind: kind as any };
        }));
        await supabase.from("event_attachments").insert(uploads);
      }

      // Update motorcycle totals
      if (hours_delta || km_delta) {
        await supabase.from("motorcycles").update({ hours_total: newHours, km_total: newKm }).eq("id", moto.id);
      }

      toast.success(preset ? "Manutenção registrada e plano atualizado" : "Atividade registrada");
      setOpen(false);
      qc.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao registrar atividade");
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button className="btn-glow"><Plus className="h-4 w-4" /> {triggerLabel ?? "Registrar atividade"}</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{preset ? `Registrar manutenção concluída` : "Registrar atividade"}</DialogTitle>
          <DialogDescription>
            {preset
              ? `Preencha os dados do serviço executado em "${preset.name}". Isso atualiza o plano de manutenção, a linha do tempo e o índice de conservação.`
              : "Registre uso (trilha, passeio), manutenção, sinistro ou qualquer outra atividade da motocicleta."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <F label="Tipo">
            <Select value={type} onValueChange={(v) => setType(v as EventType)} disabled={!!preset}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIVITY_EVENT_TYPES.map((v) => <SelectItem key={v} value={v}>{EVENT_TYPE_LABEL[v]}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="Título"><Input name="title" placeholder={preset?.name || EVENT_TYPE_LABEL[type]} defaultValue={preset?.name} /></F>
          <F label="Data"><Input name="occurred_at" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} /></F>

          {(type === "maintenance" || type === "revision") && (
            <>
              <F label="Categoria">
                <Select name="category" defaultValue={preset?.category || "engine"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MAINT_CATEGORY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Serviço"><Input name="service" placeholder="ex: Troca de óleo" defaultValue={preset?.name} /></F>
                <F label="Produto"><Input name="product" placeholder="10W40" /></F>
              </div>
              <F label="Marca do produto"><Input name="brand_used" placeholder="Motul" /></F>
            </>
          )}

          {(type === "usage") && (
            <F label="Local"><Input name="location" placeholder="Serra da Cantareira" /></F>
          )}

          {type === "incident" && (
            <F label="Tipo de ocorrência">
              <Select name="incident_type" defaultValue="minor_fall">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
          )}

          <div className="grid grid-cols-3 gap-3">
            <F label="+ Horas"><Input name="hours_delta" type="number" step="0.1" placeholder="0" /></F>
            <F label="+ Km"><Input name="km_delta" type="number" step="1" placeholder="0" /></F>
            <F label="Custo R$"><Input name="cost" type="number" step="0.01" placeholder="0,00" /></F>
          </div>
          <F label="Observações"><Textarea name="description" rows={3} /></F>
          <F label="Fotos e vídeos do serviço (opcional)">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-card p-3 transition hover:border-primary/50">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Upload className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 text-sm">
                {files && files.length > 0
                  ? <span className="font-medium">{files.length} arquivo(s) selecionado(s)</span>
                  : <span className="text-muted-foreground">Selecionar imagens ou vídeos (documentos vão em Documentação)</span>}
              </div>
              <input type="file" multiple accept="image/*,video/*" className="sr-only" onChange={(e) => setFiles(e.target.files)} />
            </label>
          </F>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1 btn-glow" disabled={loading}>{loading ? "Salvando…" : "Registrar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}