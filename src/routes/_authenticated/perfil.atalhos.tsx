import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, GripVertical, RotateCcw, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { TBButton, TBCard, TBLoadingState } from "@/design-system";
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
      { name: "description", content: "Escolha quantos atalhos quer na tela inicial e quais menus aparecem." },
      { property: "og:title", content: "Personalizar atalhos — TrailBook" },
      { property: "og:description", content: "Configure sua tela inicial do TrailBook." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditShortcutsPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// Componente de prévia de slot — grade visual que mostra os atalhos escolhidos
// ─────────────────────────────────────────────────────────────────────────────
function ShortcutSlotPreview({
  selected,
  count,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  selected: HomeShortcutKey[];
  count: ShortcutCountOption;
  onRemove: (key: HomeShortcutKey) => void;
  onMoveUp: (i: number) => void;
  onMoveDown: (i: number) => void;
}) {
  const slots = Array.from({ length: count });

  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map((_, i) => {
        const key = selected[i];
        const def = key ? HOME_SHORTCUT_BY_KEY[key] : undefined;

        if (!def) {
          return (
            <div
              key={`empty-${i}`}
              className="flex min-h-[82px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card/40 px-2 py-3 text-center"
            >
              <span className="text-[10px] text-muted-foreground/50">Slot {i + 1}</span>
            </div>
          );
        }

        return (
          <div
            key={key}
            className="group relative flex min-h-[82px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-primary/30 bg-card px-2 py-3 text-center"
          >
            {/* Numeração da posição */}
            <span className="absolute left-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-primary/20 text-[9px] font-bold text-primary">
              {i + 1}
            </span>
            {/* Botão remover */}
            <button
              type="button"
              aria-label={`Remover ${def.label}`}
              onClick={() => onRemove(key)}
              className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-destructive/0 text-muted-foreground opacity-0 transition-all hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <def.icon className="h-4 w-4" />
            </span>
            <span className="line-clamp-2 text-[10px] font-semibold leading-tight sm:text-[11px]">
              {def.label}
            </span>
            {/* Reordenar — setas discretas */}
            <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                aria-label="Mover para a esquerda"
                disabled={i === 0}
                onClick={() => onMoveUp(i)}
                className="rounded p-0.5 text-muted-foreground hover:text-primary disabled:opacity-20"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Mover para a direita"
                disabled={i === selected.length - 1}
                onClick={() => onMoveDown(i)}
                className="rounded p-0.5 text-muted-foreground hover:text-primary disabled:opacity-20"
              >
                ›
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo agrupado — itens disponíveis para adicionar
// ─────────────────────────────────────────────────────────────────────────────
function ShortcutCatalog({
  available,
  onAdd,
  atMax,
}: {
  available: HomeShortcutDef[];
  onAdd: (key: HomeShortcutKey) => void;
  atMax: boolean;
}) {
  const groups = useMemo(() => {
    const byGroup: Record<string, HomeShortcutDef[]> = {};
    for (const def of available) {
      if (!byGroup[def.group]) byGroup[def.group] = [];
      byGroup[def.group].push(def);
    }
    return byGroup;
  }, [available]);

  if (available.length === 0) return null;

  return (
    <div className="space-y-4">
      {(Object.keys(GROUP_LABELS) as Array<keyof typeof GROUP_LABELS>).map((group) => {
        const items = groups[group];
        if (!items?.length) return null;
        return (
          <div key={group}>
            <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {GROUP_LABELS[group]}
            </div>
            <div className="space-y-1.5">
              {items.map((def) => (
                <button
                  key={def.key}
                  type="button"
                  onClick={() => onAdd(def.key)}
                  disabled={atMax}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors",
                    atMax
                      ? "cursor-not-allowed opacity-40"
                      : "hover:border-primary/40 hover:bg-accent/40",
                  )}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                    <def.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{def.label}</div>
                    <div className="truncate text-xs text-muted-foreground">{def.description}</div>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-primary">+ Adicionar</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
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
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (isLoading || hydrated || error) return;
    const initial = ((keys ?? DEFAULT_HOME_SHORTCUTS) as HomeShortcutKey[]).filter(
      (k) => !!HOME_SHORTCUT_BY_KEY[k],
    );
    setSelected(initial);
    // Detecta o count mais próximo baseado no que estava salvo
    const savedLen = initial.length;
    const nearest = SHORTCUT_COUNT_OPTIONS.find((c) => c >= savedLen) ?? 6;
    setCount(nearest);
    setHydrated(true);
  }, [isLoading, hydrated, keys, error]);

  // Quando o usuário muda o count e os slots diminuem, corta a lista
  function handleCountChange(newCount: ShortcutCountOption) {
    setCount(newCount);
    setSelected((prev) => prev.slice(0, newCount));
  }

  const atMax = selected.length >= count;
  const available = HOME_SHORTCUT_CATALOG.filter((s) => !selected.includes(s.key));

  function addShortcut(key: HomeShortcutKey) {
    if (atMax) return;
    setSelected((prev) => [...prev, key]);
  }
  function removeShortcut(key: HomeShortcutKey) {
    setSelected((prev) => prev.filter((k) => k !== key));
  }
  function moveUp(i: number) {
    setSelected((prev) => {
      const next = [...prev];
      const j = i - 1;
      if (j < 0) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function moveDown(i: number) {
    setSelected((prev) => {
      const next = [...prev];
      const j = i + 1;
      if (j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function restoreDefault() {
    const defaults = DEFAULT_HOME_SHORTCUTS.filter((k) => !!HOME_SHORTCUT_BY_KEY[k]);
    setSelected(defaults.slice(0, count));
    // Ajusta o count para acomodar os defaults caso o atual seja menor
    const neededCount = SHORTCUT_COUNT_OPTIONS.find((c) => c >= defaults.length) ?? 6;
    if (neededCount > count) setCount(neededCount);
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
        Não foi possível carregar seus atalhos. Tente novamente em instantes.
      </p>
    );
  if (isLoading || !hydrated) return <TBLoadingState label="Carregando seus atalhos…" />;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 pb-28">
      <PageHeader
        title="Personalizar atalhos"
        crumbs={[{ label: "Minha Conta", to: "/perfil" }, { label: "Atalhos" }]}
        description="Configure quantos atalhos aparecem na sua tela inicial e escolha quais menus você quer acessar rapidamente."
      />

      {/* ── Passo 1: Quantidade ───────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            1
          </span>
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Quantos atalhos?
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {SHORTCUT_COUNT_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handleCountChange(opt)}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                count === opt
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {opt}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          A grade da tela inicial sempre exibe 3 atalhos por linha —{" "}
          {count / 3 === 1 ? "1 linha" : `${count / 3} linhas`}.
        </p>
      </section>

      {/* ── Passo 2: Grade de slots ────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              2
            </span>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Seus atalhos ({selected.length}/{count})
            </h2>
          </div>
          <button
            type="button"
            onClick={restoreDefault}
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Restaurar padrão
          </button>
        </div>

        <ShortcutSlotPreview
          selected={selected}
          count={count}
          onRemove={removeShortcut}
          onMoveUp={moveUp}
          onMoveDown={moveDown}
        />

        {selected.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            Nenhum atalho selecionado ainda. Adicione itens do catálogo abaixo.
          </p>
        )}

        {atMax && (
          <p className="text-xs font-medium text-primary">
            ✓ Todos os {count} slots preenchidos. Remova um atalho para trocar.
          </p>
        )}
      </section>

      {/* ── Passo 3: Catálogo ─────────────────────────────────────── */}
      {!atMax && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              3
            </span>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Adicionar ao catálogo
            </h2>
          </div>
          <ShortcutCatalog available={available} onAdd={addShortcut} atMax={atMax} />
        </section>
      )}

      {/* ── Salvar sticky ─────────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/90 px-4 py-3 backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <TBButton onClick={save} disabled={saving} className="flex-1">
            {saving ? (
              "Salvando…"
            ) : (
              <>
                <Check className="h-4 w-4" aria-hidden /> Salvar atalhos
              </>
            )}
          </TBButton>
          <a
            href="/dashboard"
            className="flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden /> Ver tela inicial
          </a>
        </div>
      </div>
    </div>
  );
}
