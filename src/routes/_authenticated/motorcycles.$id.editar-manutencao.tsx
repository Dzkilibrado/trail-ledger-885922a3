import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import {
  ArrowLeft,
  Plus,
  X,
  Check,
  Wrench,
  Trash2,
  ChevronRight,
  Search,
  Map,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAINT_CATEGORY_LABEL, type MaintenanceCategory, brl } from "@/lib/trailbook";
import { cn } from "@/lib/utils";

const searchSchema = z.object({ event_id: z.string() });

export const Route = createFileRoute("/_authenticated/motorcycles/$id/editar-manutencao")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Editar manutenção — TrailBook" }] }),
  component: EditarManutencao,
});

const CATEGORY_ICON: Record<MaintenanceCategory, string> = {
  engine: "🔧",
  transmission: "⛓",
  brakes: "🛑",
  suspension: "🔩",
  wheels: "🛞",
  electrical: "⚡",
  cooling: "🌡",
  other: "🔩",
};

type ItemKind = "technical" | "labor" | "expense";

interface EditItem {
  id?: string; // undefined = novo item
  localId: string;
  service: string;
  category: MaintenanceCategory;
  itemKind: ItemKind;
  qty?: number;
  unitValue?: number;
  scheduleId?: string;
  toDelete?: boolean;
}

function EditarManutencao() {
  const { id: motoId } = Route.useParams();
  const { event_id } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<EditItem | null>(null);

  // Campos do evento
  const [title, setTitle] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [currentHours, setCurrentHours] = useState("");
  const [currentKm, setCurrentKm] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<EditItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const moto = useQuery({
    queryKey: ["motorcycle", motoId, "basic"],
    queryFn: async () => {
      const { data } = await supabase
        .from("motorcycles")
        .select("nickname, model, hours_total, km_total")
        .eq("id", motoId)
        .single();
      return data;
    },
  });

  // Carrega o evento e seus itens
  useQuery({
    queryKey: ["event-edit", event_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, title, occurred_at, hours_delta, km_delta, description, maintenance_items(id, service, category, item_kind, qty, unit_value, schedule_id, template_item_id)",
        )
        .eq("id", event_id)
        .single();
      if (error) throw error;
      if (!loaded) {
        setTitle(data.title ?? "");
        setOccurredAt(data.occurred_at?.slice(0, 16) ?? "");
        setDescription(data.description ?? "");
        // Horas e km: mostramos o acumulado atual da moto
        // O usuário informa o NOVO acumulado e o sistema calcula o delta
        setCurrentHours("");
        setCurrentKm("");
        const loadedItems = ((data.maintenance_items as any[]) ?? []).map((it: any) => ({
          id: it.id,
          localId: it.id,
          service: it.service,
          category: it.category as MaintenanceCategory,
          itemKind: it.item_kind as ItemKind,
          qty: it.qty ?? undefined,
          unitValue: it.unit_value ?? undefined,
          scheduleId: it.schedule_id ?? undefined,
        }));
        setItems(loadedItems);
        setLoaded(true);
      }
      return data;
    },
    enabled: !!event_id,
  });

  const visibleItems = items.filter((it) => !it.toDelete);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      // Calcula deltas se o usuário informou novo acumulado
      const { data: fresh } = await supabase
        .from("motorcycles")
        .select("hours_total, km_total")
        .eq("id", motoId)
        .single();

      let hours_delta: number | null = null;
      let km_delta: number | null = null;

      if (currentHours !== "" && fresh) {
        const d = parseFloat(currentHours) - Number((fresh as any).hours_total ?? 0);
        if (d < 0) {
          toast.error("Horímetro menor que o atual");
          setSaving(false);
          return;
        }
        hours_delta = d;
      }
      if (currentKm !== "" && fresh) {
        const d = parseFloat(currentKm) - Number((fresh as any).km_total ?? 0);
        if (d < 0) {
          toast.error("KM menor que o atual");
          setSaving(false);
          return;
        }
        km_delta = d;
      }

      // Monta arrays para o RPC
      const itemsUpsert = visibleItems.map((it) => ({
        ...(it.id ? { id: it.id } : {}),
        service: it.service,
        item_kind: it.itemKind,
        category: it.category,
        qty: it.qty ?? null,
        unit_value: it.unitValue ?? null,
        schedule_id: it.scheduleId ?? null,
      }));

      const itemsDelete = items.filter((it) => it.toDelete && it.id).map((it) => it.id!);

      const { error } = await supabase.rpc(
        "update_maintenance_and_recompose" as never,
        {
          _event_id: event_id,
          _moto_id: motoId,
          _type: "maintenance",
          _title: title || undefined,
          _occurred_at: occurredAt ? new Date(occurredAt).toISOString() : undefined,
          _hours_delta: hours_delta,
          _km_delta: km_delta,
          _description: description || null,
          _items_upsert: itemsUpsert,
          _items_delete: itemsDelete,
        } as never,
      );

      if (error) throw error;

      await qc.invalidateQueries();
      toast.success("Manutenção atualizada com sucesso!");
      navigate({
        to: "/motorcycles/$id/historico-manutencao" as never,
        params: { id: motoId } as never,
      });
    } catch (err: any) {
      toast.error("Não foi possível salvar", { description: err.message });
    } finally {
      setSaving(false);
    }
  }

  // ---- editando um item individual ----
  if (editingItem !== null) {
    return (
      <ItemEditor
        item={editingItem}
        onBack={() => setEditingItem(null)}
        onConfirm={(updated) => {
          setItems((prev) => prev.map((it) => (it.localId === updated.localId ? updated : it)));
          setEditingItem(null);
        }}
      />
    );
  }

  const motoName = moto.data?.nickname || moto.data?.model || "Moto";

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 pb-24">
      <div className="flex items-center gap-3">
        <button
          onClick={() =>
            navigate({
              to: "/motorcycles/$id/historico-manutencao" as never,
              params: { id: motoId } as never,
            })
          }
          className="rounded-lg p-1.5 hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold">Editar manutenção</h1>
          <p className="text-sm text-muted-foreground">{motoName}</p>
        </div>
      </div>

      {/* Itens da manutenção */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Itens realizados
          </h2>
          <button
            onClick={() =>
              setItems((prev) => [
                ...prev,
                {
                  localId: crypto.randomUUID(),
                  service: "",
                  category: "other",
                  itemKind: "technical",
                },
              ])
            }
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar item
          </button>
        </div>

        {visibleItems.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Nenhum item. Toque em "Adicionar item" para incluir.
          </p>
        )}

        {visibleItems.map((it) => (
          <div
            key={it.localId}
            className="flex items-center gap-2 rounded-xl border border-border bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">
                {it.service || <span className="text-muted-foreground italic">Item sem nome</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {CATEGORY_ICON[it.category]} {MAINT_CATEGORY_LABEL[it.category]}
                {it.itemKind === "labor" ? " · Mão de obra" : ""}
                {it.unitValue ? ` · R$ ${((it.qty ?? 1) * it.unitValue).toFixed(2)}` : ""}
              </p>
            </div>
            <button
              onClick={() => setEditingItem(it)}
              className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Wrench className="h-4 w-4" />
            </button>
            <button
              onClick={() =>
                setItems((prev) =>
                  prev.map((i) => (i.localId === it.localId ? { ...i, toDelete: true } : i)),
                )
              }
              className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Detalhes do evento */}
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Detalhes
        </h2>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Data</Label>
          <Input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
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
              onChange={(e) => setCurrentHours(e.target.value)}
              placeholder={`Atual: ${Number(moto.data?.hours_total ?? 0).toFixed(1)} h`}
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
              onChange={(e) => setCurrentKm(e.target.value)}
              placeholder={`Atual: ${Number(moto.data?.km_total ?? 0).toFixed(0)} km`}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            Observações
          </Label>
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalhes adicionais…"
          />
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="w-full btn-glow text-base" size="lg">
        {saving ? "Salvando…" : "Salvar alterações"}
      </Button>
    </div>
  );
}

// ---- editor de item individual ----
function ItemEditor({
  item,
  onBack,
  onConfirm,
}: {
  item: EditItem;
  onBack: () => void;
  onConfirm: (item: EditItem) => void;
}) {
  const [service, setService] = useState(item.service);
  const [category, setCategory] = useState<MaintenanceCategory>(item.category);
  const [itemKind, setItemKind] = useState<ItemKind>(item.itemKind);
  const [qty, setQty] = useState(item.qty != null ? String(item.qty) : "");
  const [unitValue, setUnitValue] = useState(item.unitValue != null ? String(item.unitValue) : "");

  const total = qty && unitValue ? (parseFloat(qty) * parseFloat(unitValue)).toFixed(2) : null;

  function confirm() {
    if (!service.trim()) {
      toast.error("Informe o serviço");
      return;
    }
    onConfirm({
      ...item,
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
        <h2 className="font-display font-bold">Editar item</h2>
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            O que foi feito
          </Label>
          <Input
            value={service}
            onChange={(e) => setService(e.target.value)}
            placeholder="Ex: Troca de pneu traseiro"
          />
        </div>

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
        Confirmar alteração
      </Button>
    </div>
  );
}
