import { useEffect, useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EVENT_TYPE_LABEL,
  MAINT_CATEGORY_LABEL,
  uploadFile,
  type EventType,
  type Motorcycle,
  ACTIVITY_EVENT_TYPES,
} from "@/lib/trailbook";
import { Plus, Upload, AlertTriangle, FileText, Wrench, CheckCheck } from "lucide-react";
import { INCIDENT_TYPES } from "@/lib/motorcycle-catalog";
import { fetchMaintenanceCatalog, type CatalogEntry } from "@/lib/maintenance-catalog";
import { toDecimalHours, recomposeTimeline } from "@/lib/activity-recalc";
import { attachDocumentsToEvent, isDocumentFile, DOC_ACCEPTED_MIME } from "@/lib/event-documents";
import { DOC_TYPES, type DocType } from "@/lib/motorcycle-documents";
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

const ACCESSORY_ACTIONS = [
  { value: "buy", label: "Compra de peça / acessório" },
  { value: "sell", label: "Venda de peça / acessório" },
  { value: "install", label: "Instalação" },
  { value: "remove", label: "Remoção" },
  { value: "replace", label: "Substituição" },
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
  const setOpen = (v: boolean) => {
    onOpenChange ? onOpenChange(v) : setInternalOpen(v);
  };
  const [type, setType] = useState<EventType>(preset ? "maintenance" : "usage");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const [docFiles, setDocFiles] = useState<FileList | null>(null);
  const [docType, setDocType] = useState<DocType>("other");
  const [accessoryAction, setAccessoryAction] = useState<string>("buy");
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>("");
  const [category, setCategory] = useState<string>(preset?.category || "engine");
  const [service, setService] = useState<string>(preset?.name || "");
  // v1.2.1 — vínculo estrito: usuário escolhe explicitamente quais itens
  // do plano da moto serão atualizados. Fonte única de verdade.
  const [affectedScheduleIds, setAffectedScheduleIds] = useState<string[]>(
    preset ? [preset.scheduleId] : [],
  );
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

  // Programações ativas da moto — a lista canônica de itens afetáveis.
  const motoSchedules = useQuery({
    queryKey: ["moto-schedules-for-event", moto.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("maintenance_schedules")
        .select("id, name, category, template_item_id, status, hidden")
        .eq("motorcycle_id", moto.id)
        .eq("active", true)
        .order("name");
      return (data ?? []).filter((s: any) => s.status !== "not_applicable" && !s.hidden);
    },
    enabled: open && (type === "maintenance" || type === "revision"),
  });

  useEffect(() => {
    if (preset && open) setType("maintenance");
  }, [preset, open]);

  useEffect(() => {
    // Reset campos quando trocar tipo — evita vazamento entre formulários.
    if (!preset) {
      setSelectedCatalogId("");
      // Revisão geral não fica presa a uma categoria — o campo some da UI
      // e gravamos "other" (Geral) no histórico. Manutenção parcial volta
      // ao padrão "engine" para o usuário escolher.
      setCategory(type === "revision" ? "other" : "engine");
      setService("");
      setAffectedScheduleIds([]);
    }
  }, [type, preset]);

  useEffect(() => {
    // "Revisão" = revisão geral por natureza: marca todos os componentes
    // ativos automaticamente, evitando o usuário ter que marcar item a
    // item. Ele ainda pode desmarcar algum manualmente se quiser.
    if (type === "revision" && !preset && motoSchedules.data && motoSchedules.data.length > 0) {
      setAffectedScheduleIds(motoSchedules.data.map((s: any) => s.id));
    }
  }, [type, preset, motoSchedules.data]);

  function pickCatalog(id: string) {
    setSelectedCatalogId(id);
    const item = catalog.data?.find((c) => c.id === id);
    if (item) {
      setCategory(item.category);
      setService(item.item_name);
      // Sugere automaticamente o schedule vinculado por template_item_id,
      // se existir na moto. Regra estrita: sem fallback por nome.
      const linked = (motoSchedules.data ?? []).filter((s: any) => s.template_item_id === item.id);
      if (linked.length > 0) {
        setAffectedScheduleIds((prev) => {
          const set = new Set(prev);
          linked.forEach((s: any) => set.add(s.id));
          return Array.from(set);
        });
      }
    }
  }

  function toggleAffected(id: string) {
    setAffectedScheduleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleAllAffected(ids: string[]) {
    setAffectedScheduleIds((prev) => (prev.length === ids.length ? [] : ids));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session!.user.id;
      const rawTitle = String(fd.get("title") || "").trim();
      const title = rawTitle || service || EVENT_TYPE_LABEL[type];
      let description = String(fd.get("description") || "").trim();
      const location = String(fd.get("location") || "") || null;
      // Fase 2: leitura atual é o padrão. TrailBook calcula o delta.
      let hours_delta: number | null = null;
      let km_delta: number | null = null;
      if (readingMode === "current") {
        // Auditoria v1.7: leitura atual precisa comparar com o total
        // PERSISTIDO agora, não com o cache/prop `moto.hours_total`
        // (que pode estar defasado se outra aba já registrou atividade).
        // Sem essa releitura, o delta gravado ficaria inflado (lost update).
        const { data: fresh, error: freshErr } = await supabase
          .from("motorcycles")
          .select("hours_total, km_total")
          .eq("id", moto.id)
          .single();
        if (freshErr || !fresh) {
          setLoading(false);
          return toast.error("Não foi possível confirmar o total atual da moto. Tente novamente.");
        }
        const hasHoursInput = currentHours !== "" || currentMinutes !== "";
        const hasKmInput = currentKm !== "";
        const curH = hasHoursInput
          ? toDecimalHours(Number(currentHours || 0), Number(currentMinutes || 0))
          : null;
        const curK = hasKmInput ? Number(currentKm) : null;
        if (curH != null) {
          if (!Number.isFinite(curH)) {
            setLoading(false);
            return toast.error("Horímetro atual inválido.");
          }
          const currentTotal = Number((fresh as any).hours_total);
          const d = curH - currentTotal;
          if (d < 0) {
            setLoading(false);
            return toast.error(
              `Horímetro atual (${curH}h) menor que o último registrado (${currentTotal}h). Atualize a tela e tente novamente.`,
            );
          }
          hours_delta = d;
        }
        if (curK != null) {
          if (!Number.isFinite(curK)) {
            setLoading(false);
            return toast.error("KM atual inválido.");
          }
          const currentTotal = Number((fresh as any).km_total);
          const d = curK - currentTotal;
          if (d < 0) {
            setLoading(false);
            return toast.error(
              `KM atual (${curK} km) menor que o último registrado (${currentTotal} km). Atualize a tela e tente novamente.`,
            );
          }
          km_delta = d;
        }
      } else {
        const hasHoursInput = deltaHours !== "" || deltaMinutes !== "";
        const hasKmInput = deltaKm !== "";
        if (hasHoursInput) {
          const v = toDecimalHours(Number(deltaHours || 0), Number(deltaMinutes || 0));
          if (!Number.isFinite(v) || v < 0) {
            setLoading(false);
            return toast.error("Duração inválida.");
          }
          hours_delta = v;
        }
        if (hasKmInput) {
          const v = Number(deltaKm);
          if (!Number.isFinite(v) || v < 0) {
            setLoading(false);
            return toast.error("Distância inválida.");
          }
          km_delta = v;
        }
      }
      const rawCost = fd.get("cost");
      const cost = rawCost != null && String(rawCost) !== "" ? Number(rawCost) : null;
      if (cost != null && !Number.isFinite(cost)) {
        setLoading(false);
        return toast.error("Custo inválido.");
      }
      const occurred_at = fd.get("occurred_at")
        ? new Date(String(fd.get("occurred_at"))).toISOString()
        : new Date().toISOString();

      // Enriquecimento de metadados por tipo — armazenado em description
      // para não exigir novas colunas no banco. Prefixado com tag legível.
      const meta: string[] = [];
      if (type === "accessory") {
        meta.push(
          `Ação: ${ACCESSORY_ACTIONS.find((a) => a.value === accessoryAction)?.label ?? accessoryAction}`,
        );
      }
      if (type === "usage") {
        const kind = String(fd.get("usage_kind") || "");
        const riders = String(fd.get("riders") || "");
        const conditions = String(fd.get("conditions") || "");
        if (kind)
          meta.push(`Tipo de uso: ${USAGE_KINDS.find((k) => k.value === kind)?.label ?? kind}`);
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
        if (inc)
          meta.push(`Ocorrência: ${INCIDENT_TYPES.find((i) => i.value === inc)?.label ?? inc}`);
        if (sev)
          meta.push(`Gravidade: ${INCIDENT_SEVERITY.find((s) => s.value === sev)?.label ?? sev}`);
      }
      if (meta.length) {
        description = meta.join(" · ") + (description ? `\n\n${description}` : "");
      }

      // v1.7 — INSERT do evento + recomposição atômica em UMA transação
      // no servidor, com advisory lock por moto. Snapshots hours_at_event/
      // km_at_event NÃO são mais calculados no cliente (eram fonte de
      // inconsistência ao usar `moto.hours_total` do cache). O servidor
      // grava os snapshots corretos após ordenar toda a linha do tempo.
      const { data: rpc, error } = await supabase.rpc(
        "commit_event_and_recompose" as never,
        {
          _moto: moto.id,
          _type: type,
          _title: title,
          _description: description || "",
          _location: location || "",
          _occurred_at: occurred_at,
          _hours_delta: hours_delta,
          _km_delta: km_delta,
          _cost: cost,
          _workshop_id: null,
          _metadata: type === "accessory" ? { accessory_action: accessoryAction } : {},
        } as never,
      );
      if (error) throw error;
      const rpcRow = Array.isArray(rpc) ? (rpc as any[])[0] : (rpc as any);
      if (!rpcRow?.event_id) throw new Error("Servidor não retornou o identificador da atividade");
      const ev = { id: rpcRow.event_id as string };

      // Maintenance item
      if (type === "maintenance" || type === "revision") {
        const cat = category || String(fd.get("category") || preset?.category || "other");
        const svc = service || String(fd.get("service") || title);
        const product = String(fd.get("product") || "") || null;
        const brand = String(fd.get("brand_used") || "") || null;

        // Vínculo estruturado: preferimos template_item_id (imune a rename).
        const templateItemId = selectedCatalogId || preset?.templateItemId || null;

        // v1.2.1 — Regra #8/#9/#10: SOMENTE os schedules explicitamente
        // selecionados pelo usuário serão atualizados. Sem fallback por
        // nome. Preset = 1 schedule direto; caso contrário, o usuário
        // marca no formulário quais itens do plano essa manutenção afeta.
        const targetIds: string[] = preset
          ? [preset.scheduleId]
          : Array.from(new Set(affectedScheduleIds));

        // Cada schedule mantém a PRÓPRIA categoria (motor, suspensão, freios…)
        // — importante numa revisão geral, onde os itens marcados pertencem
        // a categorias diferentes. Usar uma única categoria global para
        // todos gravaria histórico errado (ex: item de transmissão marcado
        // como "Suspensão" só porque era o valor selecionado no formulário).
        const categoryFor = (scheduleId: string) => {
          const s = (motoSchedules.data ?? []).find((x: any) => x.id === scheduleId);
          return (s?.category as string) ?? cat;
        };

        // Cria um maintenance_item por schedule afetado — histórico
        // individual por item (regra #12). Se nenhum foi vinculado,
        // ainda registra o item genérico sem schedule_id (visível no
        // histórico do evento, mas não em nenhum item do plano).
        if (targetIds.length > 0) {
          const { error: itemsErr } = await supabase.from("maintenance_items").insert(
            targetIds.map((sid) => ({
              event_id: ev.id,
              category: categoryFor(sid) as any,
              service: svc,
              product,
              brand,
              template_item_id: templateItemId,
              schedule_id: sid,
            })) as never,
          );
          if (itemsErr) throw new Error(itemsErr.message);
        } else {
          const { error: itemErr } = await supabase.from("maintenance_items").insert({
            event_id: ev.id,
            category: cat as any,
            service: svc,
            product,
            brand,
            template_item_id: templateItemId,
            schedule_id: null,
          } as never);
          if (itemErr) throw new Error(itemErr.message);
        }

        // v1.7: schedule last_done_* é atualizado pela recomposição final
        // abaixo, que lê o snapshot cronológico correto do evento no banco.
        // Aqui só normalizamos flags de estado dos schedules afetados.
        if (targetIds.length > 0) {
          const { error: schedErr } = await supabase
            .from("maintenance_schedules")
            .update({ status: "active", snoozed_until: null } as never)
            .in("id", targetIds);
          if (schedErr) throw new Error(schedErr.message);
        }
      }

      // Anexos de mídia (fotos/vídeos) — permanecem em event_attachments.
      if (files && files.length > 0) {
        const uploads: any[] = [];
        for (const f of Array.from(files)) {
          try {
            const up = await uploadFile("event-media", f, uid);
            const kind = f.type.startsWith("video/")
              ? "video"
              : f.type.startsWith("image/")
                ? "photo"
                : "document";
            uploads.push({ event_id: ev.id, storage_path: up.path, bucket: up.bucket, kind });
          } catch (e: any) {
            toast.error(`Falha ao enviar mídia ${f.name}`, { description: e?.message });
          }
        }
        if (uploads.length) await supabase.from("event_attachments").insert(uploads);
      }

      // Documentos — Central de Documentos como fonte única, vínculo N:N.
      if (docFiles && docFiles.length > 0) {
        const docs = Array.from(docFiles).filter(isDocumentFile);
        if (docs.length) {
          const results = await attachDocumentsToEvent({
            motorcycleId: moto.id,
            eventId: ev.id,
            userId: uid,
            files: docs,
            docType,
          });
          const okCount = results.filter((r) => r.ok).length;
          const reused = results.filter((r) => r.reused).length;
          const failed = results.filter((r) => !r.ok);
          if (reused) {
            toast.info(
              `${reused} documento(s) já estavam armazenados e foram apenas vinculados à atividade.`,
            );
          }
          if (okCount > reused && okCount - reused > 0) {
            toast.success(`${okCount - reused} documento(s) novo(s) adicionado(s) à Central.`);
          }
          if (failed.length) {
            toast.error(`${failed.length} documento(s) não foram enviados`, {
              description: failed.map((f) => `${f.file}: ${f.error}`).join(" · "),
            });
          }
        }
      }

      // v1.7: se acrescentamos maintenance_items depois do commit inicial,
      // rodamos uma segunda recomposição atômica para que os schedules
      // vinculados peguem os snapshots cronológicos exatos deste evento.
      // A operação é idempotente e barata (uma única transação serializada).
      if (type === "maintenance" || type === "revision") {
        await recomposeTimeline(moto.id);
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
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button className="btn-glow">
            <Plus className="h-4 w-4" /> {triggerLabel ?? "Registrar atividade"}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {preset ? `Registrar manutenção concluída` : "Registrar atividade"}
          </DialogTitle>
          <DialogDescription>
            {preset
              ? `Preencha os dados do serviço executado em "${preset.name}". Isso atualiza o plano de manutenção, a linha do tempo e o índice de conservação.`
              : "O formulário se adapta ao tipo escolhido. Manutenções atualizam plano, financeiro e alertas automaticamente."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="min-w-0 space-y-4">
          <F label="Tipo">
            <Select value={type} onValueChange={(v) => setType(v as EventType)} disabled={!!preset}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_EVENT_TYPES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {EVENT_TYPE_LABEL[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </F>
          <F label="Data">
            <Input
              name="occurred_at"
              type="datetime-local"
              defaultValue={new Date().toISOString().slice(0, 16)}
            />
          </F>

          {(type === "maintenance" || type === "revision") && (
            <>
              {!preset && (
                <F label="Serviço do catálogo (opcional)">
                  <Select value={selectedCatalogId} onValueChange={pickCatalog}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          catalog.isLoading ? "Carregando…" : "Escolher do catálogo padrão"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(catalog.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Selecione um item para preencher categoria e serviço automaticamente e vincular
                    ao plano.
                  </p>
                </F>
              )}
              {type === "maintenance" ? (
                <F label="Categoria">
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MAINT_CATEGORY_LABEL).map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    A lista de componentes abaixo mostra só os itens desta categoria.
                  </p>
                </F>
              ) : (
                !preset && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
                    Revisão geral — não fica presa a uma categoria só. Todos os componentes ativos
                    da moto entram nesta manutenção.
                  </div>
                )
              )}
              <div className="grid grid-cols-2 gap-3">
                <F label="Serviço">
                  <Input
                    name="service"
                    placeholder="ex: Troca de óleo"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                  />
                </F>
                <F label="Produto">
                  <Input name="product" placeholder="10W40" />
                </F>
              </div>
              <F label="Marca do produto">
                <Input name="brand_used" placeholder="Motul" />
              </F>

              {!preset &&
                (() => {
                  const allSchedules = motoSchedules.data ?? [];
                  const visibleSchedules =
                    type === "revision"
                      ? allSchedules
                      : allSchedules.filter((s: any) => s.category === category);
                  const visibleIds = visibleSchedules.map((s: any) => s.id);
                  const allVisibleSelected =
                    visibleIds.length > 0 &&
                    visibleIds.every((id: string) => affectedScheduleIds.includes(id));

                  return (
                    <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold uppercase tracking-widest text-primary">
                          Componentes afetados por esta manutenção
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {affectedScheduleIds.length} selecionado(s)
                        </span>
                      </div>

                      {type === "revision" && affectedScheduleIds.length > 0 && (
                        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
                          <CheckCheck className="mt-0.5 h-4 w-4 shrink-0" />
                          <span className="min-w-0 flex-1">
                            Revisão geral: {affectedScheduleIds.length} componente(s) serão
                            atualizados nesta data. Pode desmarcar algum abaixo se não se aplicar.
                          </span>
                        </div>
                      )}

                      {visibleIds.length > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant={allVisibleSelected ? "secondary" : "default"}
                          className="w-full gap-2"
                          onClick={() => toggleAllAffected(visibleIds)}
                        >
                          <Wrench className="h-4 w-4" />
                          {allVisibleSelected
                            ? "Desmarcar todos"
                            : type === "revision"
                              ? `Marcar todos os ${visibleIds.length} componentes`
                              : `Marcar todos os itens de ${MAINT_CATEGORY_LABEL[category as keyof typeof MAINT_CATEGORY_LABEL] ?? "categoria"}`}
                        </Button>
                      )}

                      <p className="text-[11px] text-muted-foreground">
                        Marque exatamente os componentes que esta manutenção atualiza. Nenhum outro
                        componente será tocado.
                      </p>
                      <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-background/50 p-2">
                        {visibleSchedules.length === 0 ? (
                          <p className="px-1 py-2 text-[11px] text-muted-foreground">
                            {allSchedules.length === 0
                              ? "Nenhuma programação ativa. A atividade será registrada sem vínculo."
                              : "Nenhum componente ativo nesta categoria."}
                          </p>
                        ) : (
                          visibleSchedules.map((s: any) => (
                            <label
                              key={s.id}
                              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                            >
                              <input
                                type="checkbox"
                                checked={affectedScheduleIds.includes(s.id)}
                                onChange={() => toggleAffected(s.id)}
                                className="h-4 w-4"
                              />
                              <span className="flex-1 truncate">{s.name}</span>
                              {type === "revision" && (
                                <span className="text-[10px] uppercase text-muted-foreground">
                                  {
                                    MAINT_CATEGORY_LABEL[
                                      s.category as keyof typeof MAINT_CATEGORY_LABEL
                                    ]
                                  }
                                </span>
                              )}
                            </label>
                          ))
                        )}
                      </div>
                      {affectedScheduleIds.length === 0 && allSchedules.length > 0 && (
                        <p className="text-[11px] text-amber-500">
                          Nenhum item marcado — a manutenção ficará no histórico mas não atualizará
                          nenhum item do plano.
                        </p>
                      )}
                    </div>
                  );
                })()}
            </>
          )}

          {type === "usage" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <F label="Tipo de uso">
                  <Select name="usage_kind" defaultValue="trilha">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {USAGE_KINDS.map((k) => (
                        <SelectItem key={k.value} value={k.value}>
                          {k.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </F>
                <F label="Participantes">
                  <Input name="riders" type="number" min="1" placeholder="1" />
                </F>
              </div>
              <F label="Local">
                <Input name="location" placeholder="Serra da Cantareira" />
              </F>
              <F label="Condições">
                <Input name="conditions" placeholder="ex: chuva, lama, seco" />
              </F>
            </>
          )}

          {type === "incident" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <F label="Ocorrência">
                  <Select name="incident_type" defaultValue="minor_fall">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INCIDENT_TYPES.map((i) => (
                        <SelectItem key={i.value} value={i.value}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </F>
                <F label="Gravidade">
                  <Select name="incident_severity" defaultValue="low">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INCIDENT_SEVERITY.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </F>
              </div>
              <F label="Local">
                <Input name="location" placeholder="ex: Trilha do Pico" />
              </F>
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <label className="flex-1 cursor-pointer space-y-1">
                  <span className="block font-medium">Confirmação necessária</span>
                  <span className="block text-[11px] opacity-80">
                    Este registro fica no histórico da moto e pode aparecer no certificado que você
                    compartilhar. Não inclua dados pessoais de terceiros (nome, CPF, telefone).
                  </span>
                  <span className="flex items-center gap-2 pt-1">
                    <input type="checkbox" name="lgpd_consent" className="h-3.5 w-3.5" />
                    <span>Entendi e quero registrar este sinistro.</span>
                  </span>
                </label>
              </div>
            </>
          )}

          {type === "accessory" && (
            <F label="Ação do acessório">
              <Select value={accessoryAction} onValueChange={setAccessoryAction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCESSORY_ACTIONS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </F>
          )}

          {(type === "accessory" ||
            type === "warranty" ||
            type === "recall" ||
            type === "note") && (
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
                <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
                  Informe o horímetro e/ou KM atual da moto. O TrailBook calcula automaticamente
                  quanto rodou desde o último registro
                  <span className="ml-1 opacity-70">
                    (atual: {Number(moto.hours_total).toFixed(1)}h ·{" "}
                    {Number(moto.km_total).toFixed(0)}km).
                  </span>
                </p>
                <div className="grid grid-cols-2 items-end gap-x-3 gap-y-3 sm:grid-cols-4">
                  <F label="Horímetro (h)">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      placeholder="0"
                      value={currentHours}
                      onChange={(e) => setCurrentHours(e.target.value)}
                    />
                  </F>
                  <F label="Minutos">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      max="59"
                      placeholder="0"
                      value={currentMinutes}
                      onChange={(e) => setCurrentMinutes(e.target.value)}
                    />
                  </F>
                  <F label="KM atual">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      placeholder="0"
                      value={currentKm}
                      onChange={(e) => setCurrentKm(e.target.value)}
                    />
                  </F>
                  <F label="Custo R$">
                    <Input name="cost" type="number" step="0.01" placeholder="0,00" />
                  </F>
                </div>
              </>
            ) : (
              <>
                <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
                  Modo alternativo — use quando não souber a leitura atual do horímetro/hodômetro.
                </p>
                <div className="grid grid-cols-2 items-end gap-x-3 gap-y-3 sm:grid-cols-4">
                  <F label="+ Horas">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      placeholder="0"
                      value={deltaHours}
                      onChange={(e) => setDeltaHours(e.target.value)}
                    />
                  </F>
                  <F label="Minutos">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      max="59"
                      placeholder="0"
                      value={deltaMinutes}
                      onChange={(e) => setDeltaMinutes(e.target.value)}
                    />
                  </F>
                  <F label="+ KM">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      placeholder="0"
                      value={deltaKm}
                      onChange={(e) => setDeltaKm(e.target.value)}
                    />
                  </F>
                  <F label="Custo R$">
                    <Input name="cost" type="number" step="0.01" placeholder="0,00" />
                  </F>
                </div>
              </>
            )}
          </div>
          <F label="Observações">
            <Textarea name="description" rows={3} />
          </F>
          <F label="Fotos e vídeos do serviço (opcional)">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-card p-3 transition hover:border-primary/50">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Upload className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 text-sm">
                {files && files.length > 0 ? (
                  <span className="font-medium">{files.length} arquivo(s) selecionado(s)</span>
                ) : (
                  <span className="text-muted-foreground">Selecionar imagens ou vídeos</span>
                )}
              </div>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                className="sr-only"
                onChange={(e) => setFiles(e.target.files)}
              />
            </label>
          </F>
          <div className="space-y-2 rounded-2xl border border-border/60 bg-background/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Documentos vinculados (opcional)
              </div>
              <span className="text-[10px] text-muted-foreground">
                Notas, orçamentos, garantias, laudos…
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <F label="Classificação">
                <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.icon} {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-card p-3 transition hover:border-primary/50">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 text-sm">
                {docFiles && docFiles.length > 0 ? (
                  <span className="font-medium">{docFiles.length} documento(s) selecionado(s)</span>
                ) : (
                  <span className="text-muted-foreground">
                    Selecionar PDF, Word, planilha, TXT/CSV…
                  </span>
                )}
              </div>
              <input
                type="file"
                multiple
                accept={DOC_ACCEPTED_MIME.join(",")}
                className="sr-only"
                onChange={(e) => setDocFiles(e.target.files)}
              />
            </label>
            <p className="text-[11px] text-muted-foreground">
              O documento vai para a Central de Documentos e fica vinculado a esta atividade. Se já
              estiver armazenado (mesmo arquivo), reaproveitamos sem novo envio.
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 btn-glow" disabled={loading}>
              {loading ? "Salvando…" : "Registrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  // Padrão TrailBook Design System — linha de campos:
  // • label uppercase, single-line (whitespace-nowrap) para nunca quebrar
  //   e desalinhar inputs vizinhos;
  // • min-h reserva altura consistente entre labels;
  // • space-y controla a distância label ↔ input de forma uniforme.
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label className="min-h-[1rem] truncate text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
