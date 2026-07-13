import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, LifeBuoy, Bell, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/comunicacao")({
  head: () => ({ meta: [{ title: "Comunicação — TrailBook" }] }),
  component: ComunicacaoHub,
});

function ComunicacaoHub() {
  const unreadMsgs = useQuery({
    queryKey: ["messages", "unread-count"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("user_unread_count" as any);
      if (error) return 0;
      return Number(data ?? 0);
    },
    staleTime: 30_000,
  });
  const unreadNotifs = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      return count ?? 0;
    },
    staleTime: 30_000,
  });
  const openTickets = useQuery({
    queryKey: ["tickets", "open-count"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return 0;
      const { count } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("user_id", u.user.id)
        .neq("status", "closed");
      return count ?? 0;
    },
    staleTime: 30_000,
  });

  const items = [
    { to: "/messages", label: "Mensagens", desc: "Conversas com suporte e oficinas", icon: Mail, badge: unreadMsgs.data ?? 0 },
    { to: "/tickets", label: "Chamados", desc: "Solicitações de suporte", icon: LifeBuoy, badge: openTickets.data ?? 0 },
    { to: "/notifications", label: "Notificações", desc: "Alertas e avisos do sistema", icon: Bell, badge: unreadNotifs.data ?? 0 },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Comunicação</h1>
        <p className="text-sm text-muted-foreground">Suas mensagens, chamados e notificações em um só lugar.</p>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((it, i) => (
          <Link
            key={i}
            to={it.to}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-card/40 p-4 transition-colors hover:border-primary/50 hover:bg-card"
          >
            <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <it.icon className="h-5 w-5" />
              {it.badge > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {it.badge > 9 ? "9+" : it.badge}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-foreground">{it.label}</div>
              <div className="truncate text-xs text-muted-foreground">{it.desc}</div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}
