import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useHasPermission, ASSISTANT_PERMISSIONS } from "@/lib/assistant-permissions";
import {
  BookOpen, Lightbulb, HelpCircle, BarChart2, Plus,
  Archive, Pencil, Check, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Article = Database["public"]["Tables"]["help_articles"]["Row"];
type Unanswered = Database["public"]["Tables"]["help_unanswered"]["Row"];

export const Route = (createFileRoute as any)("/_authenticated/assistente-central")({
  component: AssistanteCentral,
});

function AccessDeniedMsg() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="font-semibold">Acesso restrito</p>
      <p className="text-sm text-muted-foreground">
        Você não tem permissão para acessar a Central do Assistente.
      </p>
    </div>
  );
}

type Tab = "overview" | "articles" | "intents" | "unanswered";

function AssistanteCentral() {
  const { data: canView, isLoading } = useHasPermission(ASSISTANT_PERMISSIONS.VIEW_ADMIN);
  const [tab, setTab] = useState<Tab>("overview");

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Verificando permissão…</div>;
  if (!canView) return <AccessDeniedMsg />;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview",    label: "Visão geral",  icon: <BarChart2 className="h-4 w-4" /> },
    { id: "articles",    label: "Conteúdos",    icon: <BookOpen className="h-4 w-4" /> },
    { id: "intents",     label: "Intenções",    icon: <Lightbulb className="h-4 w-4" /> },
    { id: "unanswered",  label: "Dúvidas",      icon: <HelpCircle className="h-4 w-4" /> },
  ];

  return (
    <div className="pb-24">
      <PageHeader title="Assistente TrailBook" backTo="/dashboard" />

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border px-4 pb-0 scrollbar-none">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition",
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {tab === "overview"   && <OverviewTab />}
        {tab === "articles"   && <ArticlesTab />}
        {tab === "intents"    && <IntentsTab />}
        {tab === "unanswered" && <UnansweredTab />}
      </div>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────
function OverviewTab() {
  const { data: articles } = useQuery({
    queryKey: ["admin_articles_count"],
    queryFn: async () => {
      const { count } = await supabase.from("help_articles").select("*", { count: "exact", head: true }).eq("status", "published");
      return count ?? 0;
    },
  });
  const { data: unanswered } = useQuery({
    queryKey: ["admin_unanswered_count"],
    queryFn: async () => {
      const { count } = await supabase.from("help_unanswered").select("*", { count: "exact", head: true }).eq("resolved", false);
      return count ?? 0;
    },
  });

  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: "Artigos publicados", value: articles ?? "—" },
        { label: "Dúvidas pendentes", value: unanswered ?? "—" },
        { label: "Módulo", value: "Beta" },
        { label: "Métricas", value: "Em breve" },
      ].map((card) => (
        <div key={card.label} className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">{card.label}</p>
          <p className="text-2xl font-bold">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Articles ──────────────────────────────────────────────────
function ArticlesTab() {
  const qc = useQueryClient();
  const { data: canEdit } = useHasPermission(ASSISTANT_PERMISSIONS.MANAGE_CONTENT);
  const [editing, setEditing] = useState<Partial<Article> | null>(null);
  const [search, setSearch] = useState("");

  const { data: articles = [] } = useQuery({
    queryKey: ["admin_articles"],
    queryFn: async () => {
      const { data } = await supabase.from("help_articles").select("*").order("sort_order");
      return (data ?? []) as Article[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (art: Partial<Article>) => {
      if (art.id) {
        const { error } = await (supabase as any).from("help_articles").update(art).eq("id", art.id!);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("help_articles").insert(art);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_articles"] }); setEditing(null); toast.success("Artigo salvo."); },
    onError: (e: any) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("help_articles").update({ status: "archived" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_articles"] }); toast.success("Artigo arquivado."); },
  });

  const filtered = articles.filter((a) =>
    !search || a.title.toLowerCase().includes(search.toLowerCase())
  );

  if (editing !== null) {
    return (
      <ArticleForm
        initial={editing}
        onSave={(data) => saveMutation.mutate(data)}
        onCancel={() => setEditing(null)}
        saving={saveMutation.isPending}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar artigos…" className="flex-1" />
        {canEdit && (
          <Button size="sm" onClick={() => setEditing({ status: "published", needs_motorcycle: false, sort_order: 0, context_tags: [] })}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        )}
      </div>
      {filtered.map((a) => (
        <div key={a.id} className="rounded-xl border border-border bg-card p-3 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{a.title}</p>
              <p className="text-xs text-muted-foreground">{a.slug}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Badge variant={a.status === "published" ? "default" : "secondary"} className="text-[10px]">
                {a.status}
              </Badge>
              {canEdit && (
                <>
                  <button onClick={() => setEditing(a)} className="rounded p-1 hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                  {a.status !== "archived" && (
                    <button onClick={() => archiveMutation.mutate(a.id)} className="rounded p-1 hover:bg-muted text-muted-foreground"><Archive className="h-3.5 w-3.5" /></button>
                  )}
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{a.summary}</p>
        </div>
      ))}
    </div>
  );
}

function ArticleForm({ initial, onSave, onCancel, saving }: {
  initial: Partial<Article>;
  onSave: (data: Partial<Article>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<Article>>(initial);
  const set = (k: keyof Article, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onCancel} className="rounded p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        <h3 className="font-semibold">{initial.id ? "Editar artigo" : "Novo artigo"}</h3>
      </div>
      {[
        { label: "Título *", key: "title" as const, type: "text" },
        { label: "Slug *", key: "slug" as const, type: "text" },
        { label: "Resumo *", key: "summary" as const, type: "textarea" },
        { label: "Corpo (Markdown)", key: "body_md" as const, type: "textarea" },
        { label: "Module key", key: "module_key" as const, type: "text" },
        { label: "Rota template", key: "route_template" as const, type: "text" },
        { label: "Label do CTA", key: "cta_label" as const, type: "text" },
      ].map(({ label, key, type }) => (
        <div key={key}>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
          {type === "textarea"
            ? <Textarea value={(form[key] as string) ?? ""} onChange={(e) => set(key, e.target.value)} rows={key === "body_md" ? 6 : 2} />
            : <Input value={(form[key] as string) ?? ""} onChange={(e) => set(key, e.target.value)} />
          }
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input type="checkbox" id="needs_moto" checked={!!form.needs_motorcycle} onChange={(e) => set("needs_motorcycle", e.target.checked)} />
        <label htmlFor="needs_moto" className="text-sm">Requer moto selecionada</label>
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button className="flex-1 btn-glow" disabled={saving || !form.title || !form.slug || !form.summary} onClick={() => onSave(form)}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

// ── Intents ───────────────────────────────────────────────────
function IntentsTab() {
  const { data: canEdit } = useHasPermission(ASSISTANT_PERMISSIONS.MANAGE_INTENTS);
  const { data: intents = [] } = useQuery({
    queryKey: ["admin_intents"],
    queryFn: async () => {
      const { data } = await supabase.from("help_intents").select("*, help_articles(title), help_intent_phrases(*)");
      return data ?? [];
    },
  });

  return (
    <div className="space-y-2">
      {intents.map((intent: any) => (
        <div key={intent.id} className="rounded-xl border border-border bg-card p-3 space-y-1">
          <p className="font-medium text-sm">{intent.intent_key}</p>
          <p className="text-xs text-muted-foreground">→ {intent.help_articles?.title}</p>
          <p className="text-xs text-muted-foreground">
            {intent.help_intent_phrases?.length ?? 0} frases
          </p>
        </div>
      ))}
      {!canEdit && (
        <p className="text-xs text-center text-muted-foreground pt-2">Somente visualização</p>
      )}
    </div>
  );
}

// ── Unanswered ────────────────────────────────────────────────
function UnansweredTab() {
  const qc = useQueryClient();
  const { data: canResolve } = useHasPermission(ASSISTANT_PERMISSIONS.RESOLVE_UNANSWERED);

  const { data: rows = [] } = useQuery({
    queryKey: ["admin_unanswered"],
    queryFn: async () => {
      const { data } = await supabase
        .from("help_unanswered")
        .select("*")
        .order("frequency", { ascending: false })
        .limit(50);
      return (data ?? []) as Unanswered[];
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("resolve_help_unanswered", { _id: id, _article_id: null });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_unanswered"] }); toast.success("Marcada como resolvida."); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className={cn("rounded-xl border bg-card p-3 space-y-1", row.resolved ? "opacity-50 border-border" : "border-border")}>
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm">{row.query_text}</p>
            <Badge variant="secondary" className="shrink-0 text-[10px]">{row.frequency}×</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{row.module_key} · {new Date(row.last_seen_at).toLocaleDateString("pt-BR")}</p>
          {!row.resolved && canResolve && (
            <button
              onClick={() => resolveMutation.mutate(row.id)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Marcar como resolvida
            </button>
          )}
        </div>
      ))}
      {rows.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">Nenhuma dúvida registrada ainda.</p>
      )}
    </div>
  );
}
