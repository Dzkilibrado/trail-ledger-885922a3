import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Building2, ShieldCheck, MapPin, Star, Wrench } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { brl, EVENT_TYPE_LABEL, formatDate } from "@/lib/trailbook";
import { ExportMenu } from "@/components/ExportMenu";
import type { ExportColumn } from "@/lib/exports";
import { CardBlockSkeleton } from "@/components/Skeletons";

export const Route = createFileRoute("/_authenticated/workshops")({
  head: () => ({ meta: [{ title: "Oficinas — TrailBook" }] }),
  component: Workshops,
});

function Workshops() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"favorites" | "usage" | "name" | "recent">("favorites");
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["workshops"],
    queryFn: async () =>
      (
        await supabase
          .from("workshops_public")
          .select(
            "id, name, city, state, verified, verified_at, verified_label, created_at, updated_at",
          )
          .order("name")
      ).data ?? [],
  });

  // Oficinas de confiança do usuário — marcação pessoal sobre o catálogo
  // compartilhado, não altera a oficina em si.
  const favorites = useQuery({
    queryKey: ["workshop-favorites"],
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) return [] as string[];
      const { data } = await supabase
        .from("workshop_favorites" as never)
        .select("workshop_id")
        .eq("user_id", uid);
      return ((data ?? []) as { workshop_id: string }[]).map((r) => r.workshop_id);
    },
  });
  const favoriteIds = useMemo(() => new Set(favorites.data ?? []), [favorites.data]);

  async function toggleFavorite(workshopId: string) {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) return;
    const isFav = favoriteIds.has(workshopId);
    if (isFav) {
      await supabase
        .from("workshop_favorites" as never)
        .delete()
        .eq("user_id", uid)
        .eq("workshop_id", workshopId);
    } else {
      await supabase
        .from("workshop_favorites" as never)
        .insert({ user_id: uid, workshop_id: workshopId } as never);
    }
    qc.invalidateQueries({ queryKey: ["workshop-favorites"] });
  }

  // Motos ativas do usuário — usadas para excluir eventos de motos arquivadas
  // dos KPIs operacionais das oficinas (histórico permanece íntegro).
  const activeMotos = useQuery({
    queryKey: ["motorcycles", "active-ids"],
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) return [] as { id: string }[];
      return (
        (
          await supabase
            .from("motorcycles")
            .select("id")
            .eq("owner_id", uid)
            .neq("status" as never, "archived" as never)
        ).data ?? []
      );
    },
  });
  const events = useQuery({
    queryKey: ["events", "with-workshop"],
    queryFn: async () =>
      (
        await supabase
          .from("events")
          .select(
            "id, workshop_id, motorcycle_id, cost, occurred_at, title, type, motorcycles(nickname, model)",
          )
          .not("workshop_id", "is", null)
      ).data ?? [],
  });
  const activeMotoIds = useMemo(
    () => (activeMotos.data ? new Set(activeMotos.data.map((m) => m.id)) : null),
    [activeMotos.data],
  );
  const scopedEvents = useMemo(
    () =>
      activeMotoIds
        ? (events.data ?? []).filter((e) => activeMotoIds.has(e.motorcycle_id as string))
        : (events.data ?? []),
    [events.data, activeMotoIds],
  );

  // KPIs por oficina
  const allStats = (data ?? []).map((w) => {
    const evs = scopedEvents.filter((e) => e.workshop_id === w.id);
    const motoIds = new Set(evs.map((e) => e.motorcycle_id));
    const last = evs.sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    )[0];
    return {
      workshop: w,
      services: evs.length,
      bikes: motoIds.size,
      revenue: evs.reduce((s, e) => s + (Number(e.cost) || 0), 0),
      lastService: last?.occurred_at as string | undefined,
      isFavorite: favoriteIds.has(w.id),
    };
  });

  // Estados presentes no catálogo — só mostra o que existe de fato.
  const availableStates = useMemo(
    () => Array.from(new Set((data ?? []).map((w) => w.state).filter(Boolean) as string[])).sort(),
    [data],
  );

  const stats = useMemo(() => {
    const list =
      stateFilter === "all" ? allStats : allStats.filter((s) => s.workshop.state === stateFilter);
    const sorted = [...list];
    if (sortBy === "favorites") {
      sorted.sort(
        (a, b) =>
          Number(b.isFavorite) - Number(a.isFavorite) ||
          b.services - a.services ||
          a.workshop.name.localeCompare(b.workshop.name),
      );
    } else if (sortBy === "usage") {
      sorted.sort(
        (a, b) => b.services - a.services || a.workshop.name.localeCompare(b.workshop.name),
      );
    } else if (sortBy === "recent") {
      sorted.sort(
        (a, b) =>
          new Date(b.workshop.created_at).getTime() - new Date(a.workshop.created_at).getTime(),
      );
    } else {
      sorted.sort((a, b) => a.workshop.name.localeCompare(b.workshop.name));
    }
    return sorted;
  }, [allStats, stateFilter, sortBy]);

  const detailWorkshop = data?.find((w) => w.id === detailId) ?? null;
  const detailEvents = scopedEvents
    .filter((e) => e.workshop_id === detailId)
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  const exportColumns: ExportColumn<any>[] = [
    { key: "name", label: "Oficina", value: (s) => s.workshop.name },
    {
      key: "city",
      label: "Cidade",
      value: (s) => [s.workshop.city, s.workshop.state].filter(Boolean).join(" / "),
    },
    { key: "services", label: "Serviços", value: (s) => s.services, align: "right" },
    { key: "bikes", label: "Motos", value: (s) => s.bikes, align: "right" },
    {
      key: "revenue",
      label: "Movimento (R$)",
      value: (s) => Number(s.revenue).toFixed(2),
      align: "right",
    },
    {
      key: "last",
      label: "Último serviço",
      value: (s) => (s.lastService ? formatDate(s.lastService) : ""),
    },
  ];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("workshops").insert({
      name: String(fd.get("name")),
      cnpj: String(fd.get("cnpj") || "") || null,
      city: String(fd.get("city") || "") || null,
      state: String(fd.get("state") || "") || null,
      phone: String(fd.get("phone") || "") || null,
      owner_user_id: u.user!.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Oficina cadastrada");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["workshops"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Oficinas parceiras"
        description="Marque suas oficinas de confiança e acompanhe quanto você já gastou em cada uma."
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu
              filename="trailbook-oficinas"
              title="Oficinas parceiras — TrailBook"
              subtitle={`${stats.length} oficina(s)`}
              columns={exportColumns}
              rows={stats}
            />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="btn-glow">
                  <Plus className="h-4 w-4" /> Nova oficina
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar oficina</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-3">
                  <Field label="Nome">
                    <Input name="name" required />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="CNPJ">
                      <Input name="cnpj" />
                    </Field>
                    <Field label="Telefone">
                      <Input name="phone" />
                    </Field>
                    <Field label="Cidade">
                      <Input name="city" />
                    </Field>
                    <Field label="UF">
                      <Input name="state" maxLength={2} />
                    </Field>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="flex-1"
                      onClick={() => setOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1 btn-glow">
                      Salvar oficina
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {(data ?? []).length > 0 && (
        <div className="surface-elevated grid grid-cols-1 gap-2 rounded-2xl p-3 sm:flex sm:flex-wrap sm:items-center">
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Todos os estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              {availableStates.map((uf) => (
                <SelectItem key={uf} value={uf}>
                  {uf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="favorites">Confiança primeiro</SelectItem>
              <SelectItem value="usage">Mais usadas primeiro</SelectItem>
              <SelectItem value="name">Nome (A–Z)</SelectItem>
              <SelectItem value="recent">Adicionadas recentemente</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground sm:ml-auto">
            {stats.length} de {allStats.length}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <CardBlockSkeleton />
          <CardBlockSkeleton />
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {stats.map(({ workshop: w, services, bikes, revenue, lastService, isFavorite }) => (
            <div
              key={w.id}
              className="surface-elevated rounded-2xl p-5 transition-colors hover:bg-muted/30"
            >
              <button onClick={() => setDetailId(w.id)} className="w-full text-left">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold">{w.name}</div>
                      {w.verified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                          <ShieldCheck className="h-3 w-3" />{" "}
                          {w.verified_label || "TrailBook Verified"}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {(w.city || w.state) && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{" "}
                          {[w.city, w.state].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(w.id);
                    }}
                    aria-label={
                      isFavorite
                        ? "Remover das oficinas de confiança"
                        : "Marcar como oficina de confiança"
                    }
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-amber-400"
                  >
                    <Star
                      className={`h-5 w-5 ${isFavorite ? "fill-amber-400 text-amber-400" : ""}`}
                    />
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Serviços" value={String(services)} />
                  <Stat label="Motos" value={String(bikes)} />
                  <Stat label="Movimento" value={revenue > 0 ? brl(revenue) : "—"} />
                </div>
                {lastService && (
                  <div className="mt-3 text-[11px] text-muted-foreground">
                    Último serviço: {new Date(lastService).toLocaleDateString("pt-BR")}
                  </div>
                )}
              </button>
            </div>
          ))}
          {stats.length === 0 && (
            <div className="surface-elevated col-span-full rounded-2xl p-6 text-center text-sm text-muted-foreground">
              Nenhuma oficina neste estado.
            </div>
          )}
        </div>
      ) : (
        <div className="surface-elevated rounded-2xl p-10 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 font-display text-lg font-bold">Nenhuma oficina cadastrada</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre as oficinas que prestam serviço nas suas motos. Eventos vinculados a uma
            oficina parceira ganham peso extra no índice de conservação.
          </p>
        </div>
      )}

      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <Building2 className="h-5 w-5 shrink-0" />{" "}
                <span className="truncate">{detailWorkshop?.name}</span>
              </span>
              {detailWorkshop && (
                <button
                  type="button"
                  onClick={() => toggleFavorite(detailWorkshop.id)}
                  className="mr-6 flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-amber-400"
                >
                  <Star
                    className={`h-3.5 w-3.5 ${favoriteIds.has(detailWorkshop.id) ? "fill-amber-400 text-amber-400" : ""}`}
                  />
                  {favoriteIds.has(detailWorkshop.id) ? "De confiança" : "Marcar confiança"}
                </button>
              )}
            </DialogTitle>
          </DialogHeader>
          {detailWorkshop && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {(detailWorkshop.city || detailWorkshop.state) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{" "}
                    {[detailWorkshop.city, detailWorkshop.state].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Serviços" value={String(detailEvents.length)} />
                <Stat
                  label="Motos"
                  value={String(new Set(detailEvents.map((e) => e.motorcycle_id)).size)}
                />
                <Stat
                  label="Movimento"
                  value={brl(detailEvents.reduce((s, e) => s + Number(e.cost || 0), 0))}
                />
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <Wrench className="h-3 w-3" /> Histórico de serviços
                </div>
                <div className="max-h-72 overflow-auto rounded-xl border border-border/60">
                  {detailEvents.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Nenhum serviço registrado com esta oficina.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <tbody>
                        {detailEvents.map((e) => (
                          <tr key={e.id} className="border-b border-border/40 last:border-0">
                            <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                              {formatDate(e.occurred_at)}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {EVENT_TYPE_LABEL[e.type as keyof typeof EVENT_TYPE_LABEL] || e.type}
                            </td>
                            <td className="px-3 py-2">{e.title || "—"}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {(e.motorcycles as any)?.nickname ||
                                (e.motorcycles as any)?.model ||
                                ""}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-primary tabular-nums">
                              {brl(Number(e.cost || 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-sm font-bold">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
