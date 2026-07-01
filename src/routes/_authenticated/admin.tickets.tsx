import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AccessDenied } from "./admin";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
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

  const filters = useMemo(() => ({ status, priority, type, module, search }), [status, priority, type, module, search]);

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
      const { data, error } = await sel;
      if (error) throw error;
      return data ?? [];
    },
  });

  if (loading) return <div className="text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return <AccessDenied />;

  return (
    <div className="space-y-6">
      <PageHeader title="Central de chamados" description="Fila de suporte ao usuário." crumbs={[{ label: "Admin", to: "/admin" }, { label: "Chamados" }]} />

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