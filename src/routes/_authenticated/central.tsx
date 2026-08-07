import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  Mail,
  ArrowRightLeft,
  LifeBuoy,
  Clock,
  ChevronRight,
  Wallet,
  CalendarDays,
  Wrench,
  QrCode,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listUserProcesses } from "@/lib/transfers.functions";

export const Route = createFileRoute("/_authenticated/central")({
  head: () => ({ meta: [{ title: "Central — TrailBook" }] }),
  component: CentralHub,
});

function CentralHub() {
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
  const unreadMsgs = useQuery({
    queryKey: ["messages", "unread-count"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("user_unread_count" as any);
      if (error) return 0;
      return Number(data ?? 0);
    },
    staleTime: 30_000,
  });
  const openTickets = useQuery({
    queryKey: ["tickets", "attention-count"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("user_attention_tickets_count" as any);
      if (error) return 0;
      return Number(data ?? 0);
    },
    staleTime: 30_000,
  });
  const listProcesses = useServerFn(listUserProcesses);
  const awaitingTransfers = useQuery({
    queryKey: ["user-processes", "awaiting-count"],
    queryFn: async () => {
      try {
        const list = await listProcesses();
        return list.filter((p) => p.requires_user_action).length;
      } catch {
        return 0;
      }
    },
    staleTime: 30_000,
    retry: false,
  });

  const items = [
    {
      to: "/notifications",
      label: "Notificações",
      desc: "Alertas e avisos do sistema",
      icon: Bell,
      badge: unreadNotifs.data ?? 0,
    },
    {
      to: "/messages",
      label: "Mensagens",
      desc: "Conversas com suporte e oficinas",
      icon: Mail,
      badge: unreadMsgs.data ?? 0,
    },
    {
      to: "/transfers",
      label: "Transferências",
      desc: "Compra, venda e transferência de moto",
      icon: ArrowRightLeft,
      badge: awaitingTransfers.data ?? 0,
    },
    {
      to: "/tickets",
      label: "Chamados",
      desc: "Solicitações de suporte",
      icon: LifeBuoy,
      badge: openTickets.data ?? 0,
    },
    {
      to: "/financial",
      label: "Financeiro",
      desc: "Custos e gastos de todas as motos",
      icon: Wallet,
      badge: 0,
    },
    {
      to: "/agenda",
      label: "Agenda",
      desc: "Compromissos e lembretes",
      icon: CalendarDays,
      badge: 0,
    },
    {
      to: "/workshops",
      label: "Oficinas",
      desc: "Oficinas parceiras e de confiança",
      icon: Wrench,
      badge: 0,
    },
    {
      to: "/certificates",
      label: "Certificados",
      desc: "Certificados digitais emitidos",
      icon: QrCode,
      badge: 0,
    },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Central</h1>
        <p className="text-sm text-muted-foreground">
          Seu hub operacional: notificações, mensagens, financeiro, agenda e mais.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((it) => (
          <Link
            key={it.to}
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
        {/* Reservado para a Fase 4 — Linha do Tempo (histórico unificado do usuário). */}
        <div
          aria-disabled="true"
          className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card/20 p-4 opacity-60"
        >
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-foreground">Linha do Tempo</div>
            <div className="truncate text-xs text-muted-foreground">
              Em breve · histórico unificado
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
