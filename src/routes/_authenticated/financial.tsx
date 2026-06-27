import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, EVENT_TYPE_LABEL, formatDate } from "@/lib/trailbook";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, Calendar, Download, Bike } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financial")({
  head: () => ({ meta: [{ title: "Financeiro — TrailBook" }] }),
  component: Financial,
});

type Period = "all" | "month" | "year" | "30d";

function Financial() {
  const [period, setPeriod] = useState<Period>("all");
  const [motoId, setMotoId] = useState<string>("all");

  const motos = useQuery({
    queryKey: ["motorcycles"],
    queryFn: async () => (await supabase.from("motorcycles").select("id, nickname, model")).data ?? [],
  });
  const events = useQuery({
    queryKey: ["events", "all-with-cost"],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("*, motorcycles(nickname, model)").not("cost", "is", null).order("occurred_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
    const thirty = now.getTime() - 30 * 86400000;
    return (events.data ?? []).filter((e) => {
      if (motoId !== "all" && e.motorcycle_id !== motoId) return false;
      const t = new Date(e.occurred_at).getTime();
      if (period === "month" && t < startOfMonth) return false;
      if (period === "year" && t < startOfYear) return false;
      if (period === "30d" && t < thirty) return false;
      return true;
    });
  }, [events.data, period, motoId]);

  const total = filtered.reduce((s, e) => s + Number(e.cost), 0);
  const now = new Date();
  const monthTotal = (events.data ?? []).filter((e) => {
    const d = new Date(e.occurred_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, e) => s + Number(e.cost), 0);
  const yearTotal = (events.data ?? []).filter((e) => new Date(e.occurred_at).getFullYear() === now.getFullYear())
    .reduce((s, e) => s + Number(e.cost), 0);
  const allTotal = (events.data ?? []).reduce((s, e) => s + Number(e.cost), 0);

  const byType: Record<string, number> = {};
  filtered.forEach((e) => { byType[e.type] = (byType[e.type] || 0) + Number(e.cost); });
  const byMoto: Record<string, { name: string; total: number }> = {};
  filtered.forEach((e) => {
    const k = e.motorcycle_id;
    const name = (e.motorcycles as any)?.nickname || (e.motorcycles as any)?.model || "—";
    byMoto[k] = byMoto[k] || { name, total: 0 };
    byMoto[k].total += Number(e.cost);
  });

  function exportCsv() {
    const rows = [
      ["Data", "Moto", "Tipo", "Título", "Valor"],
      ...filtered.map((e) => [
        formatDate(e.occurred_at),
        (e.motorcycles as any)?.nickname || (e.motorcycles as any)?.model || "",
        EVENT_TYPE_LABEL[e.type as keyof typeof EVENT_TYPE_LABEL] || e.type,
        e.title || "",
        Number(e.cost).toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `trailbook-financeiro-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        description="Acompanhe quanto cada motocicleta custa em peças, mão de obra e acessórios."
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi icon={DollarSign} label="Total acumulado" value={brl(allTotal)} accent="primary" />
        <Kpi icon={Calendar} label="Mês atual" value={brl(monthTotal)} />
        <Kpi icon={TrendingUp} label={String(now.getFullYear())} value={brl(yearTotal)} />
      </div>

      {/* Filtros */}
      <div className="surface-elevated flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo o período</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="month">Mês atual</SelectItem>
            <SelectItem value="year">Ano atual</SelectItem>
          </SelectContent>
        </Select>
        <Select value={motoId} onValueChange={setMotoId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Todas as motos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as motos</SelectItem>
            {(motos.data ?? []).map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.nickname || m.model}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm text-muted-foreground">
          {filtered.length} lançamento(s) · {brl(total)}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="surface-elevated rounded-2xl p-5">
          <h2 className="mb-3 font-display font-bold">Por tipo de evento</h2>
          <div className="space-y-2">
            {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, v]) => (
              <div key={t} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{EVENT_TYPE_LABEL[t as keyof typeof EVENT_TYPE_LABEL] ?? t}</span>
                  <span className="font-semibold">{brl(v)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${total > 0 ? (v / total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
            {Object.keys(byType).length === 0 && <div className="text-sm text-muted-foreground">Sem gastos no filtro.</div>}
          </div>
        </div>

        <div className="surface-elevated rounded-2xl p-5">
          <h2 className="mb-3 font-display font-bold">Por motocicleta</h2>
          <div className="space-y-2">
            {Object.entries(byMoto).sort((a, b) => b[1].total - a[1].total).map(([k, m]) => (
              <div key={k} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground"><Bike className="h-3 w-3" /> {m.name}</span>
                  <span className="font-semibold">{brl(m.total)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${total > 0 ? (m.total / total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
            {Object.keys(byMoto).length === 0 && <div className="text-sm text-muted-foreground">—</div>}
          </div>
        </div>

        <div className="surface-elevated rounded-2xl p-5">
          <h2 className="mb-3 font-display font-bold">Últimos lançamentos</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filtered.slice(0, 15).map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-3 border-b border-border/40 pb-2 text-sm last:border-0">
                <div className="min-w-0">
                  <div className="truncate font-medium">{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(e.occurred_at)} · {(e.motorcycles as any)?.nickname || (e.motorcycles as any)?.model}
                  </div>
                </div>
                <div className="shrink-0 font-semibold text-primary">{brl(Number(e.cost))}</div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-sm text-muted-foreground">
                Nenhum lançamento. Registre custos abrindo uma moto e clicando em <strong>Registrar atividade</strong>.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="surface-elevated rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        💡 <strong>Como registrar despesas:</strong> abra a motocicleta, clique em <Link to="/motorcycles" className="text-primary underline">Registrar atividade</Link>,
        preencha o campo <strong>Custo R$</strong>. Todo evento com custo aparece aqui automaticamente.
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: "primary" }) {
  return (
    <div className="surface-elevated rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${accent ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className={`font-display text-xl font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
        </div>
      </div>
    </div>
  );
}