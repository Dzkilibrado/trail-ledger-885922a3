import { PageLineSkeleton } from "@/components/Skeletons";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AccessDenied } from "./admin";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, Flame, Hourglass, Inbox, RefreshCcw, Wrench, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { labelFor, PRIORITY_TONE, STATUS_TONE, TICKET_MODULES, TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES } from "@/lib/tickets";
import { formatDate } from "@/lib/trailbook";

export const Route = createFileRoute("/_authenticated/admin/tickets")({
  head: () => ({ meta: [{ title: "Chamados — Admin TrailBook" }] }),
  component: AdminTickets,
});

function AdminTickets() {
  const { isAdmin, loading } = useIsAdmin();
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [type, setType] = useState("all");
  const [module, setModule] = useState("all");
  const [search, setSearch] = useState("");
  // Filtro derivado para "Reabertos" (resolved_at IS NOT NULL + status ativo)
  // e "Urgentes" (prioridade alta/crítica). Não altera schema.
  const [quick, setQuick] = useState<"none" | "reopened" | "urgent" | "new">("none");

  const filters = useMemo(
    () => ({ status, priority, type, module, search, quick }),
    [status, priority, type, module, search, quick],
  );

  const q = useQuery({
    queryKey: ["admin", "tickets", filters],
    enabled: isAdmin,
    queryFn: async () => {
      let sel = supabase.from("tickets").select("*").order("last_activity_at", { ascending: false }).limit(300);
      if (status !== "all") sel = sel.eq("status", status as any);
      if (priority !== "all") sel = sel.eq("priority", priority as any);
      if (type !== "all") sel = sel.eq("type", type as any);
      if (module !== "all") sel = sel.eq("module", module as any);
      if (search.trim()) sel = sel.or(`title.ilike.%${search}%,code.ilike.%${search}%`);
      if (quick === "reopened") sel = sel.not("resolved_at", "is", null).in("status", ["open", "in_analysis", "in_progress"]);
      if (quick === "urgent") sel = sel.in("priority", ["high", "critical"]).in("status", ["open", "in_analysis", "in_progress", "awaiting_user"]);
      if (quick === "new") sel = sel.eq("status", "open").is("admin_last_read_at", null);
      const { data, error } = await sel;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fonte oficial do badge/KPI de atenção administrativa.
  const attention = useQuery({
    queryKey: ["tickets", "admin-attention-count"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_attention_tickets_count" as any);
      if (error) throw error;
      return (data as number) ?? 0;
    },
    refetchInterval: 60_000,
  });

  // KPIs operacionais via COUNT paralelos (sem novas tabelas, sem novas RPCs).
  const kpis = useQuery({
    queryKey: ["admin", "tickets", "kpis"],
    enabled: isAdmin,
    queryFn: async () => {
      const c = (b: any) => b.select("*", { count: "exact", head: true });
      const [novos, atend, aguard, reab, urg, total] = await Promise.all([
        c(supabase.from("tickets")).eq("status", "open").is("admin_last_read_at", null),
        c(supabase.from("tickets")).in("status", ["in_analysis", "in_progress"]),
        c(supabase.from("tickets")).eq("status", "awaiting_user"),
        c(supabase.from("tickets")).not("resolved_at", "is", null).in("status", ["open", "in_analysis", "in_progress"]),
        c(supabase.from("tickets")).in("priority", ["high", "critical"]).in("status", ["open", "in_analysis", "in_progress", "awaiting_user"]),
        c(supabase.from("tickets")).in("status", ["open", "in_analysis", "in_progress", "awaiting_user"]),
      ]);
      return {
        novos: novos.count ?? 0,
        atendimento: atend.count ?? 0,
        aguardando: aguard.count ?? 0,
        reabertos: reab.count ?? 0,
        urgentes: urg.count ?? 0,
        totalAtivo: total.count ?? 0,
      };
    },
    refetchInterval: 60_000,
  });

  const clearAll = useCallback(() => {
    setStatus("all"); setPriority("all"); setType("all"); setModule("all"); setSearch(""); setQuick("none");
  }, []);

  const applyKpi = useCallback((kpi: "novos" | "atendimento" | "aguardando" | "reabertos" | "urgentes" | "totalAtivo") => {
    clearAll();
    if (kpi === "novos") setQuick("new");
    else if (kpi === "atendimento") setStatus("in_progress");
    else if (kpi === "aguardando") setStatus("awaiting_user");
    else if (kpi === "reabertos") setQuick("reopened");
    else if (kpi === "urgentes") setQuick("urgent");
    // totalAtivo: nenhum filtro, mostra todos os ativos (padrão inicial).
  }, [clearAll]);

  if (loading) return <PageLineSkeleton />;
  if (!isAdmin) return <AccessDenied />;

  const activeChip: string = quick !== "none" ? quick : status;
  const chips: { id: string; label: string; onClick: () => void }[] = [
    { id: "all", label: "Todos", onClick: () => { clearAll(); } },
    { id: "new", label: "Novos", onClick: () => { clearAll(); setQuick("new"); } },
    { id: "in_progress", label: "Em atendimento", onClick: () => { clearAll(); setStatus("in_progress"); } },
    { id: "awaiting_user", label: "Aguardando usuário", onClick: () => { clearAll(); setStatus("awaiting_user"); } },
    { id: "reopened", label: "Reabertos", onClick: () => { clearAll(); setQuick("reopened"); } },
    { id: "resolved", label: "Resolvidos", onClick: () => { clearAll(); setStatus("resolved"); } },
    { id: "closed", label: "Encerrados", onClick: () => { clearAll(); setStatus("closed"); } },
  ];

  const k = kpis.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de chamados"
        description="Painel operacional do administrador."
        crumbs={[{ label: "Admin", to: "/admin" }, { label: "Chamados" }]}
      />

      {/* KPIs operacionais — clique aplica o filtro correspondente */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard icon={Inbox} tone="text-primary" label="Novos" value={k?.novos} onClick={() => applyKpi("novos")} />
        <KpiCard icon={Wrench} tone="text-indigo-400" label="Em atendimento" value={k?.atendimento} onClick={() => applyKpi("atendimento")} />
        <KpiCard icon={Hourglass} tone="text-amber-400" label="Aguardando usuário" value={k?.aguardando} onClick={() => applyKpi("aguardando")} />
        <KpiCard icon={RefreshCcw} tone="text-sky-400" label="Reabertos" value={k?.reabertos} onClick={() => applyKpi("reabertos")} />
        <KpiCard icon={Flame} tone="text-destructive" label="Urgentes" value={k?.urgentes} onClick={() => applyKpi("urgentes")} />
        <KpiCard icon={Activity} tone="text-foreground" label="Total ativo" value={k?.totalAtivo} onClick={() => applyKpi("totalAtivo")} />
      </div>

      {typeof attention.data === "number" && attention.data > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          <span><strong>{attention.data}</strong> chamado(s) exigindo atenção administrativa agora.</span>
        </div>
      )}

      {/* Filtros rápidos */}
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => {
          const active = activeChip === c.id || (c.id === "all" && quick === "none" && status === "all");
          return (
            <button
              key={c.id}
              type="button"
              onClick={c.onClick}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-3 lg:grid-cols-5">
        <SelectBox label="Status" value={status} onChange={setStatus} options={[{ value: "all", label: "Todos" }, ...TICKET_STATUSES]} />
        <SelectBox label="Prioridade" value={priority} onChange={setPriority} options={[{ value: "all", label: "Todas" }, ...TICKET_PRIORITIES]} />
        <SelectBox label="Tipo" value={type} onChange={setType} options={[{ value: "all", label: "Todos" }, ...TICKET_TYPES]} />
        <SelectBox label="Módulo" value={module} onChange={setModule} options={[{ value: "all", label: "Todos" }, ...TICKET_MODULES]} />
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Buscar</div>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Título ou código" />
        </div>
      </div>

      <div className="space-y-2">
        {(q.data ?? []).map((t: any) => (
          <Link key={t.id} to="/tickets/$id" params={{ id: t.id }} className="block rounded-xl border border-border bg-card p-4 hover:border-primary/50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono font-semibold text-primary">{t.code}</span>
                  <span>•</span>
                  <span>{labelFor(TICKET_TYPES, t.type)}</span>
                  <span>•</span>
                  <span>Módulo: {labelFor(TICKET_MODULES, t.module)}</span>
                </div>
                <h3 className="mt-1 truncate text-base font-semibold">{t.title}</h3>
                <div className="mt-1 text-xs text-muted-foreground">Atividade em {formatDate(t.last_activity_at)}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={PRIORITY_TONE[t.priority]}>{labelFor(TICKET_PRIORITIES, t.priority)}</Badge>
                <Badge className={STATUS_TONE[t.status]}>{labelFor(TICKET_STATUSES, t.status)}</Badge>
              </div>
            </div>
          </Link>
        ))}
        {!q.isLoading && !q.data?.length && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Nenhum chamado encontrado com os filtros atuais.
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  tone,
  label,
  value,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  label: string;
  value: number | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start gap-1 rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/50 hover:bg-accent/40"
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", tone)} />
        <span className="truncate">{label}</span>
      </div>
      <div className={cn("text-2xl font-bold tabular-nums", tone)}>
        {value ?? "—"}
      </div>
    </button>
  );
}

function SelectBox({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly { value: string; label: string }[] }) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}