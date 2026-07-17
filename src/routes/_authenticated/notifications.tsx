import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Bell, CheckCheck, Search, MoreVertical, Trash2, MailOpen, Mail, X, CheckSquare } from "lucide-react";
import { ListRowsSkeleton } from "@/components/Skeletons";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notificações — TrailBook" }] }),
  component: NotificationsPage,
});

type Notif = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  kind: string | null;
  read_at: string | null;
  created_at: string;
};

type FilterKey = "all" | "unread" | "read";
const PAGE_SIZE = 20;

function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<null | { ids: string[]; bulk: boolean }>(null);

  // debounce
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setLimit(PAGE_SIZE); }, [filter, search]);

  const q = useQuery({
    queryKey: ["notifications", "list", filter, search, limit],
    queryFn: async () => {
      let query = supabase
        .from("notifications")
        .select("id,title,body,link,kind,read_at,created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(limit);
      if (filter === "unread") query = query.is("read_at", null);
      if (filter === "read") query = query.not("read_at", "is", null);
      if (search) {
        const like = `%${search.replace(/[%_]/g, (m) => `\\${m}`)}%`;
        query = query.or(`title.ilike.${like},body.ilike.${like},kind.ilike.${like}`);
      }
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as Notif[], total: count ?? 0 };
    },
  });

  const counts = useQuery({
    queryKey: ["notifications", "counts"],
    queryFn: async () => {
      const [all, unread] = await Promise.all([
        supabase.from("notifications").select("id", { count: "exact", head: true }),
        supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
      ]);
      const total = all.count ?? 0;
      const un = unread.count ?? 0;
      return { all: total, unread: un, read: Math.max(0, total - un) };
    },
  });

  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  const hasMore = rows.length < total;

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  const setRead = useMutation({
    mutationFn: async ({ ids, read }: { ids: string[]; read: boolean }) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: read ? new Date().toISOString() : null })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível atualizar."),
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Todas marcadas como lidas."); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao marcar todas."),
  });

  const del = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("notifications").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      invalidateAll();
      toast.success(n === 1 ? "Notificação excluída." : `${n} notificações excluídas.`);
      setSelected(new Set());
      setSelectMode(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao excluir."),
  });

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(rows.map((r) => r.id)));
  }

  async function openOne(n: Notif) {
    if (selectMode) { toggleSelected(n.id); return; }
    if (!n.read_at) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
      invalidateAll();
    }
    if (n.link) {
      if (n.link.startsWith("http")) window.location.href = n.link;
      else navigate({ to: n.link });
    }
  }

  const filterChips: { key: FilterKey; label: string; count?: number }[] = [
    { key: "all", label: "Todas", count: counts.data?.all },
    { key: "unread", label: "Não lidas", count: counts.data?.unread },
    { key: "read", label: "Lidas", count: counts.data?.read },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      <PageHeader
        title="Notificações"
        description="Avisos e alertas do TrailBook."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSelectMode((s) => !s); setSelected(new Set()); }}
            >
              {selectMode ? <><X className="h-4 w-4" /> Cancelar</> : <><CheckSquare className="h-4 w-4" /> Selecionar</>}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending || !counts.data?.unread}
            >
              <CheckCheck className="h-4 w-4" /> Marcar todas como lidas
            </Button>
          </div>
        }
      />

      {/* Filtros */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filterChips.map((c) => {
          const active = filter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className={cn(
                "inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-foreground hover:bg-accent",
              )}
            >
              {c.label}
              {typeof c.count === "number" && (
                <span className={cn("opacity-70", active && "opacity-90")}>({c.count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por título, mensagem ou tipo…"
          className="h-11 rounded-xl pl-9 text-base sm:h-10 sm:text-sm"
        />
      </div>

      {/* Lista */}
      {q.isLoading ? (
        <ListRowsSkeleton rows={4} />
      ) : q.isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">Não foi possível carregar suas notificações.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => q.refetch()}>Tentar novamente</Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Bell className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {search
              ? "Nenhuma notificação encontrada para esta pesquisa."
              : filter === "unread"
                ? "Você não possui notificações não lidas."
                : filter === "read"
                  ? "Você ainda não possui notificações lidas."
                  : "Você não possui notificações no momento."}
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {rows.map((n) => {
              const unread = !n.read_at;
              const isSel = selected.has(n.id);
              return (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-2 p-3 sm:p-4 transition-colors",
                    unread && "bg-primary/[0.04]",
                    isSel && "bg-primary/[0.10]",
                  )}
                >
                  {selectMode && (
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggleSelected(n.id)}
                      className="mt-1 h-4 w-4 shrink-0"
                      aria-label="Selecionar"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => openOne(n)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <Bell className={cn("mt-0.5 h-4 w-4 shrink-0", unread ? "text-primary" : "text-muted-foreground")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("text-sm", unread ? "font-semibold text-foreground" : "text-foreground/80")}>{n.title}</span>
                        {n.kind && (
                          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {n.kind}
                          </span>
                        )}
                      </div>
                      {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</div>}
                      <div className="mt-1 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR")}</div>
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Ações">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {unread ? (
                        <DropdownMenuItem onClick={() => setRead.mutate({ ids: [n.id], read: true })}>
                          <MailOpen className="h-4 w-4" /> Marcar como lida
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => setRead.mutate({ ids: [n.id], read: false })}>
                          <Mail className="h-4 w-4" /> Marcar como não lida
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setConfirmDelete({ ids: [n.id], bulk: false })}
                      >
                        <Trash2 className="h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Mostrando {rows.length} de {total}</span>
            {hasMore && (
              <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                Carregar mais
              </Button>
            )}
          </div>
        </>
      )}

      {/* Barra flutuante de seleção */}
      {selectMode && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-40 mx-auto max-w-3xl px-4 sm:bottom-6">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-lg">
            <span className="text-sm font-medium">{selected.size} selecionada(s)</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={selectAllVisible}>Todas visíveis</Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRead.mutate({ ids: Array.from(selected), read: true })}
                disabled={setRead.isPending}
              >
                <MailOpen className="h-4 w-4" /> Marcar como lidas
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmDelete({ ids: Array.from(selected), bulk: true })}
                disabled={del.isPending}
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir notificações?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.bulk
                ? `Serão excluídas ${confirmDelete.ids.length} notificações. Esta ação não pode ser desfeita.`
                : "A notificação será excluída definitivamente. Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) del.mutate(confirmDelete.ids);
                setConfirmDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}