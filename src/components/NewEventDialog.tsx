import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVENT_TYPE_LABEL, MAINT_CATEGORY_LABEL, uploadFile, type EventType, type Motorcycle } from "@/lib/trailbook";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export function NewEventDialog({ moto }: { moto: Motorcycle }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<EventType>("usage");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);

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
        const category = String(fd.get("category") || "other");
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

        // Atualiza a programação correspondente (engine de regras)
        const { data: matchingSchedules } = await supabase
          .from("maintenance_schedules")
          .select("id")
          .eq("motorcycle_id", moto.id)
          .eq("name", service);
        if (matchingSchedules && matchingSchedules.length > 0) {
          await supabase
            .from("maintenance_schedules")
            .update({
              last_done_at: occurred_at,
              last_done_hours: newHours,
              last_done_km: newKm,
            })
            .in("id", matchingSchedules.map((s) => s.id));
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

      toast.success("Evento registrado");
      setOpen(false);
      qc.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao registrar evento");
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="btn-glow"><Plus className="h-4 w-4" /> Novo evento</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Registrar evento</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <F label="Tipo">
            <Select value={type} onValueChange={(v) => setType(v as EventType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(EVENT_TYPE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="Título"><Input name="title" placeholder={EVENT_TYPE_LABEL[type]} /></F>
          <F label="Data"><Input name="occurred_at" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} /></F>

          {(type === "maintenance" || type === "revision") && (
            <>
              <F label="Categoria">
                <Select name="category" defaultValue="engine">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MAINT_CATEGORY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Serviço"><Input name="service" placeholder="ex: Troca de óleo" /></F>
                <F label="Produto"><Input name="product" placeholder="10W40" /></F>
              </div>
              <F label="Marca do produto"><Input name="brand_used" placeholder="Motul" /></F>
            </>
          )}

          {(type === "usage") && (
            <F label="Local"><Input name="location" placeholder="Serra da Cantareira" /></F>
          )}

          <div className="grid grid-cols-3 gap-3">
            <F label="+ Horas"><Input name="hours_delta" type="number" step="0.1" placeholder="0" /></F>
            <F label="+ Km"><Input name="km_delta" type="number" step="1" placeholder="0" /></F>
            <F label="Custo R$"><Input name="cost" type="number" step="0.01" placeholder="0,00" /></F>
          </div>
          <F label="Observações"><Textarea name="description" rows={3} /></F>
          <F label="Anexos (fotos, vídeos, notas)">
            <Input type="file" multiple accept="image/*,video/*,application/pdf" onChange={(e) => setFiles(e.target.files)} />
          </F>
          <Button type="submit" className="w-full btn-glow" disabled={loading}>{loading ? "Salvando…" : "Registrar"}</Button>
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