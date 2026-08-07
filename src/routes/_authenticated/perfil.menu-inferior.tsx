import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { TBButton, TBCard, TBLoadingState } from "@/design-system";
import { useBottomNav, BOTTOM_NAV_QUERY_KEY } from "@/hooks/useBottomNav";
import {
  DEFAULT_BOTTOM_NAV,
  BOTTOM_NAV_BY_KEY,
  BOTTOM_NAV_CATALOG,
  MIN_BOTTOM_NAV_ITEMS,
  MAX_BOTTOM_NAV_ITEMS,
  type BottomNavKey,
} from "@/lib/bottom-nav";

export const Route = createFileRoute("/_authenticated/perfil/menu-inferior")({
  head: () => ({
    meta: [
      { title: "Personalizar menu inferior — TrailBook" },
      { name: "description", content: "Escolha e ordene os itens da barra de navegação." },
    ],
  }),
  component: EditBottomNavPage,
});

function EditBottomNavPage() {
  const qc = useQueryClient();
  const { keys, isLoading } = useBottomNav();
  const [selected, setSelected] = useState<BottomNavKey[]>([]);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (isLoading || hydrated) return;
    const initial = (keys && keys.length > 0 ? keys : DEFAULT_BOTTOM_NAV) as BottomNavKey[];
    setSelected(initial.filter((k) => !!BOTTOM_NAV_BY_KEY[k]));
    setHydrated(true);
  }, [isLoading, hydrated, keys]);

  const available = BOTTOM_NAV_CATALOG.filter((s) => !selected.includes(s.key));
  const atMax = selected.length >= MAX_BOTTOM_NAV_ITEMS;
  const atMin = selected.length <= MIN_BOTTOM_NAV_ITEMS;

  function addItem(key: BottomNavKey) {
    if (atMax) return;
    setSelected((prev) => [...prev, key]);
  }
  function removeItem(key: BottomNavKey) {
    if (atMin) {
      toast.info(`Mantenha pelo menos ${MIN_BOTTOM_NAV_ITEMS} itens no menu inferior.`);
      return;
    }
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
    setSelected([...DEFAULT_BOTTOM_NAV]);
  }

  async function save() {
    if (selected.length < MIN_BOTTOM_NAV_ITEMS) {
      toast.error(`Selecione pelo menos ${MIN_BOTTOM_NAV_ITEMS} itens.`);
      return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) {
      setSaving(false);
      toast.error("Sessão expirada. Entre novamente para salvar.");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ bottom_nav_items: selected } as never)
      .eq("id", uid);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Menu inferior atualizado.");
    qc.invalidateQueries({ queryKey: BOTTOM_NAV_QUERY_KEY });
  }

  if (isLoading || !hydrated) return <TBLoadingState label="Carregando seu menu…" />;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pb-24">
      <PageHeader
        title="Personalizar menu inferior"
        crumbs={[{ label: "Minha Conta", to: "/perfil" }, { label: "Menu inferior" }]}
        description={`Escolha e ordene os itens da barra de navegação no celular. De ${MIN_BOTTOM_NAV_ITEMS} a ${MAX_BOTTOM_NAV_ITEMS} itens.`}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Selecionados ({selected.length}/{MAX_BOTTOM_NAV_ITEMS})
          </span>
          <button
            type="button"
            onClick={restoreDefault}
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Restaurar padrão
          </button>
        </div>

        <div className="space-y-2">
          {selected.map((key, i) => {
            const def = BOTTOM_NAV_BY_KEY[key];
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
                    disabled={atMin}
                    onClick={() => removeItem(key)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </TBCard>
            );
          })}
        </div>
        {atMin && (
          <p className="text-[11px] text-muted-foreground">
            Mínimo de {MIN_BOTTOM_NAV_ITEMS} itens — mantenha a barra sempre útil.
          </p>
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
                onClick={() => addItem(def.key)}
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
              Limite de {MAX_BOTTOM_NAV_ITEMS} itens atingido. Remova algum acima para adicionar
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
              <Check className="h-4 w-4" aria-hidden /> Salvar menu
            </>
          )}
        </TBButton>
      </div>
    </div>
  );
}
