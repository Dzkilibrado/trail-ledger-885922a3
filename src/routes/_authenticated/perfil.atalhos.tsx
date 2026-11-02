import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookmarkCheck,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { TBLoadingState } from "@/design-system";
import { useHomeShortcuts, HOME_SHORTCUTS_QUERY_KEY } from "@/hooks/useHomeShortcuts";
import {
  DEFAULT_HOME_SHORTCUTS,
  HOME_SHORTCUT_BY_KEY,
  HOME_SHORTCUT_CATALOG,
  SHORTCUT_COUNT_OPTIONS,
  type HomeShortcutDef,
  type HomeShortcutKey,
  type ShortcutCountOption,
} from "@/lib/home-shortcuts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/perfil/atalhos")({
  head: () => ({
    meta: [
      { title: "Personalizar atalhos — TrailBook" },
      {
        name: "description",
        content: "Escolha quantos atalhos quer na tela inicial e quais menus aparecem.",
      },
      { property: "og:title", content: "Personalizar atalhos — TrailBook" },
      { property: "og:description", content: "Configure sua tela inicial do TrailBook." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditShortcutsPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// Tipos para presets
// ─────────────────────────────────────────────────────────────────────────────
interface ShortcutPreset {
  id: string;
  name: string;
  keys: HomeShortcutKey[];
  count: ShortcutCountOption;
  savedAt: number;
}

const PRESETS_STORAGE_KEY = "tb_shortcut_presets";
const MAX_PRESETS = 3;

function loadPresets(): ShortcutPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ShortcutPreset[];
  } catch {
    return [];
  }
}

function savePresets(presets: ShortcutPreset[]) {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch { /* storage bloqueado */ }
}

const GROUP_DISPLAY_LABELS: Record<HomeShortcutDef["group"], string> = {
  acao: "⚡ Ações Rápidas",
  moto: "🏍️ Minha Moto",
  global: "🔧 Sistema",
};

// ─────────────────────────────────────────────────────────────────────────────
// Grade com drag-and-drop (pointer events — touch + mouse)
// ─────────────────────────────────────────────────────────────────────────────
function DraggableSlotGrid({
  selected,
  count,
  onReorder,
  onRemove,
  onAddClick,
}: {
  selected: HomeShortcutKey[];
  count: ShortcutCountOption;
  onReorder: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  onAddClick: (index: number) => void;
}) {
  // index do slot que está sendo arrastado
  const draggingIndex = useRef<number | null>(null);
  // index do slot sobre o qual o cursor está passando (drop target)
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // ref para o container da grade (para calcular posições)
  const gridRef = useRef<HTMLDivElement>(null);
  // ref para saber se houve movimento real (tap vs drag)
  const moved = useRef(false);
  // pointerdown origin
  const startPt = useRef({ x: 0, y: 0 });

  const slots = Array.from({ length: count });

  /** Dada uma posição de pointer, retorna o índice do slot mais próximo */
  function slotIndexAt(clientX: number, clientY: number): number | null {
    if (!gridRef.current) return null;
    const cells = gridRef.current.querySelectorAll<HTMLElement>("[data-slot-index]");
    for (const cell of cells) {
      const r = cell.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        return Number(cell.dataset.slotIndex);
      }
    }
    return null;
  }

  function onPointerDown(e: React.PointerEvent, index: number) {
    if (!selected[index]) return; // slot vazio → não arrasta
    // só botão primário / toque
    if (e.pointerType === "mouse" && e.button !== 0) return;
    moved.current = false;
    startPt.current = { x: e.clientX, y: e.clientY };
    draggingIndex.current = index;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent, index: number) {
    if (draggingIndex.current === null) return;
    const dx = e.clientX - startPt.current.x;
    const dy = e.clientY - startPt.current.y;
    if (!moved.current && Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
    moved.current = true;
    const over = slotIndexAt(e.clientX, e.clientY);
    setOverIndex(over);
  }

  function onPointerUp(e: React.PointerEvent, index: number) {
    const from = draggingIndex.current;
    draggingIndex.current = null;
    setOverIndex(null);

    if (from === null) return;

    if (!moved.current) {
      // Foi tap: se slot preenchido, delega para remoção/edição no pai
      if (selected[index]) onAddClick(index);
      else onAddClick(index);
      return;
    }

    // Drag: reordena
    const to = slotIndexAt(e.clientX, e.clientY);
    if (to !== null && to !== from) {
      onReorder(from, to);
    }
  }

  return (
    <div ref={gridRef} className="grid grid-cols-3 gap-2">
      {slots.map((_, i) => {
        const key = selected[i];
        const def = key ? HOME_SHORTCUT_BY_KEY[key] : undefined;
        const isDragging = draggingIndex.current === i && moved.current;
        const isOver = overIndex === i && draggingIndex.current !== null && draggingIndex.current !== i;

        if (!def) {
          // Slot vazio
          return (
            <div
              key={`slot-${i}`}
              data-slot-index={i}
              className={cn(
                "flex min-h-[90px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border bg-card/40 px-2 py-3 text-center transition-all",
                isOver && "border-primary border-2 bg-primary/10 scale-105",
              )}
            >
              <button
                type="button"
                onClick={() => onAddClick(i)}
                aria-label={`Adicionar atalho no slot ${i + 1}`}
                className="flex flex-col items-center gap-1.5"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-dashed border-primary/30 bg-primary/5 text-primary/40">
                  <Plus className="h-4 w-4" />
                </span>
                <span className="text-[10px] text-muted-foreground/50">Slot {i + 1}</span>
              </button>
            </div>
          );
        }

        return (
          <div
            key={`slot-${i}`}
            data-slot-index={i}
            onPointerDown={(e) => onPointerDown(e, i)}
            onPointerMove={(e) => onPointerMove(e, i)}
            onPointerUp={(e) => onPointerUp(e, i)}
            style={{ touchAction: "none", userSelect: "none" }}
            className={cn(
              "relative flex min-h-[90px] cursor-grab flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center transition-all active:cursor-grabbing",
              isDragging ? "scale-95 opacity-50 border-primary/60 bg-primary/5" : "border-primary/30 bg-card",
              isOver && "border-primary scale-105 bg-primary/10",
            )}
          >
            {/* Badge número */}
            <span className="absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary/20 text-[9px] font-bold text-primary">
              {i + 1}
            </span>

            {/* Alça de drag (visual) */}
            <span className="absolute right-1.5 top-1.5 text-muted-foreground/30">
              <GripVertical className="h-3.5 w-3.5" />
            </span>

            {/* Botão remover */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(i); }}
              aria-label={`Remover ${def.label}`}
              className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow sm:flex"
            >
              <X className="h-3 w-3" />
            </button>

            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <def.icon className="h-4 w-4" />
            </span>
            <span className="line-clamp-2 text-[10px] font-semibold leading-tight sm:text-[11px]">
              {def.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo colapsável
// ─────────────────────────────────────────────────────────────────────────────
function ShortcutCatalogAccordion({
  alreadySelected,
  onAdd,
  openGroups,
  onToggleGroup,
}: {
  alreadySelected: HomeShortcutKey[];
  onAdd: (key: HomeShortcutKey) => void;
  openGroups: Set<string>;
  onToggleGroup: (group: string) => void;
}) {
  const groups = useMemo(() => {
    const byGroup: Partial<Record<HomeShortcutDef["group"], HomeShortcutDef[]>> = {};
    for (const def of HOME_SHORTCUT_CATALOG) {
      if (!byGroup[def.group]) byGroup[def.group] = [];
      byGroup[def.group]!.push(def);
    }
    return byGroup;
  }, []);

  return (
    <div className="space-y-2">
      {(Object.keys(GROUP_DISPLAY_LABELS) as Array<HomeShortcutDef["group"]>).map((group) => {
        const items = groups[group] ?? [];
        const isOpen = openGroups.has(group);
        const selectedInGroup = items.filter((d) => alreadySelected.includes(d.key));

        return (
          <div key={group} className="overflow-hidden rounded-2xl border border-border bg-card">
            <button
              type="button"
              onClick={() => onToggleGroup(group)}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-accent/30 active:bg-accent/50"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{GROUP_DISPLAY_LABELS[group]}</span>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {selectedInGroup.length}/{items.length}
                </span>
              </div>
              {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {isOpen && (
              <div className="divide-y divide-border/50 border-t border-border">
                {items.map((def) => {
                  const isSelected = alreadySelected.includes(def.key);
                  return (
                    <button
                      key={def.key}
                      type="button"
                      onClick={() => !isSelected && onAdd(def.key)}
                      disabled={isSelected}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                        isSelected ? "opacity-40" : "hover:bg-accent/40 active:bg-accent/60",
                      )}
                    >
                      <span className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm",
                        isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}>
                        <def.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{def.label}</div>
                        <div className="truncate text-xs text-muted-foreground">{def.description}</div>
                      </div>
                      {isSelected ? (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <span className="shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">
                          + Adicionar
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Presets (somente criar/carregar — o "salvar geral" é automático)
// ─────────────────────────────────────────────────────────────────────────────
function PresetsPanel({
  currentKeys,
  currentCount,
  onLoad,
}: {
  currentKeys: HomeShortcutKey[];
  currentCount: ShortcutCountOption;
  onLoad: (preset: ShortcutPreset) => void;
}) {
  const [presets, setPresets] = useState<ShortcutPreset[]>(() => loadPresets());
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startSave() {
    setNewName("");
    setNaming(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function confirmSave() {
    const name = newName.trim() || `Configuração ${presets.length + 1}`;
    const preset: ShortcutPreset = {
      id: crypto.randomUUID(),
      name,
      keys: [...currentKeys],
      count: currentCount,
      savedAt: Date.now(),
    };
    const updated = [...presets.slice(-(MAX_PRESETS - 1)), preset];
    setPresets(updated);
    savePresets(updated);
    setNaming(false);
    toast.success(`"${name}" salva nos favoritos.`);
  }

  function deletePreset(id: string) {
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    savePresets(updated);
    toast.success("Configuração removida.");
  }

  const canSave = presets.length < MAX_PRESETS;

  return (
    <div className="space-y-3">
      {presets.length > 0 ? (
        <div className="space-y-2">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <BookmarkCheck className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{preset.name}</div>
                <div className="text-xs text-muted-foreground">
                  {preset.keys.length} atalho{preset.keys.length !== 1 ? "s" : ""} ·{" "}
                  {new Date(preset.savedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => onLoad(preset)}
                  className="rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20 active:bg-primary/30"
                >
                  Usar
                </button>
                <button
                  type="button"
                  onClick={() => deletePreset(preset.id)}
                  aria-label={`Excluir ${preset.name}`}
                  className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive active:bg-destructive/25"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          Nenhum favorito salvo. Salve a configuração atual para acessá-la rapidamente depois.
        </p>
      )}

      {naming ? (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmSave();
              if (e.key === "Escape") setNaming(false);
            }}
            placeholder="Nome desta configuração…"
            maxLength={30}
            className="min-w-0 flex-1 rounded-xl border border-primary/50 bg-card px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
          />
          <button
            type="button"
            onClick={confirmSave}
            className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setNaming(false)}
            className="rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        canSave && (
          <button
            type="button"
            onClick={startSave}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 active:bg-primary/10"
          >
            <Save className="h-4 w-4" /> Salvar como favorito
            <span className="text-xs font-normal text-muted-foreground">
              ({MAX_PRESETS - presets.length} restante{MAX_PRESETS - presets.length !== 1 ? "s" : ""})
            </span>
          </button>
        )
      )}
      {!canSave && !naming && (
        <p className="text-center text-xs text-muted-foreground">
          Limite de {MAX_PRESETS} favoritos atingido. Exclua um para salvar novo.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────
function EditShortcutsPage() {
  const qc = useQueryClient();
  const { keys, isLoading, error } = useHomeShortcuts();
  const [selected, setSelected] = useState<HomeShortcutKey[]>([]);
  const [count, setCount] = useState<ShortcutCountOption>(6);
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [catalogOpenGroups, setCatalogOpenGroups] = useState<Set<string>>(new Set());
  // Modal simples para adicionar item quando usuário toca em slot vazio
  const [addingToSlot, setAddingToSlot] = useState<number | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggleCatalogGroup(group: string) {
    setCatalogOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  useEffect(() => {
    if (isLoading || hydrated || error) return;
    const initial = ((keys ?? DEFAULT_HOME_SHORTCUTS) as HomeShortcutKey[]).filter(
      (k) => !!HOME_SHORTCUT_BY_KEY[k],
    );
    setSelected(initial);
    const nearest = SHORTCUT_COUNT_OPTIONS.find((c) => c >= initial.length) ?? 6;
    setCount(nearest);
    setHydrated(true);
  }, [isLoading, hydrated, keys, error]);

  // ── Auto-save com debounce de 800ms ──────────────────────────
  const persist = useCallback(
    async (nextSelected: HomeShortcutKey[]) => {
      setSaveStatus("saving");
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) { setSaveStatus("idle"); return; }
      const { error: saveError } = await supabase
        .from("profiles")
        .update({ home_shortcuts: nextSelected })
        .eq("id", uid)
        .select("id")
        .single();
      if (!saveError) {
        await qc.invalidateQueries({ queryKey: HOME_SHORTCUTS_QUERY_KEY });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("idle");
      }
    },
    [qc],
  );

  function scheduleAutoSave(nextSelected: HomeShortcutKey[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(() => persist(nextSelected), 800);
  }

  // Cleanup ao desmontar
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // ── Handlers ──────────────────────────────────────────────────
  function handleCountChange(newCount: ShortcutCountOption) {
    setCount(newCount);
    const trimmed = selected.slice(0, newCount);
    setSelected(trimmed);
    scheduleAutoSave(trimmed);
  }

  function handleReorder(from: number, to: number) {
    setSelected((prev) => {
      const next = [...prev];
      const item = next[from];
      // remove do from, insere no to
      next.splice(from, 1);
      next.splice(to, 0, item);
      scheduleAutoSave(next);
      return next;
    });
  }

  function handleRemove(index: number) {
    setSelected((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      scheduleAutoSave(next);
      return next;
    });
  }

  function handleSlotTap(index: number) {
    // Se slot preenchido: remove (tap direto = liberar slot)
    // Se slot vazio: abre seleção do catálogo
    if (selected[index]) {
      handleRemove(index);
    } else {
      setAddingToSlot(index);
      // Abre todos os grupos do catálogo para facilitar a escolha
      setCatalogOpenGroups(new Set(["acao", "moto", "global"]));
      // Scroll até o catálogo
      setTimeout(() => {
        document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }

  function handleAddFromCatalog(key: HomeShortcutKey) {
    setSelected((prev) => {
      const next = [...prev];
      if (addingToSlot !== null && addingToSlot < count) {
        next[addingToSlot] = key;
      } else if (next.length < count) {
        next.push(key);
      }
      scheduleAutoSave(next);
      return next;
    });
    setAddingToSlot(null);
  }

  function restoreDefault() {
    const defaults = DEFAULT_HOME_SHORTCUTS.filter((k) => !!HOME_SHORTCUT_BY_KEY[k]);
    const neededCount = SHORTCUT_COUNT_OPTIONS.find((c) => c >= defaults.length) ?? 6;
    const newCount = neededCount > count ? neededCount : count;
    const trimmed = defaults.slice(0, newCount);
    setCount(newCount);
    setSelected(trimmed);
    setAddingToSlot(null);
    scheduleAutoSave(trimmed);
  }

  function loadPreset(preset: { keys: HomeShortcutKey[]; count: ShortcutCountOption }) {
    const trimmed = preset.keys.filter((k) => !!HOME_SHORTCUT_BY_KEY[k]).slice(0, preset.count);
    setCount(preset.count);
    setSelected(trimmed);
    setAddingToSlot(null);
    scheduleAutoSave(trimmed);
    toast.success("Favorito carregado.");
  }

  if (error)
    return <p role="alert" className="text-sm text-destructive">Não foi possível carregar seus atalhos. Tente novamente.</p>;
  if (isLoading || !hydrated)
    return <TBLoadingState label="Carregando seus atalhos…" />;

  const slotsFilledCount = selected.length;
  const allGroups: Array<HomeShortcutDef["group"]> = ["acao", "moto", "global"];
  const allOpen = allGroups.every((g) => catalogOpenGroups.has(g));

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pb-10">
      <PageHeader
        title="Personalizar atalhos"
        crumbs={[{ label: "Minha Conta", to: "/perfil" }, { label: "Atalhos" }]}
        description="Arraste para reordenar. Toque num slot preenchido para removê-lo. Toque num slot vazio ou no catálogo para adicionar."
      />

      {/* Status de auto-save — discreto no topo */}
      <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground min-h-[20px]">
        {saveStatus === "saving" && <span className="animate-pulse">Salvando…</span>}
        {saveStatus === "saved" && (
          <span className="flex items-center gap-1 text-emerald-400">
            <Check className="h-3 w-3" /> Salvo
          </span>
        )}
      </div>

      {/* ── 1: Quantidade ──────────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel step={1} title="Quantos atalhos?" />
        <div className="flex flex-wrap gap-2">
          {SHORTCUT_COUNT_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handleCountChange(opt)}
              className={cn(
                "rounded-xl px-4 py-2.5 text-sm font-bold transition-all active:scale-95",
                count === opt
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                  : "border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {opt}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          3 por linha —{" "}
          <span className="font-medium text-foreground/70">
            {count / 3 === 1 ? "1 linha" : `${count / 3} linhas`}
          </span>{" "}
          na tela inicial.
        </p>
      </section>

      {/* ── 2: Grade de slots (arrastar para reordenar) ────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel step={2} title={`Seus atalhos (${slotsFilledCount}/${count})`} />
          <button
            type="button"
            onClick={restoreDefault}
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary active:text-primary/70"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
          </button>
        </div>

        <DraggableSlotGrid
          selected={selected}
          count={count}
          onReorder={handleReorder}
          onRemove={handleRemove}
          onAddClick={handleSlotTap}
        />

        {/* Dica contextual */}
        <div className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {addingToSlot !== null ? (
            <span className="text-primary">
              ✏️ Escolha um item no catálogo abaixo para preencher o <strong>slot {addingToSlot + 1}</strong>.
            </span>
          ) : slotsFilledCount < count ? (
            <span>💡 Toque em um slot vazio ou escolha no catálogo para adicionar. Arraste os itens para reordenar.</span>
          ) : (
            <span>✅ Grade completa. Arraste para reordenar ou toque em um item para removê-lo.</span>
          )}
        </div>
      </section>

      {/* ── 3: Favoritos ─────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel step={3} title="Favoritos" />
        <p className="text-xs text-muted-foreground -mt-1">
          Salve a configuração atual com um nome para reutilizá-la rapidamente.
        </p>
        <PresetsPanel
          currentKeys={selected}
          currentCount={count}
          onLoad={loadPreset}
        />
      </section>

      {/* ── 4: Catálogo ──────────────────────────────────────── */}
      <section id="catalogo" className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel step={4} title="Catálogo de menus" />
          <button
            type="button"
            onClick={() => setCatalogOpenGroups(allOpen ? new Set() : new Set(allGroups))}
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary active:text-primary/70"
          >
            {allOpen ? <><ChevronUp className="h-3.5 w-3.5" /> Recolher tudo</> : <><ChevronDown className="h-3.5 w-3.5" /> Expandir tudo</>}
          </button>
        </div>
        <ShortcutCatalogAccordion
          alreadySelected={selected}
          onAdd={handleAddFromCatalog}
          openGroups={catalogOpenGroups}
          onToggleGroup={toggleCatalogGroup}
        />
      </section>
    </div>
  );
}

function SectionLabel({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {step}
      </span>
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{title}</h2>
    </div>
  );
}
