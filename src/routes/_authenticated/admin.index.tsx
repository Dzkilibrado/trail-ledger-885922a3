import { PageLineSkeleton } from "@/components/Skeletons";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  Users,
  Bike,
  LifeBuoy,
  AlertTriangle,
  Hourglass,
  FileText,
  BadgeCheck,
  MessageSquare,
  Wrench,
  Activity,
  ArrowRight,
  ShieldCheck,
  Archive,
  UserX,
  FlaskConical,
} from "lucide-react";
import { formatDate } from "@/lib/trailbook";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  labelFor,
  STATUS_TONE,
  TICKET_STATUSES,
  PRIORITY_TONE,
  TICKET_PRIORITIES,
} from "@/lib/tickets";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { AccessDenied } from "./admin";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Painel administrativo — TrailBook" }] }),
  component: AdminHome,
});

function AdminHome() {
  const { isAdmin, loading } = useIsAdmin();

  const stats = useQuery({
    queryKey: ["admin", "stats"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_dashboard_stats" as any);
      if (error) throw error;
      return data as any;
    },
  });

  const recentTickets = useQuery({
    queryKey: ["admin", "recent-tickets"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("*")
        .order("last_activity_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const recentAudit = useQuery({
    queryKey: ["admin", "recent-audit"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  if (loading) return <PageLineSkeleton />;
  if (!isAdmin) return <AccessDenied />;

  const s = (stats.data ?? {}) as Record<string, number | undefined>;
  const env = import.meta.env.MODE === "production" ? "Produção" : "Desenvolvimento";
  const attentionItems = [
    {
      n: s.tickets_critical,
      label: "Chamados críticos",
      to: "/admin/tickets",
      tone: "text-destructive",
      icon: AlertTriangle,
    },
    {
      n: s.tickets_waiting,
      label: "Aguardando usuário",
      to: "/admin/tickets",
      tone: "text-amber-400",
      icon: Hourglass,
    },
    {
      n: s.users_blocked,
      label: "Usuários bloqueados",
      to: "/admin/users",
      tone: "text-rose-400",
      icon: UserX,
    },
    {
      n: s.modules_maintenance,
      label: "Módulos em manutenção",
      to: "/admin/modules",
      tone: "text-sky-400",
      icon: Wrench,
    },
  ].filter((i) => (i.n ?? 0) > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel administrativo"
        description="Visão geral da plataforma TrailBook."
      />

      {/* Status do ambiente */}
      <div className="surface-elevated flex flex-wrap items-center gap-2 rounded-2xl p-4 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" /> Sistema operando
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-muted-foreground">
          Ambiente · <strong className="text-foreground">{env}</strong>
        </span>
        <span className="text-muted-foreground">Atualizado agora</span>
      </div>

      {/* Ações rápidas — grid próprio, sem disputar espaço com o status */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <QuickAction to="/admin/users" icon={Users} label="Usuários" />
        <QuickAction to="/admin/tickets" icon={LifeBuoy} label="Chamados" />
        <QuickAction to="/admin/documents" icon={FileText} label="Documentos" />
        <QuickAction to="/admin/modules" icon={Wrench} label="Módulos" />
        <QuickAction to="/admin/messages" icon={MessageSquare} label="Mensagens" />
        <QuickAction to="/admin/homolog" icon={FlaskConical} label="Homologação" />
      </div>

      {/* Cards principais — só os 4 mais acionáveis ficam sempre visíveis */}
      {stats.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={Users}
            label="Usuários"
            value={s.users_total}
            sub={`${s.users_active ?? 0} ativos · ${s.users_pending ?? 0} pendentes`}
            tone="from-emerald-500/20 to-emerald-500/5"
            to="/admin/users"
          />
          <MetricCard
            icon={UserX}
            label="Bloqueados"
            value={s.users_blocked}
            sub="sem acesso à plataforma"
            tone="from-rose-500/20 to-rose-500/5"
            to="/admin/users"
          />
          <MetricCard
            icon={LifeBuoy}
            label="Chamados abertos"
            value={s.tickets_open}
            sub={`${s.tickets_critical ?? 0} críticos · ${s.tickets_waiting ?? 0} aguardando`}
            tone="from-amber-500/20 to-amber-500/5"
            to="/admin/tickets"
          />
          <MetricCard
            icon={Wrench}
            label="Módulos em manutenção"
            value={s.modules_maintenance}
            sub="atenção operacional"
            tone="from-orange-500/20 to-orange-500/5"
            to="/admin/modules"
          />
        </div>
      )}

      {/* Atenção */}
      {attentionItems.length > 0 && (
        <div className="surface-elevated rounded-2xl p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h3 className="font-display font-semibold">Itens que precisam de atenção</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {attentionItems.map((a) => (
              <Link
                key={a.label}
                to={a.to}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 transition hover:border-primary/50"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <a.icon className={cn("h-4 w-4 shrink-0", a.tone)} />
                  <span className="truncate text-sm">{a.label}</span>
                </div>
                <span className={cn("shrink-0 font-display text-lg font-bold", a.tone)}>{a.n}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Mais métricas + atividade recente — recolhido por padrão, reduz a rolagem inicial */}
      <Accordion type="multiple" className="space-y-3">
        <AccordionItem
          value="mais-metricas"
          className="rounded-2xl border border-border bg-card px-4"
        >
          <AccordionTrigger className="hover:no-underline">
            <span className="font-display font-semibold">Mais métricas</span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                icon={Bike}
                label="Motos"
                value={s.motorcycles_total}
                sub={`${s.motorcycles_active ?? 0} ativas · ${s.motorcycles_archived ?? 0} arquivadas`}
                tone="from-primary/25 to-primary/5"
              />
              <MetricCard
                icon={FileText}
                label="Documentos"
                value={s.documents_total}
                sub="no cofre digital"
                tone="from-sky-500/20 to-sky-500/5"
                to="/admin/documents"
              />
              <MetricCard
                icon={BadgeCheck}
                label="Certificados"
                value={s.certificates_total}
                sub="ativos e públicos"
                tone="from-indigo-500/20 to-indigo-500/5"
              />
              <MetricCard
                icon={MessageSquare}
                label="Mensagens (7d)"
                value={s.messages_recent}
                sub="comunicação interna"
                tone="from-violet-500/20 to-violet-500/5"
                to="/admin/messages"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="atividade" className="rounded-2xl border border-border bg-card px-4">
          <AccordionTrigger className="hover:no-underline">
            <span className="font-display font-semibold">Chamados e atividade recente</span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-display font-semibold">
                    <LifeBuoy className="h-4 w-4 text-sky-400" /> Últimos chamados
                  </h3>
                  <Link to="/admin/tickets" className="text-xs text-primary hover:underline">
                    Ver todos
                  </Link>
                </div>
                <div className="space-y-2">
                  {(recentTickets.data ?? []).map((t: any) => (
                    <Link
                      key={t.id}
                      to="/tickets/$id"
                      params={{ id: t.id }}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:border-primary/50"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-primary">{t.code}</div>
                        <div className="truncate text-sm">{t.title}</div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Badge className={PRIORITY_TONE[t.priority]}>
                          {labelFor(TICKET_PRIORITIES, t.priority)}
                        </Badge>
                        <Badge className={STATUS_TONE[t.status]}>
                          {labelFor(TICKET_STATUSES, t.status)}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                  {!recentTickets.data?.length && !recentTickets.isLoading && (
                    <EmptyLine text="Nenhum chamado ainda." />
                  )}
                  {recentTickets.isLoading && <Skeleton className="h-16 rounded-lg" />}
                </div>
              </div>

              <div>
                <h3 className="mb-3 flex items-center gap-2 font-display font-semibold">
                  <Activity className="h-4 w-4 text-primary" /> Atividades recentes
                </h3>
                <div className="space-y-2 text-sm">
                  {(recentAudit.data ?? []).map((a: any) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs uppercase tracking-widest text-muted-foreground">
                          {a.table_name} · {a.action}
                        </div>
                        <div className="truncate font-mono text-xs">
                          {a.record_id?.slice(0, 8)}…
                        </div>
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(a.created_at)}
                      </div>
                    </div>
                  ))}
                  {!recentAudit.data?.length && !recentAudit.isLoading && (
                    <EmptyLine text="Sem eventos recentes." />
                  )}
                  {recentAudit.isLoading && <Skeleton className="h-16 rounded-lg" />}
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  to,
}: {
  icon: any;
  label: string;
  value?: number;
  sub?: string;
  tone: string;
  to?: string;
}) {
  const inner = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-gradient-to-br p-4 transition",
        tone,
        to && "hover:border-primary/50",
      )}
    >
      <div className="flex items-start justify-between">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
        <Icon className="h-4 w-4 text-foreground/70" />
      </div>
      <div className="mt-2 font-display text-3xl font-black">{value ?? 0}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
      {to && (
        <ArrowRight className="absolute bottom-3 right-3 h-3.5 w-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
      )}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link to={to}>
      <Button variant="outline" size="sm" className="w-full">
        <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{label}</span>
      </Button>
    </Link>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
      {text}
    </p>
  );
}
