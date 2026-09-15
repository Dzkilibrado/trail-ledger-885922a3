import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import {
  Search,
  Plus,
  X,
  ChevronRight,
  Wrench,
  Clock,
  Check,
  ArrowLeft,
  Map,
  FileText,
  Paperclip,
  ListChecks,
  BookMarked,
  Pencil,
  Trash2,
  Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useModule } from "@/hooks/useModules";
import { useUserItemLibrary } from "@/hooks/useUserItemLibrary";
import type { UserItemLibraryEntry, NewUserItemLibraryEntry } from "@/hooks/useUserItemLibrary";
import { MAINT_CATEGORY_LABEL, type MaintenanceCategory } from "@/lib/trailbook";
import { cn } from "@/lib/utils";
import { MotoMap } from "@/components/MotoMap";
import { OcrUploader } from "@/components/OcrUploader";

// ============================================================
// Rota
// ============================================================
const searchSchema = z.object({
  preset_schedule: z.string().optional(),
  preset_category: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/motorcycles/$id/registrar-manutencao")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Registrar manutenção — TrailBook" }] }),
  component: RegistrarManutencao,
});

// ============================================================
// Tipos internos
// ============================================================
type ItemKind = "technical" | "labor" | "expense";

interface MaintenanceItem {
  localId: string; // ID temporário apenas para a UI
  scheduleId?: string; // Se vinculado a um schedule
  templateItemId?: string;
  category: MaintenanceCategory;
  service: string;
  itemKind: ItemKind;
  product?: string;
  brand?: string;
  qty?: number;
  unitValue?: number;
}

type Step = "items" | "details" | "confirm";

// ============================================================
// Labels e ícones de categoria
const CATEGORY_ICON: Record<MaintenanceCategory, string> = {
  engine: "🔧",
  suspension: "🔩",
  brakes: "🛑",
  transmission: "⛓",
  wheels: "🛞",
  electrical: "⚡",
  cooling: "🌡",
  other: "🔩",
};

// Palavras-chave para inferência automática de item_kind = labor
const LABOR_KEYWORDS = [
  "mão de obra",
  "mao de obra",
  "m.o.",
  "mao-de-obra",
  "serviço",
  "servico",
  "instalac",
  "montagem",
  "desmontagem",
  "alinhamento",
  "balanceamento",
  "diagnóstico",
  "diagnostico",
  "revisão geral",
  "revisao geral",
  "lavagem",
  "regulagem",
];

function inferItemKind(service: string): ItemKind {
  const lower = service.toLowerCase();
  if (LABOR_KEYWORDS.some((kw) => lower.includes(kw))) return "labor";
  return "technical";
}

// ============================================================
// Componente principal
// ============================================================
function RegistrarManutencao() {
  const { id: motoId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ---- estado global do formulário ----
  const [step, setStep] = useState<Step>("items");
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 16));
  const [workshopId, setWorkshopId] = useState<string>("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [currentHours, setCurrentHours] = useState("");
  const [currentKm, setCurrentKm] = useState("");
  const [costAdjustment, setCostAdjustment] = useState("");
  const [attachedDoc, setAttachedDoc] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // ---- dados da moto ----
  const moto = useQuery({
    queryKey: ["motorcycle", motoId, "basic"],
    queryFn: async () => {
      const { data } = await supabase
        .from("motorcycles")
        .select("id, nickname, model, brand, hours_total, km_total")
        .eq("id", motoId)
        .single();
      return data;
    },
    staleTime: 30_000,
  });

  // ---- schedules ativos da moto (para sugestões do catálogo) ----
  const schedules = useQuery({
    queryKey: ["moto-schedules", motoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("maintenance_schedules")
        .select("id, name, category, template_item_id, status")
        .eq("motorcycle_id", motoId)
        .not("status", "in", '("done","ignored","not_applicable")')
        .order("category")
        .order("name");
      return data ?? [];
    },
    staleTime: 60_000,
  });

  // ---- oficinas ----
  const workshops = useQuery({
    queryKey: ["workshops-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("workshops_public")
        .select("id, name, city, state")
        .order("name")
        .limit(100);
      return data ?? [];
    },
    staleTime: 300_000,
  });

  // ---- custo total calculado ----
  const costItems = useMemo(
    () => items.reduce((s, it) => s + (it.qty ?? 1) * (it.unitValue ?? 0), 0),
    [items],
  );
  const costTotal = costItems + (parseFloat(costAdjustment) || 0);

  // ============================================================
  // Passo 1 — Itens
  // ============================================================
  if (step === "items") {
    return (
      <ItemsStep
        motoId={motoId}
        motoName={moto.data?.nickname || moto.data?.model || "Moto"}
        schedules={schedules.data ?? []}
        items={items}
        onItemsChange={setItems}
        onNext={() => setStep("details")}
        onBack={() =>
          navigate({ to: "/motorcycles/$id/control" as never, params: { id: motoId } as never })
        }
      />
    );
  }

  // ============================================================
  // Passo 2 — Detalhes
  // ============================================================
  if (step === "details") {
    return (
      <DetailsStep
        moto={moto.data}
        items={items}
        costItems={costItems}
        costTotal={costTotal}
        occurredAt={occurredAt}
        currentHours={currentHours}
        currentKm={currentKm}
        costAdjustment={costAdjustment}
        workshopId={workshopId}
        workshops={workshops.data ?? []}
        location={location}
        description={description}
        attachedDoc={attachedDoc}
        onOccurredAt={setOccurredAt}
        onCurrentHours={setCurrentHours}
        onCurrentKm={setCurrentKm}
        onCostAdjustment={setCostAdjustment}
        onWorkshopId={setWorkshopId}
        onLocation={setLocation}
        onDescription={setDescription}
        onAttachedDoc={setAttachedDoc}
        onBack={() => setStep("items")}
        onNext={() => setStep("confirm")}
      />
    );
  }

  // ============================================================
  // Passo 3 — Confirmação e gravação
  // ============================================================
  async function save() {
    setSaving(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) throw new Error("Sessão inválida");

      // Calcular deltas
      const { data: fresh } = await supabase
        .from("motorcycles")
        .select("hours_total, km_total")
        .eq("id", motoId)
        .single();

      let hours_delta: number | null = null;
      let km_delta: number | null = null;

      if (currentHours !== "" && fresh) {
        const curH = parseFloat(currentHours);
        const d = curH - Number((fresh as any).hours_total ?? 0);
        if (d < 0) {
          toast.error("Horímetro menor que o último registrado");
          setSaving(false);
          return;
        }
        hours_delta = d;
      }
      if (currentKm !== "" && fresh) {
        const curK = parseFloat(currentKm);
        const d = curK - Number((fresh as any).km_total ?? 0);
        if (d < 0) {
          toast.error("KM menor que o último registrado");
          setSaving(false);
          return;
        }
        km_delta = d;
      }

      const title =
        items.length === 1
          ? items[0].service
          : `Manutenção — ${items.length} item${items.length > 1 ? "s" : ""}`;

      const itemsUpsert = items.map((it) => ({
        service: it.service,
        item_kind: it.itemKind,
        category: it.category,
        product: it.product || null,
        brand: it.brand || null,
        qty: it.qty ?? null,
        unit_value: it.unitValue ?? null,
        schedule_id: it.scheduleId || null,
        template_item_id: it.templateItemId || null,
      }));

      const { data: rpcData, error } = await supabase.rpc(
        "update_maintenance_and_recompose" as never,
        {
          _event_id: null,
          _moto_id: motoId,
          _type: "maintenance",
          _title: title,
          _occurred_at: new Date(occurredAt).toISOString(),
          _hours_delta: hours_delta,
          _km_delta: km_delta,
          _cost_adjustment: parseFloat(costAdjustment) || null,
          _workshop_id: workshopId || null,
          _location: location || null,
          _description: description || null,
          _items_upsert: itemsUpsert,
          _items_delete: [],
        } as never,
      );

      if (error) throw error;

      const savedEventId = (rpcData as any)?.[0]?.event_id ?? null;

      // Salva e vincula o documento ao evento
      if (attachedDoc) {
        try {
          const { uploadFile } = await import("@/lib/trailbook");
          const { path } = await uploadFile("documents", attachedDoc, uid);
          const { data: docData } = await supabase
            .from("motorcycle_documents" as never)
            .insert({
              motorcycle_id: motoId,
              doc_type: "workshop_receipt",
              bucket: "documents",
              storage_path: path,
              file_name: attachedDoc.name,
              mime_type: attachedDoc.type || null,
              size_bytes: attachedDoc.size,
              created_by: uid,
              version: 1,
              is_current: true,
              is_origin_document: false,
              notes: "Documento da manutenção",
            } as never)
            .select("id")
            .single();

          // Vincula o documento ao evento via event_documents
          if (savedEventId && (docData as any)?.id) {
            await supabase.from("event_documents" as never).insert({
              event_id: savedEventId,
              document_id: (docData as any).id,
              created_by: uid,
            } as never);
          }
        } catch {
          toast.warning("Manutenção salva, mas o documento não foi anexado.", {
            description: "Você pode anexar depois em Documentos.",
          });
        }
      }

      await qc.invalidateQueries();
      toast.success("Manutenção registrada com sucesso!");
      navigate({ to: "/motorcycles/$id/control" as never, params: { id: motoId } as never });
    } catch (err: any) {
      toast.error("Não foi possível registrar a manutenção", {
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  }

  // Tela de confirmação
  return (
    <div className="mx-auto w-full max-w-xl space-y-5 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => setStep("details")} className="rounded-lg p-1.5 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold">Confirmar manutenção</h1>
          <p className="text-sm text-muted-foreground">Revise antes de salvar</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Itens ({items.length})
        </h2>

        {/* Materiais */}
        {items.filter((it) => it.itemKind !== "labor" && it.itemKind !== "expense").length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Materiais / Peças
            </p>
            {items
              .filter((it) => it.itemKind !== "labor" && it.itemKind !== "expense")
              .map((it) => (
                <div key={it.localId} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{it.service}</p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_ICON[it.category]} {MAINT_CATEGORY_LABEL[it.category]}
                    </p>
                  </div>
                  {it.unitValue ? (
                    <span className="shrink-0 text-sm font-semibold">
                      R$ {((it.qty ?? 1) * it.unitValue).toFixed(2)}
                    </span>
                  ) : null}
                </div>
              ))}
          </div>
        )}

        {/* Serviços */}
        {items.filter((it) => it.itemKind === "labor").length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Serviços / Mão de obra
            </p>
            {items
              .filter((it) => it.itemKind === "labor")
              .map((it) => (
                <div key={it.localId} className="flex items-center justify-between gap-2 text-sm">
                  <p className="font-medium truncate min-w-0">{it.service}</p>
                  {it.unitValue ? (
                    <span className="shrink-0 text-sm font-semibold">
                      R$ {((it.qty ?? 1) * it.unitValue).toFixed(2)}
                    </span>
                  ) : null}
                </div>
              ))}
          </div>
        )}

        {/* Totais separados */}
        {costTotal > 0 &&
          (() => {
            const totalMat = items
              .filter((it) => it.itemKind === "technical")
              .reduce((s, it) => s + (it.qty ?? 1) * (it.unitValue ?? 0), 0);
            const totalSvc = items
              .filter((it) => it.itemKind === "labor")
              .reduce((s, it) => s + (it.qty ?? 1) * (it.unitValue ?? 0), 0);
            return (
              <div className="border-t border-border pt-2 space-y-1">
                {totalMat > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Total materiais</span>
                    <span>R$ {totalMat.toFixed(2)}</span>
                  </div>
                )}
                {totalSvc > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Total serviços</span>
                    <span>R$ {totalSvc.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-1 border-t border-border">
                  <span>Total da OS</span>
                  <span>R$ {costTotal.toFixed(2)}</span>
                </div>
              </div>
            );
          })()}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-2 text-sm">
        <p>
          <span className="text-muted-foreground">Data: </span>
          {new Date(occurredAt).toLocaleDateString("pt-BR")}
        </p>
        {currentHours && (
          <p>
            <span className="text-muted-foreground">Horímetro: </span>
            {currentHours} h
          </p>
        )}
        {currentKm && (
          <p>
            <span className="text-muted-foreground">KM: </span>
            {currentKm} km
          </p>
        )}
        {workshopId && workshops.data && (
          <p>
            <span className="text-muted-foreground">Oficina: </span>
            {workshops.data.find((w) => w.id === workshopId)?.name ?? "—"}
          </p>
        )}
        {location && (
          <p>
            <span className="text-muted-foreground">Local: </span>
            {location}
          </p>
        )}
        {description && (
          <p>
            <span className="text-muted-foreground">Obs: </span>
            {description}
          </p>
        )}
      </div>

      <Button
        onClick={save}
        disabled={saving || items.length === 0}
        className="w-full btn-glow text-base"
        size="lg"
      >
        {saving ? "Salvando…" : "Confirmar e salvar"}
      </Button>
    </div>
  );
}

// ============================================================
// Passo 1 — Adicionar itens
// ============================================================
function ItemsStep({
  motoId,
  motoName,
  schedules,
  items,
  onItemsChange,
  onNext,
  onBack,
}: {
  motoId: string;
  motoName: string;
  schedules: any[];
  items: MaintenanceItem[];
  onItemsChange: (items: MaintenanceItem[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<
    "menu" | "search" | "catalog" | "map" | "ocr" | "addItem" | "generalMaint" | "myItems" | "addItemFromLibrary"
  >("menu");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<MaintenanceCategory | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<MaintenanceItem> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Controle granular pelo painel admin — cada opção pode ser
  // habilitada, desabilitada ou colocada em manutenção individualmente
  const modBusca = useModule("manut_busca");
  const modCatalogo = useModule("manut_catalogo");
  const modMapa = useModule("manut_mapa");
  const modOcr = useModule("manut_ocr");
  const modGeral = useModule("manut_geral");
  const modMeusItens = useModule("manut_meus_itens");

  // Biblioteca pessoal — carregada uma vez e integrada à Busca e ao Catálogo.
  // Só carrega quando manut_meus_itens está ativo/beta — respeita ModuleGate.
  // A RLS do banco garante que só retorna itens do auth.uid() com deleted_at IS NULL.
  const meusItensAtivo = modMeusItens.status === "active" || modMeusItens.status === "beta";
  const { items: libraryQuery } = useUserItemLibrary(meusItensAtivo ? undefined : "__disabled__");
  const libraryItems = meusItensAtivo ? (libraryQuery.data ?? []) : [];

  const isActive = (s: string) => s === "active";
  const isMaint = (s: string) => s === "maintenance";

  const filteredSchedules = useMemo(() => {
    if (selectedCategory) return schedules.filter((s) => s.category === selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return schedules.filter((s) => s.name.toLowerCase().includes(q));
    }
    return schedules;
  }, [schedules, selectedCategory, searchQuery]);

  // Itens pessoais filtrados por busca — usados em Buscar e Catálogo
  const filteredLibraryItems = useMemo(() => {
    if (!meusItensAtivo) return [];
    if (selectedCategory) {
      return libraryItems.filter((it) => it.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return libraryItems.filter((it) => it.description.toLowerCase().includes(q));
    }
    return libraryItems;
  }, [libraryItems, selectedCategory, searchQuery, meusItensAtivo]);

  function addItem(partial: Partial<MaintenanceItem>) {
    const newItem: MaintenanceItem = {
      localId: crypto.randomUUID(),
      category: partial.category ?? "other",
      service: partial.service ?? "",
      itemKind: partial.itemKind ?? inferItemKind(partial.service ?? ""),
      scheduleId: partial.scheduleId,
      templateItemId: partial.templateItemId,
      product: partial.product,
      brand: partial.brand,
      qty: partial.qty,
      unitValue: partial.unitValue,
    };
    onItemsChange([...items, newItem]);
  }

  function removeItem(localId: string) {
    onItemsChange(items.filter((it) => it.localId !== localId));
  }

  // ---- menu inicial ----
  if (mode === "menu") {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4 pb-24">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="rounded-lg p-1.5 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-bold">O que foi feito?</h1>
            <p className="text-sm text-muted-foreground">{motoName}</p>
          </div>
        </div>

        {/* Lista de itens + botão Continuar */}
        {items.length > 0 ? (
          <>
            <div className="space-y-2">
              {items.map((it) => (
                <div
                  key={it.localId}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-sm">{it.service}</p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_ICON[it.category]} {MAINT_CATEGORY_LABEL[it.category]}
                      {it.unitValue ? ` · R$ ${((it.qty ?? 1) * it.unitValue).toFixed(2)}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => removeItem(it.localId)}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button onClick={onNext} className="w-full btn-glow text-base" size="lg">
              Continuar com {items.length} item{items.length > 1 ? "s" : ""}
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-2 text-muted-foreground">ou adicionar mais</span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            Selecione o que foi feito nesta manutenção
          </p>
        )}

        {/* Grid simétrico 2×N — todos os cards com mesmo componente e dimensões */}
        <div className="grid grid-cols-2 gap-3">
          {/* Buscar */}
          {modBusca.status !== "disabled" && (
            <MenuCard
              icon={<Search className="h-6 w-6" />}
              title="Buscar"
              desc={isMaint(modBusca.status) ? "Em manutenção" : "Encontre rapidamente um item"}
              disabled={isMaint(modBusca.status)}
              onClick={() => {
                if (!isMaint(modBusca.status)) {
                  setMode("search");
                  setTimeout(() => searchRef.current?.focus(), 100);
                }
              }}
            />
          )}

          {/* Catálogo */}
          {modCatalogo.status !== "disabled" && (
            <MenuCard
              icon={<Wrench className="h-6 w-6" />}
              title="Catálogo"
              desc={isMaint(modCatalogo.status) ? "Em manutenção" : "Navegue pelas categorias"}
              disabled={isMaint(modCatalogo.status)}
              onClick={() => {
                if (!isMaint(modCatalogo.status)) setMode("catalog");
              }}
            />
          )}

          {/* Mapa da moto */}
          {modMapa.status !== "disabled" && (
            <MenuCard
              icon={<Map className="h-6 w-6" />}
              title="Mapa da moto"
              desc={isMaint(modMapa.status) ? "Em manutenção" : "Selecione pela região"}
              disabled={isMaint(modMapa.status)}
              onClick={() => {
                if (!isMaint(modMapa.status)) setMode("map");
              }}
            />
          )}

          {/* Ler documento */}
          {modOcr.status !== "disabled" && (
            <MenuCard
              icon={<FileText className="h-6 w-6" />}
              title="Ler documento"
              desc={isMaint(modOcr.status) ? "Em manutenção" : "NF, OS ou cupom"}
              disabled={isMaint(modOcr.status)}
              onClick={() => {
                if (!isMaint(modOcr.status)) setMode("ocr");
              }}
            />
          )}

          {/* Manutenção Geral */}
          {modGeral.status !== "disabled" && (
            <MenuCard
              icon={<ListChecks className="h-6 w-6" />}
              title="Manutenção Geral"
              desc={
                isMaint(modGeral.status) ? "Em manutenção" : "Registrar vários itens de uma vez"
              }
              disabled={isMaint(modGeral.status)}
              onClick={() => {
                if (!isMaint(modGeral.status)) setMode("generalMaint");
              }}
            />
          )}

          {/* Meus Itens — biblioteca pessoal reutilizável */}
          {modMeusItens.status !== "disabled" && (
            <MenuCard
              icon={<BookMarked className="h-6 w-6" />}
              title="Meus Itens"
              desc={
                isMaint(modMeusItens.status)
                  ? "Em manutenção"
                  : "Cadastre peças, produtos e serviços que você usa e reutilize nas próximas manutenções."
              }
              disabled={isMaint(modMeusItens.status)}
              beta={modMeusItens.status === "beta"}
              onClick={() => {
                if (!isMaint(modMeusItens.status)) setMode("myItems");
              }}
            />
          )}

          {/* Histórico — card padrão dentro do grid; ocupa a próxima célula disponível */}
          <MenuCard
            icon={<Clock className="h-6 w-6" />}
            title="Histórico"
            desc="Consultar manutenções anteriores"
            onClick={() =>
              navigate({
                to: "/motorcycles/$id/historico-manutencao" as never,
                params: { id: motoId } as never,
              })
            }
          />
        </div>
      </div>
    );
  }

  // ---- manutenção geral ----
  if (mode === "generalMaint") {
    return (
      <GeneralMaintStep
        motoId={motoId}
        motoName={motoName}
        schedules={schedules}
        onBack={() => setMode("menu")}
        onConfirm={(selectedItems) => {
          // Itens selecionados entram no array normal — mesmo fluxo existente
          const newItems = selectedItems.map((s) => ({
            localId: crypto.randomUUID(),
            category: s.category as MaintenanceCategory,
            service: s.name,
            itemKind: "technical" as ItemKind,
            scheduleId: s.id,
            templateItemId: s.template_item_id ?? undefined,
            qty: undefined,
            unitValue: undefined,
          }));
          onItemsChange([...items, ...newItems]);
          setMode("menu");
        }}
      />
    );
  }

  // ---- busca ----
  if (mode === "search") {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4 pb-24">
        <div className="flex items-center gap-2">
          <button onClick={() => setMode("menu")} className="rounded-lg p-1.5 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar: pneu, corrente, óleo, mão de obra…"
            className="flex-1"
          />
        </div>

        {searchQuery.trim() && (
          <div className="space-y-2">
            {filteredSchedules.length > 0 && (
              <>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
                  Componentes da moto
                </p>
                {filteredSchedules.slice(0, 8).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setEditingItem({
                        scheduleId: s.id,
                        templateItemId: s.template_item_id,
                        category: s.category,
                        service: s.name,
                        itemKind: "technical",
                      });
                      setMode("addItem");
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-left hover:border-primary/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {CATEGORY_ICON[s.category as MaintenanceCategory]}{" "}
                        {MAINT_CATEGORY_LABEL[s.category as MaintenanceCategory]}
                      </p>
                    </div>
                    <Plus className="h-4 w-4 shrink-0 text-primary" />
                  </button>
                ))}
              </>
            )}
            {/* Itens da biblioteca pessoal — apenas quando manut_meus_itens ativo */}
            {filteredLibraryItems.length > 0 && (
              <>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1 mt-3">
                  Meus Itens
                </p>
                {filteredLibraryItems.map((lib) => (
                  <button
                    key={lib.id}
                    onClick={() => {
                      addItem({
                        service: lib.description,
                        category: lib.category,
                        itemKind: lib.item_kind,
                      });
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-left hover:border-primary/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-sm">{lib.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {CATEGORY_ICON[lib.category as MaintenanceCategory]}{" "}
                        {MAINT_CATEGORY_LABEL[lib.category as MaintenanceCategory]}
                        {" · "}
                        <span className="inline-flex items-center gap-0.5 rounded-sm bg-primary/10 px-1 py-px text-[10px] font-medium text-primary">
                          Meu item
                        </span>
                      </p>
                    </div>
                    <Plus className="h-4 w-4 shrink-0 text-primary" />
                  </button>
                ))}
              </>
            )}

            <button
              onClick={() => {
                setEditingItem({
                  service: searchQuery.trim(),
                  itemKind: inferItemKind(searchQuery.trim()),
                });
                setMode("addItem");
              }}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border bg-card/60 p-3 text-left hover:border-primary/50"
            >
              <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm">
                Adicionar "<strong>{searchQuery.trim()}</strong>" como item livre
              </span>
            </button>
          </div>
        )}

        {!searchQuery.trim() && (
          <p className="text-center text-sm text-muted-foreground pt-8">
            Digite para buscar um item ou serviço
          </p>
        )}
      </div>
    );
  }

  // ---- catálogo por categoria ----
  if (mode === "catalog") {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4 pb-24">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (selectedCategory) {
                setSelectedCategory(null);
              } else {
                setMode("menu");
              }
            }}
            className="rounded-lg p-1.5 hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="font-display font-bold">
            {selectedCategory ? MAINT_CATEGORY_LABEL[selectedCategory] : "Componentes da moto"}
          </h2>
        </div>

        {!selectedCategory ? (
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(MAINT_CATEGORY_LABEL) as MaintenanceCategory[]).map((cat) => {
              const countOfficial = schedules.filter((s) => s.category === cat).length;
              const countPersonal = meusItensAtivo
                ? libraryItems.filter((it) => it.category === cat).length
                : 0;
              const total = countOfficial + countPersonal;
              if (total === 0) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card p-4 hover:border-primary/50"
                >
                  <span className="text-2xl">{CATEGORY_ICON[cat]}</span>
                  <span className="text-sm font-semibold">{MAINT_CATEGORY_LABEL[cat]}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {total} item{total > 1 ? "s" : ""}
                    {countPersonal > 0 && countOfficial > 0 && (
                      <span className="ml-1 text-primary/70">+{countPersonal} meus</span>
                    )}
                    {countPersonal > 0 && countOfficial === 0 && " (meus)"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSchedules.map((s) => {
              const alreadyAdded = items.some((it) => it.scheduleId === s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    if (!alreadyAdded) {
                      setEditingItem({
                        scheduleId: s.id,
                        templateItemId: s.template_item_id,
                        category: s.category,
                        service: s.name,
                        itemKind: "technical",
                      });
                      setMode("addItem");
                    }
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-xl border bg-card p-3 text-left",
                    alreadyAdded
                      ? "border-primary/40 opacity-60"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <p className="truncate font-medium text-sm">{s.name}</p>
                  {alreadyAdded ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <Plus className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </button>
              );
            })}
            {/* Itens pessoais nessa categoria */}
            {filteredLibraryItems.length > 0 && (
              <>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1 pt-2">
                  Meus Itens
                </p>
                {filteredLibraryItems.map((lib) => {
                  const alreadyAdded = items.some((it) => it.service === lib.description && it.category === lib.category);
                  return (
                    <button
                      key={lib.id}
                      onClick={() => {
                        if (!alreadyAdded) {
                          addItem({
                            service: lib.description,
                            category: lib.category,
                            itemKind: lib.item_kind,
                          });
                        }
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-xl border bg-card p-3 text-left",
                        alreadyAdded
                          ? "border-primary/40 opacity-60"
                          : "border-border hover:border-primary/50",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sm">{lib.description}</p>
                        <span className="inline-flex items-center gap-0.5 rounded-sm bg-primary/10 px-1 py-px text-[10px] font-medium text-primary">
                          Meu item
                        </span>
                      </div>
                      {alreadyAdded ? (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <Plus className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })}
              </>
            )}

            <button
              onClick={() => {
                setEditingItem({ category: selectedCategory });
                setMode("addItem");
              }}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border bg-card/60 p-3 text-left hover:border-primary/50"
            >
              <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Outro item de {MAINT_CATEGORY_LABEL[selectedCategory]}
              </span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---- mapa visual ----
  if (mode === "map") {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4 pb-24">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode("menu")} className="rounded-lg p-1.5 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="font-display font-bold">Mapa da moto</h2>
            <p className="text-xs text-muted-foreground">
              {items.length > 0
                ? `${items.length} item${items.length > 1 ? "s" : ""} selecionado${items.length > 1 ? "s" : ""}`
                : "Toque numa região para ver os componentes"}
            </p>
          </div>
        </div>
        <MotoMap
          schedules={schedules}
          addedItems={items}
          onToggle={(name, category, scheduleId, templateItemId) => {
            const existing = items.find(
              (it) => it.service === name || (scheduleId && it.scheduleId === scheduleId),
            );
            if (existing) {
              // Toggle off: remove o item
              onItemsChange(items.filter((it) => it.localId !== existing.localId));
            } else {
              // Toggle on: abre formulário para informar qty/valor
              setEditingItem({
                service: name,
                category,
                itemKind: "technical",
                scheduleId,
                templateItemId,
              });
              setMode("addItem");
            }
          }}
        />
        {items.length > 0 && (
          <Button onClick={() => setMode("menu")} className="w-full btn-glow" size="lg">
            Ver {items.length} item{items.length > 1 ? "s" : ""} adicionado
            {items.length > 1 ? "s" : ""}
          </Button>
        )}
      </div>
    );
  }

  // ---- OCR ----
  if (mode === "ocr") {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4 pb-24">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode("menu")} className="rounded-lg p-1.5 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="font-display font-bold">Ler documento</h2>
            <p className="text-xs text-muted-foreground">
              Foto ou arquivo da Nota Fiscal / OS / Cupom
            </p>
          </div>
        </div>
        <OcrUploader
          schedules={schedules}
          onConfirm={(ocrItems, date) => {
            // Adiciona todos de uma vez — forEach + addItem individual causa
            // problema de closure: cada chamada lê o items do render anterior
            // e sobrescreve, resultando em apenas o último item sendo salvo
            const newItems = ocrItems.map((it) => ({
              localId: crypto.randomUUID(),
              category: (it.category ?? "other") as MaintenanceCategory,
              service: it.service ?? "",
              itemKind: (it.itemKind ?? "technical") as ItemKind,
              scheduleId: it.scheduleId,
              templateItemId: it.templateItemId,
              qty: it.qty,
              unitValue: it.unitValue,
            }));
            onItemsChange([...items, ...newItems]);
            setMode("menu");
          }}
          onCancel={() => setMode("menu")}
        />
      </div>
    );
  }

  // ---- formulário do item ----
  // ---- Meus Itens ----
  if (mode === "myItems") {
    return (
      <MyItemsMode
        onBack={() => setMode("menu")}
        onSelect={(entry) => {
          addItem({
            service: entry.description,
            category: entry.category,
            itemKind: entry.item_kind,
          });
          setMode("menu");
        }}
        onAddNew={(initial) => {
          setEditingItem({
            service: initial?.description ?? "",
            category: initial?.category,
            itemKind: initial?.item_kind,
          });
          setMode("addItemFromLibrary");
        }}
      />
    );
  }

  if (mode === "addItemFromLibrary") {
    return (
      <AddFromLibraryWrapper
        initial={editingItem ?? {}}
        onBack={() => setMode("myItems")}
        onSaved={() => setMode("myItems")}
        onSavedAndAdded={(item) => {
          addItem(item);
          setMode("menu");
        }}
      />
    );
  }

  if (mode === "addItem" && editingItem !== null) {
    return (
      <AddItemForm
        initial={editingItem}
        onBack={() => setMode("menu")}
        onConfirm={(item) => {
          addItem(item);
          setMode("menu");
        }}
      />
    );
  }

  return null;
}



// Wrapper que usa o hook corretamente dentro de um componente React
function AddFromLibraryWrapper({
  initial,
  onBack,
  onSaved,
  onSavedAndAdded,
}: {
  initial: Partial<import("@/components/types-registrar").MaintenanceItem>;
  onBack: () => void;
  onSaved: () => void;
  onSavedAndAdded: (item: Partial<import("@/components/types-registrar").MaintenanceItem>) => void;
}) {
  const { create } = useUserItemLibrary();

  return (
    <MyItemForm
      initial={{
        description: initial.service ?? "",
        category: initial.category,
        item_kind: initial.itemKind,
      }}
      onBack={onBack}
      onSave={async (entry) => {
        await create.mutateAsync(entry);
        onSaved();
      }}
      onSaveAndAdd={async (entry) => {
        await create.mutateAsync(entry);
        onSavedAndAdded({
          service: entry.description,
          category: entry.category,
          itemKind: entry.item_kind,
        });
      }}
    />
  );
}

// ============================================================
// Meus Itens — biblioteca pessoal reutilizável
// ============================================================
function MyItemsMode({
  onBack,
  onSelect,
  onAddNew,
}: {
  onBack: () => void;
  onSelect: (entry: UserItemLibraryEntry) => void;
  onAddNew: (initial?: Partial<NewUserItemLibraryEntry>) => void;
}) {
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [editingEntry, setEditingEntry] = useState<UserItemLibraryEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { items, softDelete, update } = useUserItemLibrary(search);
  const [toast_] = useState(() => ({ success: (m: string) => toast.success(m), error: (m: string) => toast.error(m) }));

  const filtered = (items.data ?? []).filter(
    (it) => kindFilter === "all" || it.item_kind === kindFilter,
  );

  const KIND_LABEL: Record<string, string> = {
    technical: "Peça / Produto",
    labor: "Serviço / Mão de obra",
    expense: "Despesa / Taxa",
  };

  if (editingEntry) {
    return (
      <MyItemForm
        initial={editingEntry}
        onBack={() => setEditingEntry(null)}
        onSave={async (patch) => {
          await update.mutateAsync({ id: editingEntry.id, ...patch });
          toast_.success("Item atualizado.");
          setEditingEntry(null);
        }}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-lg p-1.5 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold">Meus Itens</h2>
          <p className="text-xs text-muted-foreground">Sua biblioteca pessoal</p>
        </div>
        <button
          onClick={() => onAddNew()}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Novo
        </button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar meus itens…"
          className="pl-9"
        />
      </div>

      {/* Filtros de tipo */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: "all", label: "Todos" },
          { key: "technical", label: "Peças" },
          { key: "labor", label: "Serviços" },
          { key: "expense", label: "Despesas" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setKindFilter(key)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition",
              kindFilter === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/50",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {items.isLoading && <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>}
      {!items.isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center">
          <BookMarked className="h-8 w-8 text-muted-foreground/50" />
          <div>
            <p className="font-medium text-sm">Nenhum item encontrado</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? "Tente outro termo de busca" : "Cadastre peças, produtos e serviços que você utiliza para encontrá-los rapidamente nas próximas manutenções."}
            </p>
          </div>
          <button
            onClick={() => onAddNew()}
            className="mt-1 rounded-xl border border-primary/50 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5"
          >
            + Cadastrar primeiro item
          </button>
        </div>
      )}
      <div className="space-y-2">
        {filtered.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-2 rounded-xl border border-border bg-card p-3"
          >
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() => onSelect(entry)}
            >
              <p className="truncate font-medium text-sm">{entry.description}</p>
              <p className="text-xs text-muted-foreground">
                {MAINT_CATEGORY_LABEL[entry.category]} · {KIND_LABEL[entry.item_kind]}
              </p>
            </button>
            <button
              onClick={() => setEditingEntry(entry)}
              className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDeletingId(entry.id)}
              className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
              title="Excluir"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Confirmação de exclusão */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl space-y-3">
            <p className="font-semibold">Excluir este item dos Meus Itens?</p>
            <p className="text-sm text-muted-foreground">
              Ele deixará de aparecer para novas manutenções. Registros anteriores serão preservados.
            </p>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setDeletingId(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={async () => {
                  await softDelete.mutateAsync(deletingId);
                  setDeletingId(null);
                  toast_.success("Item removido dos Meus Itens.");
                }}
              >
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Formulário de cadastro/edição de item na biblioteca pessoal
function MyItemForm({
  initial,
  onBack,
  onSave,
  onSaveAndAdd,
}: {
  initial?: Partial<UserItemLibraryEntry & { description?: string }>;
  onBack: () => void;
  onSave: (entry: NewUserItemLibraryEntry) => Promise<void>;
  onSaveAndAdd?: (entry: NewUserItemLibraryEntry) => Promise<void>;
}) {
  const { create } = useUserItemLibrary();
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState<MaintenanceCategory>(initial?.category ?? "other");
  const [itemKind, setItemKind] = useState<ItemKind>(initial?.item_kind ?? "technical");
  const [saving, setSaving] = useState(false);

  const KIND_OPTIONS = [
    { value: "technical" as ItemKind, label: "Peça / Produto" },
    { value: "labor" as ItemKind, label: "Serviço / Mão de obra" },
    { value: "expense" as ItemKind, label: "Despesa / Taxa" },
  ];

  async function handleSave(andAdd = false) {
    if (!description.trim()) { toast.error("Informe a descrição"); return; }
    setSaving(true);
    try {
      const entry: NewUserItemLibraryEntry = { description: description.trim(), category, item_kind: itemKind };
      if (andAdd && onSaveAndAdd) {
        await onSaveAndAdd(entry);
      } else {
        await onSave(entry);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-lg p-1.5 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-display font-bold">
          {initial?.id ? "Editar item" : "Novo item"}
        </h2>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Descrição *
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Óleo Motorex 10W50"
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Categoria *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(MAINT_CATEGORY_LABEL) as MaintenanceCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border p-2.5 text-left text-sm transition",
                  category === cat ? "border-primary bg-primary/10 font-semibold" : "border-border bg-card",
                )}
              >
                <span>{CATEGORY_ICON[cat]}</span>
                <span className="truncate">{MAINT_CATEGORY_LABEL[cat]}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Tipo *
          </label>
          <div className="flex flex-col gap-2">
            {KIND_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setItemKind(value)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition",
                  itemKind === value ? "border-primary bg-primary/10 font-semibold" : "border-border bg-card",
                )}
              >
                {itemKind === value && <Check className="h-4 w-4 text-primary shrink-0" />}
                {itemKind !== value && <div className="h-4 w-4 shrink-0" />}
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-2">
        {onSaveAndAdd && (
          <Button
            className="w-full btn-glow"
            disabled={saving || !description.trim()}
            onClick={() => handleSave(true)}
          >
            Salvar e adicionar à manutenção
          </Button>
        )}
        <Button
          variant={onSaveAndAdd ? "outline" : "default"}
          className={cn("w-full", !onSaveAndAdd && "btn-glow")}
          disabled={saving || !description.trim()}
          onClick={() => handleSave(false)}
        >
          Salvar na biblioteca
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Formulário de detalhes de um item
// ============================================================
function AddItemForm({
  initial,
  onBack,
  onConfirm,
}: {
  initial: Partial<MaintenanceItem>;
  onBack: () => void;
  onConfirm: (item: Partial<MaintenanceItem>) => void;
}) {
  const [service, setService] = useState(initial.service ?? "");
  const [category, setCategory] = useState<MaintenanceCategory>(initial.category ?? "other");
  const [itemKind, setItemKind] = useState<ItemKind>(
    initial.itemKind ?? inferItemKind(initial.service ?? ""),
  );
  const [qty, setQty] = useState(initial.qty ? String(initial.qty) : "");
  const [unitValue, setUnitValue] = useState(initial.unitValue ? String(initial.unitValue) : "");

  const isLinkedToSchedule = !!initial.scheduleId;
  const total =
    qty && unitValue ? (parseFloat(qty || "1") * parseFloat(unitValue || "0")).toFixed(2) : null;

  function confirm() {
    if (!service.trim()) {
      toast.error("Informe o serviço ou item");
      return;
    }
    onConfirm({
      ...initial,
      service: service.trim(),
      category,
      itemKind,
      qty: qty ? parseFloat(qty) : undefined,
      unitValue: unitValue ? parseFloat(unitValue) : undefined,
    });
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-lg p-1.5 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-display font-bold">
          {isLinkedToSchedule ? "Confirmar item" : "Adicionar item"}
        </h2>
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        {/* Serviço */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            O que foi feito
          </Label>
          <Input
            value={service}
            onChange={(e) => {
              setService(e.target.value);
              if (!isLinkedToSchedule) setItemKind(inferItemKind(e.target.value));
            }}
            placeholder="Ex: Troca de pneu traseiro"
            readOnly={isLinkedToSchedule}
          />
        </div>

        {/* Categoria — só para itens livres */}
        {!isLinkedToSchedule && (
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Categoria
            </Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(MAINT_CATEGORY_LABEL) as MaintenanceCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    category === cat
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40",
                  )}
                >
                  {CATEGORY_ICON[cat]} {MAINT_CATEGORY_LABEL[cat]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tipo — só para itens livres */}
        {!isLinkedToSchedule && (
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Tipo</Label>
            <div className="flex gap-2">
              {(["technical", "labor", "expense"] as ItemKind[]).map((k) => {
                const labels = { technical: "Peça", labor: "Mão de obra", expense: "Despesa" };
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setItemKind(k)}
                    className={cn(
                      "flex-1 rounded-xl border px-2 py-2 text-xs font-medium transition",
                      itemKind === k
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {labels[k]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Qty + Valor + Total automático */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Quantidade
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="1"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Valor unitário (R$)
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={unitValue}
              onChange={(e) => setUnitValue(e.target.value)}
              placeholder="0,00"
            />
          </div>
        </div>

        {total && (
          <div className="flex items-center justify-between rounded-xl bg-primary/5 px-4 py-2">
            <span className="text-xs text-muted-foreground">Total calculado</span>
            <span className="font-bold text-primary">R$ {total}</span>
          </div>
        )}
      </div>

      <Button onClick={confirm} className="w-full btn-glow">
        {isLinkedToSchedule ? "Confirmar item" : "Adicionar item"}
      </Button>
    </div>
  );
}

// ============================================================
// Passo 2 — Detalhes do evento
// ============================================================
function DetailsStep({
  moto,
  items,
  costItems,
  costTotal,
  occurredAt,
  currentHours,
  currentKm,
  costAdjustment,
  workshopId,
  workshops,
  location,
  description,
  attachedDoc,
  onOccurredAt,
  onCurrentHours,
  onCurrentKm,
  onCostAdjustment,
  onWorkshopId,
  onLocation,
  onDescription,
  onAttachedDoc,
  onBack,
  onNext,
}: any) {
  return (
    <div className="mx-auto w-full max-w-xl space-y-5 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-lg p-1.5 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold">Detalhes</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} item{items.length > 1 ? "s" : ""}
            {costTotal > 0 ? ` · R$ ${costTotal.toFixed(2)}` : ""}
          </p>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Data</Label>
          <Input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => onOccurredAt(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Horímetro (h)
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              value={currentHours}
              onChange={(e) => onCurrentHours(e.target.value)}
              placeholder={`${moto?.hours_total ?? "0"} h atual`}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              KM atual
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              value={currentKm}
              onChange={(e) => onCurrentKm(e.target.value)}
              placeholder={`${moto?.km_total ?? "0"} km atual`}
            />
          </div>
        </div>

        {costItems > 0 && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Ajuste de valor
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  const v = parseFloat(costAdjustment || "0");
                  if (v > 0) onCostAdjustment(String(-v));
                  else if (v === 0) onCostAdjustment("-");
                }}
                className={cn(
                  "rounded-xl border py-2 text-xs font-semibold transition",
                  parseFloat(costAdjustment || "0") < 0
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : "border-border text-muted-foreground hover:border-destructive/40",
                )}
              >
                🏷️ Desconto
              </button>
              <button
                type="button"
                onClick={() => {
                  const v = parseFloat(costAdjustment || "0");
                  if (v < 0) onCostAdjustment(String(-v));
                  else if (v === 0) onCostAdjustment("");
                }}
                className={cn(
                  "rounded-xl border py-2 text-xs font-semibold transition",
                  parseFloat(costAdjustment || "0") > 0
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                ➕ Taxa / acréscimo
              </button>
            </div>
            <Input
              type="number"
              inputMode="decimal"
              value={costAdjustment}
              onChange={(e) => onCostAdjustment(e.target.value)}
              placeholder="Valor (use — para desconto)"
            />
            <p className="text-xs text-muted-foreground">
              Itens: R$ {costItems.toFixed(2)} · Total: R$ {costTotal.toFixed(2)}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Oficina</Label>
          <select
            value={workshopId}
            onChange={(e) => onWorkshopId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Nenhuma / própria mão de obra</option>
            {workshops.map((w: any) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.city ? ` — ${w.city}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            Local (opcional)
          </Label>
          <Input
            value={location}
            onChange={(e) => onLocation(e.target.value)}
            placeholder="Ex: Trilha do Brejo"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            Observações (opcional)
          </Label>
          <Textarea
            value={description}
            onChange={(e) => onDescription(e.target.value)}
            rows={2}
            placeholder="Detalhes adicionais sobre a manutenção…"
          />
        </div>
      </div>

      {/* Anexar documento */}
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-4 space-y-2">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">
          Documento da OS (opcional)
        </Label>
        {attachedDoc ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{attachedDoc.name}</p>
              <p className="text-xs text-muted-foreground">
                {(attachedDoc.size / 1024).toFixed(0)} KB · será salvo em Documentos
              </p>
            </div>
            <button
              type="button"
              onClick={() => onAttachedDoc(null)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/20 p-3 hover:border-primary/40">
            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Anexar NF, OS ou Cupom — PDF, JPG ou PNG
            </span>
            <input
              type="file"
              accept="application/pdf,image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && f.size > 20 * 1024 * 1024) {
                  toast.error("Arquivo muito grande (máx. 20 MB)");
                  return;
                }
                onAttachedDoc(f ?? null);
                e.target.value = "";
              }}
            />
          </label>
        )}
        <p className="text-[11px] text-muted-foreground/70">
          Diferente da leitura automática, este arquivo fica guardado em Documentos da moto.
        </p>
      </div>

      <Button onClick={onNext} className="w-full btn-glow text-base" size="lg">
        Revisar e confirmar
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================================
// MenuCard — card uniforme para o grid do menu de manutenção
// ============================================================
function MenuCard({
  icon,
  title,
  desc,
  onClick,
  disabled = false,
  dashed = false,
  beta = false,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
  dashed?: boolean;
  beta?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card px-3 py-4 transition active:scale-[0.97]",
        dashed
          ? "border-dashed border-border/60 bg-card/60 text-muted-foreground hover:border-primary/40"
          : disabled
            ? "border-amber-500/30 opacity-60 cursor-not-allowed"
            : "border-border hover:border-primary/50",
      )}
    >
      <span className={cn("", disabled ? "text-muted-foreground" : "text-primary")}>{icon}</span>
      <span className="text-xs font-semibold leading-tight">{title}</span>
      <span className="text-[10px] text-muted-foreground text-center leading-tight px-1">
        {desc}
      </span>
    </button>
  );
}

// ============================================================
// GeneralMaintStep — checklist de schedules para Manutenção Geral
// ============================================================
function GeneralMaintStep({
  motoId,
  motoName,
  schedules,
  onBack,
  onConfirm,
}: {
  motoId: string;
  motoName: string;
  schedules: any[];
  onBack: () => void;
  onConfirm: (items: any[]) => void;
}) {
  // Filtrar schedules válidos: excluir not_applicable e ignored
  // (active, snoozed, done, no_info são incluídos — usuário decide o que foi feito)
  const eligible = useMemo(
    () =>
      schedules.filter(
        (s: any) => s.status !== "not_applicable" && s.status !== "ignored" && !s.hidden,
      ),
    [schedules],
  );

  // Agrupar por categoria
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const s of eligible) {
      const cat = s.category ?? "other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(s);
    }
    return map;
  }, [eligible]);

  // Todos selecionados por padrão
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(eligible.map((s: any) => s.id)),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedItems = eligible.filter((s: any) => selected.has(s.id));
  const canContinue = selectedItems.length > 0;

  const catLabels: Record<string, string> = {
    engine: "Motor",
    transmission: "Transmissão",
    brakes: "Freios",
    suspension: "Suspensão",
    wheels: "Rodas",
    electrical: "Elétrica",
    cooling: "Arrefecimento",
    other: "Outros",
  };

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-lg p-1.5 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl font-bold">Manutenção Geral</h1>
          <p className="text-sm text-muted-foreground">{motoName}</p>
        </div>
      </div>

      {/* Aviso semântico — item marcado = manutenção realizada */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">
          Os itens marcados serão registrados como manutenção realizada nesta data.
        </p>
        <p>
          Desmarque os componentes que <strong>não</strong> fizeram parte desta manutenção.
        </p>
      </div>

      {/* Selecionar / limpar todos */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSelected(new Set(eligible.map((s: any) => s.id)))}
          className="flex-1 rounded-xl border border-border bg-card py-2 text-xs font-medium text-muted-foreground hover:border-primary/40 transition"
        >
          Selecionar todos
        </button>
        <button
          type="button"
          onClick={() => setSelected(new Set())}
          className="flex-1 rounded-xl border border-border bg-card py-2 text-xs font-medium text-muted-foreground hover:border-destructive/40 transition"
        >
          Limpar todos
        </button>
      </div>

      {/* Checklist por categoria */}
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-1">
            {catLabels[cat] ?? cat}
          </p>
          {items.map((s: any) => {
            const checked = selected.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition active:scale-[0.98]",
                  checked
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                    checked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40",
                  )}
                >
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    checked ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.name}
                </span>
              </button>
            );
          })}
        </div>
      ))}

      {eligible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum componente ativo encontrado no plano desta moto.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Configure o plano de manutenção antes de usar esta opção.
          </p>
        </div>
      )}

      {/* Botão continuar */}
      {canContinue && (
        <Button
          onClick={() => onConfirm(selectedItems)}
          className="w-full btn-glow text-base"
          size="lg"
        >
          Continuar com {selectedItems.length} item{selectedItems.length > 1 ? "s" : ""}
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
      {!canContinue && eligible.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Selecione ao menos um componente para continuar.
        </p>
      )}
    </div>
  );
}
