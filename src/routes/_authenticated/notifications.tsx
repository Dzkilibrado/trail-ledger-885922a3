import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";
import { ListRowsSkeleton } from "@/components/Skeletons";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notificações — TrailBook" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,title,body,link,kind,read_at,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  async function openOne(id: string, link: string | null, isRead: boolean) {
    if (!isRead) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
    if (link) window.location.href = link;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Notificações"
        description="Avisos e alertas do TrailBook."
        actions={
          <Button variant="outline" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            <CheckCheck className="h-4 w-4" /> Marcar todas como lidas
          </Button>
        }
      />
      {q.isLoading ? (
        <ListRowsSkeleton rows={4} />
      ) : !q.data || q.data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Bell className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma notificação por enquanto.</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {q.data.map((n: any) => {
            const unread = !n.read_at;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => openOne(n.id, n.link, !unread)}
                className={cn("flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/40", unread && "bg-primary/[0.04]")}
              >
                <Bell className={cn("mt-0.5 h-4 w-4 shrink-0", unread ? "text-primary" : "text-muted-foreground")} />
                <div className="min-w-0 flex-1">
                  <div className={cn("text-sm", unread ? "font-semibold text-foreground" : "text-foreground/80")}>{n.title}</div>
                  {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</div>}
                  <div className="mt-1 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR")}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}