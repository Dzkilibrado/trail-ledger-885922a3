import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Search, Plus, X, ChevronRight, Wrench, Zap, Check, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAINT_CATEGORY_LABEL, type MaintenanceCategory } from "@/lib/trailbook";
import { cn } from "@/lib/utils";

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
        onOccurredAt={setOccurredAt}
        onCurrentHours={setCurrentHours}
        onCurrentKm={setCurrentKm}
        onCostAdjustment={setCostAdjustment}
        onWorkshopId={setWorkshopId}
        onLocation={setLocation}
        onDescription={setDescription}
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

      const { error } = await supabase.rpc(
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
          _items_upsert: JSON.stringify(itemsUpsert),
          _items_delete: [],
        } as never,
      );

      if (error) throw error;

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
        {items.map((it) => (
          <div key={it.localId} className="flex items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium truncate">{it.service}</p>
              <p className="text-xs text-muted-foreground">
                {CATEGORY_ICON[it.category]} {MAINT_CATEGORY_LABEL[it.category]}
                {it.itemKind === "labor" && " · Mão de obra"}
                {it.itemKind === "expense" && " · Despesa"}
              </p>
            </div>
            {it.unitValue ? (
              <span className="shrink-0 text-sm font-semibold">
                R$ {((it.qty ?? 1) * it.unitValue).toFixed(2)}
              </span>
            ) : null}
          </div>
        ))}
        {costTotal > 0 && (
          <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
            <span>Total</span>
            <span>R$ {costTotal.toFixed(2)}</span>
          </div>
        )}
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
  const [mode, setMode] = useState<"menu" | "search" | "catalog" | "addItem">("menu");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<MaintenanceCategory | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<MaintenanceItem> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredSchedules = useMemo(() => {
    if (selectedCategory) return schedules.filter((s) => s.category === selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return schedules.filter((s) => s.name.toLowerCase().includes(q));
    }
    return schedules;
  }, [schedules, selectedCategory, searchQuery]);

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
      <div className="mx-auto w-full max-w-xl space-y-5 pb-24">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="rounded-lg p-1.5 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-xl font-bold">O que foi feito?</h1>
            <p className="text-sm text-muted-foreground">{motoName}</p>
          </div>
        </div>

        {/* Itens já adicionados */}
        {items.length > 0 && (
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
        )}

        {/* Opções de entrada */}
        <div className="space-y-2">
          <button
            onClick={() => {
              setMode("search");
              setTimeout(() => searchRef.current?.focus(), 100);
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/50"
          >
            <Search className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">Buscar item / serviço</p>
              <p className="text-xs text-muted-foreground">
                Digite pneu, corrente, óleo, mão de obra…
              </p>
            </div>
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
          </button>

          <button
            onClick={() => setMode("catalog")}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/50"
          >
            <Wrench className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">Componentes da moto</p>
              <p className="text-xs text-muted-foreground">
                Ver por categoria: Motor, Freios, Rodas…
              </p>
            </div>
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
          </button>

          <button
            onClick={() => {
              setEditingItem({});
              setMode("addItem");
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-4 text-left transition hover:border-primary/50"
          >
            <Plus className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-semibold text-muted-foreground">Adicionar outro item</p>
              <p className="text-xs text-muted-foreground">Item livre não listado no catálogo</p>
            </div>
          </button>
        </div>

        {items.length > 0 && (
          <Button onClick={onNext} className="w-full btn-glow text-base" size="lg">
            Continuar com {items.length} item{items.length > 1 ? "s" : ""}
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
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
              const count = schedules.filter((s) => s.category === cat).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card p-4 hover:border-primary/50"
                >
                  <span className="text-2xl">{CATEGORY_ICON[cat]}</span>
                  <span className="text-sm font-semibold">{MAINT_CATEGORY_LABEL[cat]}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {count} item{count > 1 ? "s" : ""}
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

  // ---- formulário do item ----
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
  const [product, setProduct] = useState(initial.product ?? "");
  const [brand, setBrand] = useState(initial.brand ?? "");
  const [qty, setQty] = useState(initial.qty ? String(initial.qty) : "");
  const [unitValue, setUnitValue] = useState(initial.unitValue ? String(initial.unitValue) : "");

  const isLinkedToSchedule = !!initial.scheduleId;

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
      product: product.trim() || undefined,
      brand: brand.trim() || undefined,
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
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            Serviço / O que foi feito
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

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Tipo</Label>
          <div className="flex gap-2">
            {(["technical", "labor", "expense"] as ItemKind[]).map((k) => {
              const labels = {
                technical: "Peça / Componente",
                labor: "Mão de obra",
                expense: "Despesa / Outro",
              };
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Produto / Material
            </Label>
            <Input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Marca</Label>
            <Input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

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

        {qty && unitValue && (
          <p className="text-right text-sm font-semibold text-primary">
            Total: R$ {(parseFloat(qty || "1") * parseFloat(unitValue || "0")).toFixed(2)}
          </p>
        )}
      </div>

      <Button onClick={confirm} className="w-full btn-glow">
        Adicionar item
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
  onOccurredAt,
  onCurrentHours,
  onCurrentKm,
  onCostAdjustment,
  onWorkshopId,
  onLocation,
  onDescription,
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
              Horímetro atual (h)
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              value={currentHours}
              onChange={(e) => onCurrentHours(e.target.value)}
              placeholder={`Atual: ${moto?.hours_total ?? "—"} h`}
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
              placeholder={`Atual: ${moto?.km_total ?? "—"} km`}
            />
          </div>
        </div>

        {costItems > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Ajuste de custo (desconto negativo, acréscimo positivo)
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              value={costAdjustment}
              onChange={(e) => onCostAdjustment(e.target.value)}
              placeholder="Ex: -50 (desconto) ou 30 (taxa)"
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

      <Button onClick={onNext} className="w-full btn-glow text-base" size="lg">
        Revisar e confirmar
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
