import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { TBButton, TBCard, TBLoadingState } from "@/design-system";
import { useHomeShortcuts, HOME_SHORTCUTS_QUERY_KEY } from "@/hooks/useHomeShortcuts";
import {
  DEFAULT_HOME_SHORTCUTS,
  HOME_SHORTCUT_BY_KEY,
  HOME_SHORTCUT_CATALOG,
  MAX_HOME_SHORTCUTS,
  type HomeShortcutKey,
} from "@/lib/home-shortcuts";

export const Route = createFileRoute("/_authenticated/perfil/atalhos")({
  head: () => ({
    meta: [
      { title: "Personalizar atalhos — TrailBook" },
      { name: "description", content: "Escolha quais atalhos aparecem na sua tela inicial." },
    ],
  }),
  component: EditShortcutsPage,
});

function EditShortcutsPage() {
  const qc = useQueryClient();
  const { keys, isLoading } = useHomeShortcuts();
  const [selected, setSelected] = useState<HomeShortcutKey[]>([]);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Carrega a seleção salva assim que a query resolve (uma vez só).
  useEffect(() => {
    if (isLoading || hydrated) return;
    const initial = (keys && keys.length > 0 ? keys : DEFAULT_HOME_SHORTCUTS) as HomeShortcutKey[];
    setSelected(initial.filter((k) => !!HOME_SHORTCUT_BY_KEY[k]));
    setHydrated(true);
  }, [isLoading, hydrated, keys]);

  const available = HOME_SHORTCUT_CATALOG.filter((s) => !selected.includes(s.key));
  const atMax = selected.length >= MAX_HOME_SHORTCUTS;

  function addShortcut(key: HomeShortcutKey) {
    if (atMax) return;
    setSelected((prev) => [...prev, key]);
  }
  function removeShortcut(key: HomeShortcutKey) {
    setSelected((prev) => prev.filter((k) => k !== key));
  }
  function move(index: number, dir: -1 | 1) {
    setSelected((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }
  function restoreDefault() {
    setSelected([...DEFAULT_HOME_SHORTCUTS]);
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
    const { error } = await supabase
      .from("profiles")
      .update({ home_shortcuts: selected })
      .eq("id", uid);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Atalhos atualizados.");
    qc.invalidateQueries({ queryKey: HOME_SHORTCUTS_QUERY_KEY });
  }

  if (isLoading || !hydrated) return <TBLoadingState label="Carregando seus atalhos…" />;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pb-24">
      <PageHeader
        title="Personalizar atalhos"
        crumbs={[{ label: "Minha Conta", to: "/perfil" }, { label: "Atalhos" }]}
        description="Escolha e ordene o que aparece na seção Atalhos da tela inicial. Até 9 itens."
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Selecionados ({selected.length}/{MAX_HOME_SHORTCUTS})
          </span>
          <button
            type="button"
            onClick={restoreDefault}
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Restaurar padrão
          </button>
        </div>

        {selected.length === 0 ? (
          <TBCard className="text-center text-sm text-muted-foreground">
            Nenhum atalho selecionado. A seção Atalhos ficará vazia na tela inicial.
          </TBCard>
        ) : (
          <div className="space-y-2">
            {selected.map((key, i) => {
              const def = HOME_SHORTCUT_BY_KEY[key];
              if (!def) return null;
              return (
                <TBCard key={key} className="flex items-center gap-3 p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <def.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{def.label}</div>
                    <div className="truncate text-xs text-muted-foreground">{def.description}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label="Mover para cima"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label="Mover para baixo"
                      disabled={i === selected.length - 1}
                      onClick={() => move(i, 1)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remover ${def.label}`}
                      onClick={() => removeShortcut(key)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </TBCard>
              );
            })}
          </div>
        )}
      </div>

      {available.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Disponíveis
          </span>
          <div className="space-y-2">
            {available.map((def) => (
              <button
                key={def.key}
                type="button"
                onClick={() => addShortcut(def.key)}
                disabled={atMax}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                  <def.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{def.label}</div>
                  <div className="truncate text-xs text-muted-foreground">{def.description}</div>
                </div>
                <Plus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            ))}
          </div>
          {atMax && (
            <p className="text-xs text-muted-foreground">
              Limite de {MAX_HOME_SHORTCUTS} atalhos atingido. Remova algum acima para adicionar
              outro.
            </p>
          )}
        </div>
      )}

      <div className="sticky bottom-4">
        <TBButton onClick={save} disabled={saving} className="w-full">
          {saving ? (
            "Salvando…"
          ) : (
            <>
              <Check className="h-4 w-4" aria-hidden /> Salvar atalhos
            </>
          )}
        </TBButton>
      </div>
    </div>
  );
}
