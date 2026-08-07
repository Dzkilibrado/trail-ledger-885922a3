import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, EVENT_TYPE_LABEL, formatDate } from "@/lib/trailbook";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DollarSign, TrendingUp, Calendar, Bike, Search, X } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import type { ExportColumn } from "@/lib/exports";
import { useActiveMotorcycles } from "@/hooks/useActiveMotorcycle";

export const Route = createFileRoute("/_authenticated/financial")({
  head: () => ({ meta: [{ title: "Financeiro — TrailBook" }] }),
  component: Financial,
});

type Period = "all" | "month" | "year" | "30d";

function Financial() {
  const [period, setPeriod] = useState<Period>("all");
  const [motoId, setMotoId] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [workshopId, setWorkshopId] = useState<string>("all");
  const [search, setSearch] = useState("");

  const motos = useActiveMotorcycles();
  const workshops = useQuery({
    queryKey: ["workshops", "list"],
    queryFn: async () =>
      (await supabase.from("workshops_public").select("id, name").order("name")).data ?? [],
  });
  const events = useQuery({
    queryKey: ["events", "all-with-cost"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("*, motorcycles(nickname, model), workshops(name)")
        .not("cost", "is", null)
        .order("occurred_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
    const thirty = now.getTime() - 30 * 86400000;
    const q = search.trim().toLowerCase();
    return (events.data ?? []).filter((e) => {
      // Motos arquivadas não entram no financeiro operacional.
      // Se `motos` já carregou, exige que o event.motorcycle_id esteja
      // entre as motos ativas do usuário.
      const activeIds = motos.data ? new Set(motos.data.map((m) => m.id)) : null;
      if (activeIds && !activeIds.has(e.motorcycle_id as string)) return false;
      if (motoId !== "all" && e.motorcycle_id !== motoId) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (workshopId !== "all" && e.workshop_id !== workshopId) return false;
      const t = new Date(e.occurred_at).getTime();
      if (period === "month" && t < startOfMonth) return false;
      if (period === "year" && t < startOfYear) return false;
      if (period === "30d" && t < thirty) return false;
      if (q) {
        const hay =
          `${e.title ?? ""} ${e.description ?? ""} ${(e.motorcycles as any)?.nickname ?? ""} ${(e.motorcycles as any)?.model ?? ""} ${(e.workshops as any)?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events.data, motos.data, period, motoId, typeFilter, workshopId, search]);

  // KPIs também respeitam o filtro de motos arquivadas.
  const activeIds = useMemo(
    () => (motos.data ? new Set(motos.data.map((m) => m.id)) : null),
    [motos.data],
  );
  const activeEvents = useMemo(
    () =>
      activeIds
        ? (events.data ?? []).filter((e) => activeIds.has(e.motorcycle_id as string))
        : (events.data ?? []),
    [events.data, activeIds],
  );
  const total = filtered.reduce((s, e) => s + Number(e.cost), 0);
  const now = new Date();
  const monthTotal = activeEvents
    .filter((e) => {
      const d = new Date(e.occurred_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, e) => s + Number(e.cost), 0);
  const yearTotal = activeEvents
    .filter((e) => new Date(e.occurred_at).getFullYear() === now.getFullYear())
    .reduce((s, e) => s + Number(e.cost), 0);
  const allTotal = activeEvents.reduce((s, e) => s + Number(e.cost), 0);

  const byType: Record<string, number> = {};
  filtered.forEach((e) => {
    byType[e.type] = (byType[e.type] || 0) + Number(e.cost);
  });
  const byMoto: Record<string, { name: string; total: number }> = {};
  filtered.forEach((e) => {
    const k = e.motorcycle_id;
    const name = (e.motorcycles as any)?.nickname || (e.motorcycles as any)?.model || "—";
    byMoto[k] = byMoto[k] || { name, total: 0 };
    byMoto[k].total += Number(e.cost);
  });

  const exportColumns: ExportColumn<any>[] = [
    { key: "date", label: "Data", value: (e) => formatDate(e.occurred_at) },
    {
      key: "moto",
      label: "Moto",
      value: (e) => e.motorcycles?.nickname || e.motorcycles?.model || "",
    },
    {
      key: "type",
      label: "Tipo",
      value: (e) => EVENT_TYPE_LABEL[e.type as keyof typeof EVENT_TYPE_LABEL] || e.type,
    },
    { key: "title", label: "Título", value: (e) => e.title || "" },
    { key: "workshop", label: "Oficina", value: (e) => e.workshops?.name || "" },
    { key: "km", label: "KM", value: (e) => (e.km_at_event ?? "") as any, align: "right" },
    { key: "cost", label: "Valor (R$)", value: (e) => Number(e.cost).toFixed(2), align: "right" },
  ];

  function clearFilters() {
    setPeriod("all");
    setMotoId("all");
    setTypeFilter("all");
    setWorkshopId("all");
    setSearch("");
  }

  const activeFilters =
    (period !== "all" ? 1 : 0) +
    (motoId !== "all" ? 1 : 0) +
    (typeFilter !== "all" ? 1 : 0) +
    (workshopId !== "all" ? 1 : 0) +
    (search ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        description="Acompanhe quanto cada motocicleta custa em peças, mão de obra e acessórios."
        actions={
          <ExportMenu
            filename="trailbook-financeiro"
            title="Financeiro — TrailBook"
            subtitle={`${filtered.length} lançamento(s) · Total ${brl(total)}`}
            columns={exportColumns}
            rows={filtered}
          />
        }
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi icon={DollarSign} label="Total acumulado" value={brl(allTotal)} accent="primary" />
        <Kpi icon={Calendar} label="Mês atual" value={brl(monthTotal)} />
        <Kpi icon={TrendingUp} label={String(now.getFullYear())} value={brl(yearTotal)} />
      </div>

      {/* Filtros */}
      <div className="surface-elevated flex flex-wrap items-center gap-2 rounded-2xl p-3">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo o período</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="month">Mês atual</SelectItem>
            <SelectItem value="year">Ano atual</SelectItem>
          </SelectContent>
        </Select>
        <Select value={motoId} onValueChange={setMotoId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todas as motos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as motos</SelectItem>
            {(motos.data ?? []).map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.nickname || m.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(EVENT_TYPE_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={workshopId} onValueChange={setWorkshopId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todas as oficinas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as oficinas</SelectItem>
            {(workshops.data ?? [])
              .filter((w) => w.id && w.name)
              .map((w) => (
                <SelectItem key={w.id!} value={w.id!}>
                  {w.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="h-9 w-56 pl-7"
          />
        </div>
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
        )}
        <div className="ml-auto text-sm text-muted-foreground">
          {filtered.length} lançamento(s) · {brl(total)}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="surface-elevated rounded-2xl p-5">
          <h2 className="mb-3 font-display font-bold">Por tipo de evento</h2>
          <div className="space-y-2">
            {Object.entries(byType)
              .sort((a, b) => b[1] - a[1])
              .map(([t, v]) => (
                <div key={t} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {EVENT_TYPE_LABEL[t as keyof typeof EVENT_TYPE_LABEL] ?? t}
                    </span>
                    <span className="shrink-0 font-semibold">{brl(v)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${total > 0 ? (v / total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            {Object.keys(byType).length === 0 && (
              <div className="text-sm text-muted-foreground">Sem gastos no filtro.</div>
            )}
          </div>
        </div>

        <div className="surface-elevated rounded-2xl p-5">
          <h2 className="mb-3 font-display font-bold">Por motocicleta</h2>
          <div className="space-y-2">
            {Object.entries(byMoto)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([k, m]) => (
                <div key={k} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                      <Bike className="h-3 w-3 shrink-0" />{" "}
                      <span className="truncate">{m.name}</span>
                    </span>
                    <span className="shrink-0 font-semibold">{brl(m.total)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${total > 0 ? (m.total / total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            {Object.keys(byMoto).length === 0 && (
              <div className="text-sm text-muted-foreground">—</div>
            )}
          </div>
        </div>

        <div className="surface-elevated rounded-2xl p-5">
          <h2 className="mb-3 font-display font-bold">Últimos lançamentos</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filtered.slice(0, 15).map((e) => (
              <div
                key={e.id}
                className="flex items-start justify-between gap-3 border-b border-border/40 pb-2 text-sm last:border-0"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(e.occurred_at)} ·{" "}
                    {(e.motorcycles as any)?.nickname || (e.motorcycles as any)?.model}
                  </div>
                </div>
                <div className="shrink-0 font-semibold text-primary">{brl(Number(e.cost))}</div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-sm text-muted-foreground">
                Nenhum lançamento. Registre custos abrindo uma moto e clicando em{" "}
                <strong>Registrar atividade</strong>.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detalhamento */}
      <div className="surface-elevated overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-border/60 p-4">
          <h2 className="font-display font-bold">Detalhamento</h2>
          <span className="text-xs text-muted-foreground">{filtered.length} lançamento(s)</span>
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium">Moto</th>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-4 py-2 font-medium">Título</th>
                <th className="px-4 py-2 font-medium">Oficina</th>
                <th className="px-4 py-2 text-right font-medium">KM</th>
                <th className="px-4 py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                    {formatDate(e.occurred_at)}
                  </td>
                  <td className="px-4 py-2">
                    {(e.motorcycles as any)?.nickname || (e.motorcycles as any)?.model || "—"}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {EVENT_TYPE_LABEL[e.type as keyof typeof EVENT_TYPE_LABEL] || e.type}
                  </td>
                  <td className="px-4 py-2">{e.title || "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {(e.workshops as any)?.name || "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {e.km_at_event ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-primary tabular-nums">
                    {brl(Number(e.cost))}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum lançamento no filtro atual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="surface-elevated rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        💡 <strong>Como registrar despesas:</strong> abra a motocicleta, clique em{" "}
        <Link to="/motorcycles" className="text-primary underline">
          Registrar atividade
        </Link>
        , preencha o campo <strong>Custo R$</strong>. Todo evento com custo aparece aqui
        automaticamente.
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  accent?: "primary";
}) {
  return (
    <div className="surface-elevated rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <div
          className={`grid h-10 w-10 place-items-center rounded-xl ${accent ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className={`font-display text-xl font-bold ${accent ? "text-primary" : ""}`}>
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}
