import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookmarkCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { TBButton, TBLoadingState } from "@/design-system";
import { useHomeShortcuts, HOME_SHORTCUTS_QUERY_KEY } from "@/hooks/useHomeShortcuts";
import {
  DEFAULT_HOME_SHORTCUTS,
  GROUP_LABELS,
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
  } catch {
    /* storage bloqueado — ignora */
  }
}

// Rótulos dos grupos — "Global" virou "Sistema"
const GROUP_DISPLAY_LABELS: Record<HomeShortcutDef["group"], string> = {
  acao: "⚡ Ações Rápidas",
  moto: "🏍️ Minha Moto",
  global: "🔧 Sistema",
};

// ─────────────────────────────────────────────────────────────────────────────
// Componente: slot individual da grade (mobile-first)
// ─────────────────────────────────────────────────────────────────────────────
function ShortcutSlot({
  index,
  shortcutKey,
  isEditing,
  onTap,
  onRemove,
}: {
  index: number;
  shortcutKey?: HomeShortcutKey;
  isEditing: boolean;
  onTap: () => void;
  onRemove: () => void;
}) {
  const def = shortcutKey ? HOME_SHORTCUT_BY_KEY[shortcutKey] : undefined;

  if (!def) {
    // Slot vazio — toque para selecionar
    return (
      <button
        type="button"
        onClick={onTap}
        aria-label={`Adicionar atalho no slot ${index + 1}`}
        className="flex min-h-[90px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border bg-card/40 px-2 py-3 text-center transition-colors active:bg-accent/30"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-dashed border-primary/30 bg-primary/5 text-primary/40">
          <Plus className="h-4 w-4" />
        </span>
        <span className="text-[10px] text-muted-foreground/50">Slot {index + 1}</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onTap}
        aria-label={isEditing ? `Remover ${def.label}` : `Editar slot ${index + 1} — ${def.label}`}
        className={cn(
          "flex min-h-[90px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center transition-all active:scale-95",
          isEditing
            ? "border-destructive/60 bg-destructive/10 ring-2 ring-destructive/30"
            : "border-primary/30 bg-card",
        )}
      >
        {/* Numeração */}
        <span
          className={cn(
            "absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold",
            isEditing ? "bg-destructive text-destructive-foreground" : "bg-primary/20 text-primary",
          )}
        >
          {isEditing ? <X className="h-3 w-3" /> : index + 1}
        </span>

        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors",
            isEditing ? "bg-destructive/20 text-destructive" : "bg-primary/10 text-primary",
          )}
        >
          <def.icon className="h-4 w-4" />
        </span>
        <span className="line-clamp-2 text-[10px] font-semibold leading-tight sm:text-[11px]">
          {def.label}
        </span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente: grade de slots
// ─────────────────────────────────────────────────────────────────────────────
function SlotGrid({
  selected,
  count,
  editingIndex,
  onSlotTap,
  onRemove,
}: {
  selected: HomeShortcutKey[];
  count: ShortcutCountOption;
  editingIndex: number | null;
  onSlotTap: (i: number) => void;
  onRemove: (i: number) => void;
}) {
  const slots = Array.from({ length: count });

  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map((_, i) => {
        const key = selected[i];
        const isEditing = editingIndex === i && !!key;

        return (
          <ShortcutSlot
            key={`slot-${i}`}
            index={i}
            shortcutKey={key}
            isEditing={isEditing}
            onTap={() => (key && editingIndex === i ? onRemove(i) : onSlotTap(i))}
            onRemove={() => onRemove(i)}
          />
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente: catálogo colapsável por grupo
// ─────────────────────────────────────────────────────────────────────────────
function ShortcutCatalogAccordion({
  available,
  alreadySelected,
  onAdd,
  targetSlot,
  openGroups,
  onToggleGroup,
}: {
  available: HomeShortcutDef[];
  alreadySelected: HomeShortcutKey[];
  onAdd: (key: HomeShortcutKey) => void;
  targetSlot: number | null;
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
        const availableInGroup = items.filter((d) => !alreadySelected.includes(d.key));
        const selectedInGroup = items.filter((d) => alreadySelected.includes(d.key));

        return (
          <div key={group} className="overflow-hidden rounded-2xl border border-border bg-card">
            {/* Cabeçalho do grupo */}
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
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {/* Itens */}
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
                        isSelected
                          ? "opacity-40"
                          : "hover:bg-accent/40 active:bg-accent/60",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm",
                          isSelected
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <def.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{def.label}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {def.description}
                        </div>
                      </div>
                      {isSelected ? (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <span className="shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">
                          {targetSlot !== null ? `→ slot ${targetSlot + 1}` : "Adicionar"}
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
// Componente: gerenciar presets
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
    toast.success(`Configuração "${name}" salva.`);
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
      {/* Presets salvos */}
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
                  {new Date(preset.savedAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  })}
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
                  aria-label={`Excluir configuração ${preset.name}`}
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
          Nenhuma configuração salva ainda. Salve a seleção atual para reutilizá-la depois.
        </p>
      )}

      {/* Formulário inline para nomear */}
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
            <Save className="h-4 w-4" /> Salvar configuração atual
            <span className="text-xs font-normal text-muted-foreground">
              ({MAX_PRESETS - presets.length} restante{MAX_PRESETS - presets.length !== 1 ? "s" : ""})
            </span>
          </button>
        )
      )}
      {!canSave && !naming && (
        <p className="text-center text-xs text-muted-foreground">
          Limite de {MAX_PRESETS} configurações atingido. Exclua uma para salvar nova.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Botão expandir / recolher tudo
// ─────────────────────────────────────────────────────────────────────────────
function ExpandCollapseAllButton({
  allGroups,
  openGroups,
  onChange,
}: {
  allGroups: string[];
  openGroups: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const allOpen = allGroups.every((g) => openGroups.has(g));
  return (
    <button
      type="button"
      onClick={() => onChange(allOpen ? new Set() : new Set(allGroups))}
      className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary active:text-primary/70"
    >
      {allOpen ? (
        <>
          <ChevronUp className="h-3.5 w-3.5" /> Recolher tudo
        </>
      ) : (
        <>
          <ChevronDown className="h-3.5 w-3.5" /> Expandir tudo
        </>
      )}
    </button>
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
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // null = nenhum slot em foco; número = slot que aguarda seleção do catálogo
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  // Estado dos grupos do catálogo (controlado pela página para o botão expandir/recolher tudo)
  const [catalogOpenGroups, setCatalogOpenGroups] = useState<Set<string>>(new Set());

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
    const savedLen = initial.length;
    const nearest = SHORTCUT_COUNT_OPTIONS.find((c) => c >= savedLen) ?? 6;
    setCount(nearest);
    setHydrated(true);
  }, [isLoading, hydrated, keys, error]);

  function handleCountChange(newCount: ShortcutCountOption) {
    setCount(newCount);
    setSelected((prev) => prev.slice(0, newCount));
    setActiveSlot(null);
  }

  // Toque num slot: se vazio → ativa para receber item do catálogo
  //                se preenchido → marca como "em edição" (próximo toque remove)
  function handleSlotTap(i: number) {
    if (activeSlot === i) {
      // Segundo toque no slot preenchido = desselecionar
      setActiveSlot(null);
    } else {
      setActiveSlot(i);
    }
  }

  function handleRemoveSlot(i: number) {
    setSelected((prev) => {
      const next = [...prev];
      next.splice(i, 1);
      return next;
    });
    setActiveSlot(null);
  }

  function handleAddFromCatalog(key: HomeShortcutKey) {
    setSelected((prev) => {
      const next = [...prev];
      if (activeSlot !== null) {
        // Troca o item no slot selecionado (ou preenche um vazio)
        next[activeSlot] = key;
      } else {
        // Adiciona ao próximo slot vazio
        if (next.length < count) next.push(key);
      }
      return next;
    });
    setActiveSlot(null);
  }

  function restoreDefault() {
    const defaults = DEFAULT_HOME_SHORTCUTS.filter((k) => !!HOME_SHORTCUT_BY_KEY[k]);
    const neededCount = SHORTCUT_COUNT_OPTIONS.find((c) => c >= defaults.length) ?? 6;
    const newCount = neededCount > count ? neededCount : count;
    setCount(newCount);
    setSelected(defaults.slice(0, newCount));
    setActiveSlot(null);
  }

  function loadPreset(preset: { keys: HomeShortcutKey[]; count: ShortcutCountOption }) {
    setCount(preset.count);
    setSelected(preset.keys.filter((k) => !!HOME_SHORTCUT_BY_KEY[k]).slice(0, preset.count));
    setActiveSlot(null);
    toast.success("Configuração carregada. Salve para confirmar.");
  }

  async function save() {
    setSaving(true);
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) {
      setSaving(false);
      toast.error("Sessão expirada. Entre novamente para salvar.");
      return;
    }
    const { error: saveError } = await supabase
      .from("profiles")
      .update({ home_shortcuts: selected })
      .eq("id", uid)
      .select("id")
      .single();
    setSaving(false);
    if (saveError) return toast.error(saveError.message);
    await qc.invalidateQueries({ queryKey: HOME_SHORTCUTS_QUERY_KEY });
    toast.success("Atalhos atualizados com sucesso.");
  }

  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        Não foi possível carregar seus atalhos. Tente novamente.
      </p>
    );
  if (isLoading || !hydrated) return <TBLoadingState label="Carregando seus atalhos…" />;

  const slotsFilledCount = selected.length;
  const allSlotsFilled = slotsFilledCount >= count;
  // Slot ativo para receber item do catálogo (pode ser um vazio ou um que foi tocado para editar)
  const targetSlot =
    activeSlot !== null
      ? activeSlot
      : !allSlotsFilled
        ? slotsFilledCount // próximo vazio
        : null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pb-28">
      <PageHeader
        title="Personalizar atalhos"
        crumbs={[{ label: "Minha Conta", to: "/perfil" }, { label: "Atalhos" }]}
        description="Monte sua grade de atalhos. Toque em um slot para editar ou trocar. Toque em um item do catálogo para adicionar."
      />

      {/* ── Passo 1: Quantidade ──────────────────────────────────── */}
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

      {/* ── Passo 2: Grade de slots ──────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel
            step={2}
            title={`Seus atalhos (${slotsFilledCount}/${count})`}
          />
          <button
            type="button"
            onClick={restoreDefault}
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary active:text-primary/70"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
          </button>
        </div>

        <SlotGrid
          selected={selected}
          count={count}
          editingIndex={activeSlot}
          onSlotTap={handleSlotTap}
          onRemove={handleRemoveSlot}
        />

        {/* Dica contextual */}
        <div className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {activeSlot !== null && selected[activeSlot] ? (
            <span className="text-destructive/80">
              🔴 Toque novamente no slot para <strong>remover</strong> — ou escolha outro item no catálogo para <strong>substituir</strong>.
            </span>
          ) : targetSlot !== null ? (
            <span>
              ✏️ O próximo item do catálogo vai para o <strong>slot {targetSlot + 1}</strong>.
            </span>
          ) : (
            <span>✅ Todos os slots preenchidos. Toque em um slot para editar.</span>
          )}
        </div>
      </section>

      {/* ── Passo 3: Configurações salvas ────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel step={3} title="Configurações salvas" />
        <PresetsPanel
          currentKeys={selected}
          currentCount={count}
          onLoad={loadPreset}
        />
      </section>

      {/* ── Passo 4: Catálogo (sempre visível, inicia recolhido) ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel step={4} title="Catálogo de menus" />
          <ExpandCollapseAllButton
            allGroups={["acao", "moto", "global"]}
            openGroups={catalogOpenGroups}
            onChange={setCatalogOpenGroups}
          />
        </div>
        <ShortcutCatalogAccordion
          available={HOME_SHORTCUT_CATALOG.filter((s) => !selected.includes(s.key))}
          alreadySelected={selected}
          onAdd={handleAddFromCatalog}
          targetSlot={targetSlot}
          openGroups={catalogOpenGroups}
          onToggleGroup={toggleCatalogGroup}
        />
      </section>

      {/* ── Salvar — sticky no mobile ────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <TBButton onClick={save} disabled={saving} className="w-full">
          {saving ? (
            "Salvando…"
          ) : (
            <>
              <Check className="h-4 w-4" /> Salvar atalhos
            </>
          )}
        </TBButton>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Auxiliar visual
// ─────────────────────────────────────────────────────────────────────────────
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
