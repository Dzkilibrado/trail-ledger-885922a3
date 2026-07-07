import { useEffect, useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVENT_TYPE_LABEL, MAINT_CATEGORY_LABEL, uploadFile, type EventType, type Motorcycle, ACTIVITY_EVENT_TYPES } from "@/lib/trailbook";
import { Plus, Upload, AlertTriangle } from "lucide-react";
import { INCIDENT_TYPES } from "@/lib/motorcycle-catalog";
import { fetchMaintenanceCatalog, findSchedulesForCatalogItem, type CatalogEntry } from "@/lib/maintenance-catalog";
import { toDecimalHours } from "@/lib/activity-recalc";
import { toast } from "sonner";

type SchedulePreset = {
  scheduleId: string;
  name: string;
  category: string;
  templateItemId?: string | null;
};

const USAGE_KINDS = [
  { value: "trilha", label: "Trilha" },
  { value: "passeio", label: "Passeio" },
  { value: "treino", label: "Treino" },
  { value: "competicao", label: "Competição" },
  { value: "deslocamento", label: "Deslocamento" },
  { value: "outro", label: "Outro" },
];

const INCIDENT_SEVERITY = [
  { value: "low", label: "Leve" },
  { value: "medium", label: "Moderado" },
  { value: "high", label: "Grave" },
];

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
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>("");
  const [category, setCategory] = useState<string>(preset?.category || "engine");
  const [service, setService] = useState<string>(preset?.name || "");
  // Fase 2: leitura atual (padrão) vs delta manual (fallback).
  const [readingMode, setReadingMode] = useState<"current" | "delta">("current");
  const [currentHours, setCurrentHours] = useState<string>("");
  const [currentMinutes, setCurrentMinutes] = useState<string>("");
  const [currentKm, setCurrentKm] = useState<string>("");
  const [deltaHours, setDeltaHours] = useState<string>("");
  const [deltaMinutes, setDeltaMinutes] = useState<string>("");
  const [deltaKm, setDeltaKm] = useState<string>("");

  // Catálogo SSOT: itens do plano padrão (marca/modelo → default).
  const catalog = useQuery({
    queryKey: ["maintenance-catalog", moto.brand, moto.model],
    queryFn: () => fetchMaintenanceCatalog(moto.brand, moto.model),
    enabled: open && (type === "maintenance" || type === "revision"),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (preset && open) setType("maintenance");
  }, [preset, open]);

  useEffect(() => {
    // Reset campos quando trocar tipo — evita vazamento entre formulários.
    if (!preset) {
      setSelectedCatalogId("");
      setCategory("engine");
      setService("");
    }
  }, [type, preset]);

  function pickCatalog(id: string) {
    setSelectedCatalogId(id);
    const item = catalog.data?.find((c) => c.id === id);
    if (item) {
      setCategory(item.category);
      setService(item.item_name);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const rawTitle = String(fd.get("title") || "").trim();
      const title = rawTitle || service || EVENT_TYPE_LABEL[type];
      let description = String(fd.get("description") || "").trim();
      const location = String(fd.get("location") || "") || null;
      // Fase 2: leitura atual é o padrão. TrailBook calcula o delta.
      let hours_delta: number | null = null;
      let km_delta: number | null = null;
      if (readingMode === "current") {
        const curH = currentHours || currentMinutes
          ? toDecimalHours(Number(currentHours || 0), Number(currentMinutes || 0))
          : null;
        const curK = currentKm ? Number(currentKm) : null;
        if (curH != null) {
          const d = curH - Number(moto.hours_total);
          if (d < 0) { setLoading(false); return toast.error("Horímetro atual não pode ser menor que o último registro."); }
          hours_delta = d;
        }
        if (curK != null) {
          const d = curK - Number(moto.km_total);
          if (d < 0) { setLoading(false); return toast.error("KM atual não pode ser menor que o último registro."); }
          km_delta = d;
        }
      } else {
        hours_delta = (deltaHours || deltaMinutes)
          ? toDecimalHours(Number(deltaHours || 0), Number(deltaMinutes || 0))
          : null;
        km_delta = deltaKm ? Number(deltaKm) : null;
      }
      const cost = fd.get("cost") ? Number(fd.get("cost")) : null;
      const occurred_at = fd.get("occurred_at") ? new Date(String(fd.get("occurred_at"))).toISOString() : new Date().toISOString();

      const newHours = Number(moto.hours_total) + (hours_delta ?? 0);
      const newKm = Number(moto.km_total) + (km_delta ?? 0);

      // Enriquecimento de metadados por tipo — armazenado em description
      // para não exigir novas colunas no banco. Prefixado com tag legível.
      const meta: string[] = [];
      if (type === "usage") {
        const kind = String(fd.get("usage_kind") || "");
        const riders = String(fd.get("riders") || "");
        const conditions = String(fd.get("conditions") || "");
        if (kind) meta.push(`Tipo de uso: ${USAGE_KINDS.find((k) => k.value === kind)?.label ?? kind}`);
        if (riders) meta.push(`Participantes: ${riders}`);
        if (conditions) meta.push(`Condições: ${conditions}`);
      }
      if (type === "incident") {
        const inc = String(fd.get("incident_type") || "");
        const sev = String(fd.get("incident_severity") || "");
        const consent = fd.get("lgpd_consent") === "on";
        if (!consent) {
          setLoading(false);
          return toast.error("É necessário confirmar a ciência de LGPD para registrar sinistro.");
        }
        if (inc) meta.push(`Ocorrência: ${INCIDENT_TYPES.find((i) => i.value === inc)?.label ?? inc}`);
        if (sev) meta.push(`Gravidade: ${INCIDENT_SEVERITY.find((s) => s.value === sev)?.label ?? sev}`);
      }
      if (meta.length) {
        description = meta.join(" · ") + (description ? `\n\n${description}` : "");
      }

      const { data: ev, error } = await supabase.from("events").insert({
        motorcycle_id: moto.id,
        created_by: uid,
        type,
        title,
        description: description || null,
        location,
        occurred_at,
        hours_delta,
        km_delta,
        hours_at_event: newHours,
        km_at_event: newKm,
        cost,
      }).select("id").single();
      if (error) throw error;

      // Auditoria: registro de criação da atividade
      await supabase.from("audit_log").insert({
        table_name: "events",
        record_id: ev.id,
        motorcycle_id: moto.id,
        actor_id: uid,
        action: "insert",
        new_values: {
          type, title, occurred_at, hours_delta, km_delta,
          hours_at_event: newHours, km_at_event: newKm, cost,
        },
      } as never);

      // Maintenance item
      if (type === "maintenance" || type === "revision") {
        const cat = category || String(fd.get("category") || preset?.category || "other");
        const svc = service || String(fd.get("service") || title);
        const product = String(fd.get("product") || "") || null;
        const brand = String(fd.get("brand_used") || "") || null;

        // Vínculo estruturado: preferimos template_item_id (imune a rename).
        const templateItemId = selectedCatalogId || preset?.templateItemId || null;

        // Integração automática: atualiza a programação vinculada.
        //   1) Preset → usa ID direto do schedule.
        //   2) Catálogo escolhido → casa por template_item_id.
        //   3) Fallback → casa por nome/substring.
        const targetIds: string[] = [];
        if (preset) targetIds.push(preset.scheduleId);
        else {
          const ids = await findSchedulesForCatalogItem(moto.id, {
            templateItemId,
            itemName: svc,
          });
          targetIds.push(...ids);
        }

        await supabase.from("maintenance_items").insert({
          event_id: ev.id,
          category: cat as any,
          service: svc,
          product,
          brand,
          template_item_id: templateItemId,
          schedule_id: targetIds[0] ?? null,
        } as never);

        // Só atualiza schedules quando houve vínculo estruturado
        // (preset direto OU catálogo escolhido OU nome que casa exatamente).
        // Sem vínculo → nada é atualizado (evita replicar em outros itens).
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

      // Integração cross-módulo: refresca dashboard, financeiro, plano,
      // histórico e alertas. invalidateQueries() sem filtro força todos os
      // consumidores das queries a rebuscarem — barato porque tudo já usa
      // React Query com chaves declaradas.
      toast.success(
        preset
          ? "Manutenção registrada. Plano, histórico e financeiro atualizados."
          : type === "incident"
            ? "Sinistro registrado no histórico."
            : "Atividade registrada.",
      );
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
              : "O formulário se adapta ao tipo escolhido. Manutenções atualizam plano, financeiro e alertas automaticamente."}
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
          <F label="Data"><Input name="occurred_at" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} /></F>

          {(type === "maintenance" || type === "revision") && (
            <>
              {!preset && (
                <F label="Serviço do catálogo (opcional)">
                  <Select value={selectedCatalogId} onValueChange={pickCatalog}>
                    <SelectTrigger>
                      <SelectValue placeholder={catalog.isLoading ? "Carregando…" : "Escolher do catálogo padrão"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(catalog.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Selecione um item para preencher categoria e serviço automaticamente e vincular ao plano.
                  </p>
                </F>
              )}
              <F label="Categoria">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MAINT_CATEGORY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Serviço">
                  <Input
                    name="service"
                    placeholder="ex: Troca de óleo"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                  />
                </F>
                <F label="Produto"><Input name="product" placeholder="10W40" /></F>
              </div>
              <F label="Marca do produto"><Input name="brand_used" placeholder="Motul" /></F>
            </>
          )}

          {type === "usage" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <F label="Tipo de uso">
                  <Select name="usage_kind" defaultValue="trilha">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {USAGE_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </F>
                <F label="Participantes"><Input name="riders" type="number" min="1" placeholder="1" /></F>
              </div>
              <F label="Local"><Input name="location" placeholder="Serra da Cantareira" /></F>
              <F label="Condições"><Input name="conditions" placeholder="ex: chuva, lama, seco" /></F>
            </>
          )}

          {type === "incident" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <F label="Ocorrência">
                  <Select name="incident_type" defaultValue="minor_fall">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INCIDENT_TYPES.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </F>
                <F label="Gravidade">
                  <Select name="incident_severity" defaultValue="low">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INCIDENT_SEVERITY.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </F>
              </div>
              <F label="Local"><Input name="location" placeholder="ex: Trilha do Pico" /></F>
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <label className="flex-1 cursor-pointer space-y-1">
                  <span className="block font-medium">Confirmação necessária</span>
                  <span className="block text-[11px] opacity-80">
                    Este registro fica no histórico da moto e pode aparecer no certificado que você compartilhar. Não inclua dados pessoais de terceiros (nome, CPF, telefone).
                  </span>
                  <span className="flex items-center gap-2 pt-1">
                    <input type="checkbox" name="lgpd_consent" className="h-3.5 w-3.5" />
                    <span>Entendi e quero registrar este sinistro.</span>
                  </span>
                </label>
              </div>
            </>
          )}

          {(type === "accessory" || type === "warranty" || type === "recall" || type === "purchase" || type === "sale" || type === "note") && (
            <F label={type === "note" ? "Título" : "Descrição breve"}>
              <Input name="title" placeholder={EVENT_TYPE_LABEL[type]} />
            </F>
          )}

          <div className="space-y-3 rounded-2xl border border-border/60 bg-background/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Uso da moto neste registro
              </div>
              <div className="flex gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setReadingMode("current")}
                  className={`rounded-full border px-2 py-0.5 ${readingMode === "current" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                >
                  Leitura atual
                </button>
                <button
                  type="button"
                  onClick={() => setReadingMode("delta")}
                  className={`rounded-full border px-2 py-0.5 ${readingMode === "delta" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                >
                  Informar horas/KM utilizados
                </button>
              </div>
            </div>
            {readingMode === "current" ? (
              <>
                <p className="text-[11px] text-muted-foreground">
                  Informe o horímetro e/ou KM atual da moto. O TrailBook calcula automaticamente
                  quanto rodou desde o último registro
                  <span className="ml-1 opacity-70">
                    (atual: {Number(moto.hours_total).toFixed(1)}h · {Number(moto.km_total).toFixed(0)}km).
                  </span>
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <F label="Horímetro atual (h)">
                    <Input type="number" step="1" min="0" placeholder="0"
                      value={currentHours} onChange={(e) => setCurrentHours(e.target.value)} />
                  </F>
                  <F label="Minutos">
                    <Input type="number" step="1" min="0" max="59" placeholder="0"
                      value={currentMinutes} onChange={(e) => setCurrentMinutes(e.target.value)} />
                  </F>
                  <F label="KM atual">
                    <Input type="number" step="1" min="0" placeholder="0"
                      value={currentKm} onChange={(e) => setCurrentKm(e.target.value)} />
                  </F>
                  <F label="Custo R$">
                    <Input name="cost" type="number" step="0.01" placeholder="0,00" />
                  </F>
                </div>
              </>
            ) : (
              <>
                <p className="text-[11px] text-muted-foreground">
                  Modo alternativo — use quando não souber a leitura atual do horímetro/hodômetro.
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <F label="+ Horas">
                    <Input type="number" step="1" min="0" placeholder="0"
                      value={deltaHours} onChange={(e) => setDeltaHours(e.target.value)} />
                  </F>
                  <F label="Minutos">
                    <Input type="number" step="1" min="0" max="59" placeholder="0"
                      value={deltaMinutes} onChange={(e) => setDeltaMinutes(e.target.value)} />
                  </F>
                  <F label="+ KM">
                    <Input type="number" step="1" min="0" placeholder="0"
                      value={deltaKm} onChange={(e) => setDeltaKm(e.target.value)} />
                  </F>
                  <F label="Custo R$">
                    <Input name="cost" type="number" step="0.01" placeholder="0,00" />
                  </F>
                </div>
              </>
            )}
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