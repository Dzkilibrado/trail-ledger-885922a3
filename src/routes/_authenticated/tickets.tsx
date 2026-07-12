import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, LifeBuoy } from "lucide-react";
import { formatDate } from "@/lib/trailbook";
import { labelFor, TICKET_STATUSES, TICKET_TYPES, STATUS_TONE, PRIORITY_TONE, TICKET_PRIORITIES } from "@/lib/tickets";
import { ListRowsSkeleton } from "@/components/Skeletons";

export const Route = createFileRoute("/_authenticated/tickets")({
  head: () => ({ meta: [{ title: "Meus chamados — TrailBook" }] }),
  component: MyTickets,
});

function MyTickets() {
  const { data, isLoading } = useQuery({
    queryKey: ["tickets", "mine"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .eq("user_id", u.user.id)
        .order("last_activity_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meus chamados"
        description="Relate erros, tire dúvidas ou envie sugestões. Nossa equipe responde por aqui."
        actions={<Link to="/tickets/new"><Button className="btn-glow"><Plus className="h-4 w-4" /> Novo chamado</Button></Link>}
      />

      {isLoading ? (
        <ListRowsSkeleton rows={3} />
      ) : !data || data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <LifeBuoy className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Você ainda não abriu chamados.</p>
          <Link to="/tickets/new"><Button className="mt-4"><Plus className="h-4 w-4" /> Abrir chamado</Button></Link>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((t: any) => (
            <Link
              key={t.id}
              to="/tickets/$id"
              params={{ id: t.id }}
              className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono font-semibold text-primary">{t.code}</span>
                    <span>•</span>
                    <span>{labelFor(TICKET_TYPES, t.type)}</span>
                  </div>
                  <h3 className="mt-1 truncate text-base font-semibold">{t.title}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={PRIORITY_TONE[t.priority]}>{labelFor(TICKET_PRIORITIES, t.priority)}</Badge>
                  <Badge className={STATUS_TONE[t.status]}>{labelFor(TICKET_STATUSES, t.status)}</Badge>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Última atividade em {formatDate(t.last_activity_at)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}