import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bike, ChevronRight, ClipboardList, Info, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TBLoadingState, TBEmptyState } from "@/design-system";
import { BRANDS } from "@/lib/trailbook";
import { PhotoReplace } from "@/components/PhotoReplace";
import { EventActionsMenu } from "@/components/EventActionsMenu";

export const Route = createFileRoute("/_authenticated/motorcycles/$id/editar")({
  head: () => ({ meta: [{ title: "Editar dados da moto — TrailBook" }] }),
  component: EditMotorcyclePage,
});

// Cartão de seção clicável — navega para uma sub-página de edição
function SectionCard({
  icon: Icon,
  title,
  description,
  onClick,
  accent,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
  accent?: "amber";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group w-full flex items-center gap-4 rounded-2xl border bg-card p-5 text-left transition-colors hover:bg-accent/50",
        accent === "amber" ? "border-amber-500/40" : "border-border",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          accent === "amber"
            ? "bg-amber-500/10 text-amber-500"
            : "bg-primary/10 text-primary",
        ].join(" ")}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
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

// Vista que está ativa dentro da página de edição
type EditView = "menu" | "dados" | "uso";

function EditMotorcyclePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<EditView>("menu");

  const moto = useQuery({
    queryKey: ["motorcycle", id, "edit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorcycles")
        .select(
          "id, nickname, brand, model, year_make, year_model, displacement, plate, chassis, engine_number, renavam",
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Lançamentos de uso — últimos 30, ordenados do mais recente ao mais antigo.
  const [usagePage, setUsagePage] = useState(20);
  const usageEvents = useQuery({
    queryKey: ["usage-events-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, motorcycle_id, type, title, description, occurred_at, hours_delta, km_delta, cost")
        .eq("motorcycle_id", id)
        .eq("type", "usage")
        .order("occurred_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const hydratedRef = useRef(false);
  useEffect(() => {
    // Só copia os dados do banco pro formulário UMA vez, no primeiro
    // carregamento. Sem essa trava, qualquer nova busca em segundo plano
    // (ex: refetchOnMount) sobrescreveria o que o usuário está digitando
    // com o que ainda está salvo no banco — apagando edições em andamento.
    if (!moto.data || hydratedRef.current) return;
    hydratedRef.current = true;
    setForm({
      nickname: moto.data.nickname ?? "",
      brand: moto.data.brand ?? "",
      model: moto.data.model ?? "",
      year_make: moto.data.year_make ? String(moto.data.year_make) : "",
      year_model: moto.data.year_model ? String(moto.data.year_model) : "",
      displacement: moto.data.displacement ? String(moto.data.displacement) : "",
      plate: moto.data.plate ?? "",
      chassis: moto.data.chassis ?? "",
      engine_number: moto.data.engine_number ?? "",
      renavam: moto.data.renavam ?? "",
    });
  }, [moto.data]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.brand?.trim()) return toast.error("Informe a marca.");
    if (!form.model?.trim()) return toast.error("Informe o modelo.");

    setSaving(true);
    const payload = {
      nickname: form.nickname.trim() || null,
      brand: form.brand.trim(),
      model: form.model.trim(),
      year_make: form.year_make ? Number(form.year_make) : null,
      year_model: form.year_model ? Number(form.year_model) : null,
      displacement: form.displacement ? Number(form.displacement) : null,
      plate: form.plate.trim() || null,
      chassis: form.chassis.trim() || null,
      engine_number: form.engine_number.trim() || null,
      renavam: form.renavam.trim() || null,
    };
    const { data: updated, error } = await supabase
      .from("motorcycles")
      .update(payload as never)
      .eq("id", id)
      .select(
        "nickname, brand, model, year_make, year_model, displacement, plate, chassis, engine_number, renavam",
      )
      .single();
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar as alterações", { description: error.message });
      return;
    }
    // Confere se o que voltou do banco bate com o que foi enviado — se algo
    // divergir (ex: uma trava silenciosa), avisa em vez de fingir sucesso.
    const mismatch = (Object.keys(payload) as (keyof typeof payload)[]).find(
      (k) => (updated as any)?.[k] !== payload[k],
    );
    if (mismatch) {
      toast.error("Os dados não foram salvos como esperado", {
        description: `O campo "${mismatch}" não foi atualizado corretamente. Tente novamente ou fale com o suporte.`,
      });
      return;
    }
    await qc.invalidateQueries();
    toast.success("Dados da moto atualizados.");
    navigate({
      to: "/motorcycles/$id/control",
      params: { id },
      search: { action: undefined, tab: undefined },
    });
  }

  if (moto.isLoading) return <TBLoadingState label="Carregando dados da moto…" />;
  if (moto.isError || !moto.data) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-3 text-center">
        <p className="text-sm text-muted-foreground">Não foi possível carregar esta moto.</p>
      </div>
    );
  }

  const motoLabel = moto.data.nickname || moto.data.model;

  // ── View: Menu principal ──────────────────────────────────────────────────
  if (view === "menu") {
    return (
      <div className="mx-auto w-full max-w-xl space-y-6 pb-24">
        <PageHeader
          title="Editar moto"
          crumbs={[
            { label: "Minhas Motos", to: "/motorcycles" },
            { label: motoLabel, to: `/motorcycles/${id}` },
            { label: "Editar" },
          ]}
          description={`Selecione o que deseja ajustar em ${motoLabel}.`}
        />

        <div className="space-y-3">
          <SectionCard
            icon={Bike}
            title="Dados cadastrais"
            description="Edite nome, marca, modelo, ano, chassi, placa e foto da moto."
            onClick={() => setView("dados")}
          />
          <SectionCard
            icon={ClipboardList}
            title="Gerenciar lançamentos de uso"
            description="Corrija ou exclua registros de horas/quilômetros lançados incorretamente."
            onClick={() => setView("uso")}
            accent="amber"
          />
        </div>
      </div>
    );
  }

  // ── View: Dados cadastrais ─────────────────────────────────────────────────
  if (view === "dados") {
    return (
      <div className="mx-auto w-full max-w-xl space-y-6 pb-24">
        <PageHeader
          title="Dados cadastrais"
          crumbs={[
            { label: "Minhas Motos", to: "/motorcycles" },
            { label: motoLabel, to: `/motorcycles/${id}` },
            { label: "Editar" },
            { label: "Dados cadastrais" },
          ]}
          description="Corrija qualquer campo preenchido errado no cadastro — nada aqui afeta o histórico de manutenções já registrado."
        />

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <Field label="Apelido">
            <Input
              value={form.nickname ?? ""}
              onChange={(e) => set("nickname", e.target.value)}
              placeholder="Como você chama a moto"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Marca">
              <Input
                value={form.brand ?? ""}
                onChange={(e) => set("brand", e.target.value)}
                list="brand-suggestions"
              />
              <datalist id="brand-suggestions">
                {BRANDS.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </Field>
            <Field label="Modelo">
              <Input value={form.model ?? ""} onChange={(e) => set("model", e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Ano fabricação">
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Ex: 2020"
                min={1950}
                max={2100}
                value={form.year_make ?? ""}
                onChange={(e) => set("year_make", e.target.value)}
              />
            </Field>
            <Field label="Ano modelo">
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Ex: 2020"
                min={1950}
                max={2100}
                value={form.year_model ?? ""}
                onChange={(e) => set("year_model", e.target.value)}
              />
            </Field>
            <Field label="Cilindrada (cc)">
              <Input
                type="number"
                inputMode="numeric"
                value={form.displacement ?? ""}
                onChange={(e) => set("displacement", e.target.value)}
              />
            </Field>
          </div>

          <div className="rounded-xl border border-dashed border-border p-4">
            <p className="text-xs text-muted-foreground">
              Identificação — o <strong>chassi</strong> é o único campo exigido para emitir laudos.
            </p>
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <div className="text-sm font-semibold">Foto da moto</div>
            <p className="text-xs text-muted-foreground">
              Toque em uma foto para defini-la como principal ou removê-la.
            </p>
            <PhotoReplace motorcycleId={id} />
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground px-1">
              Placa e Renavam ficam em branco normalmente em motos de trilha/motocross.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Chassi">
                <Input value={form.chassis ?? ""} onChange={(e) => set("chassis", e.target.value)} />
              </Field>
              <Field label="Número do motor">
                <Input
                  value={form.engine_number ?? ""}
                  onChange={(e) => set("engine_number", e.target.value)}
                />
              </Field>
              <Field label="Placa (opcional)">
                <Input value={form.plate ?? ""} onChange={(e) => set("plate", e.target.value)} />
              </Field>
              <Field label="Renavam (opcional)">
                <Input value={form.renavam ?? ""} onChange={(e) => set("renavam", e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={saving}
              onClick={() => setView("menu")}
            >
              Voltar
            </Button>
            <Button type="submit" disabled={saving} className="flex-1 btn-glow">
              {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // ── View: Gerenciar lançamentos de uso ─────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-xl space-y-6 pb-24">
      <PageHeader
        title="Gerenciar lançamentos de uso"
        crumbs={[
          { label: "Minhas Motos", to: "/motorcycles" },
          { label: motoLabel, to: `/motorcycles/${id}` },
          { label: "Editar" },
          { label: "Lançamentos de uso" },
        ]}
        description="Corrija ou exclua registros de horas ou quilômetros lançados com valor incorreto."
      />

      {/* Aviso de impacto */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-4">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Atenção</p>
          <p className="text-xs text-amber-600/90 dark:text-amber-400/90">
            Ao editar ou excluir um lançamento, o TrailBook recalcula automaticamente o hodômetro
            total, a agenda de manutenção e todos os alertas desta moto.
          </p>
        </div>
      </div>

      {/* Lista de lançamentos */}
      <div className="rounded-2xl border border-border bg-card">
        {usageEvents.isLoading ? (
          <div className="p-5">
            <TBLoadingState label="Carregando lançamentos…" />
          </div>
        ) : !usageEvents.data || usageEvents.data.length === 0 ? (
          <div className="p-5">
            <TBEmptyState
              title="Nenhum lançamento ainda"
              description="Os registros de uso desta moto aparecerão aqui assim que forem cadastrados."
            />
          </div>
        ) : (
          <>
            {/* Cabeçalho da lista */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {usageEvents.data.length} registro{usageEvents.data.length !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-muted-foreground">mais recente primeiro</span>
            </div>

            <ul className="divide-y divide-border">
              {usageEvents.data.slice(0, usagePage).map((ev) => {
                const delta = ev.hours_delta != null ? ev.hours_delta : ev.km_delta;
                const unitLabel = ev.hours_delta != null ? "h" : "km";
                const deltaFormatted =
                  delta != null
                    ? delta.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " " + unitLabel
                    : "—";
                const dateFormatted = new Date(ev.occurred_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });
                return (
                  <li key={ev.id} className="flex items-center gap-3 px-5 py-4">
                    {/* Ícone de uso */}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{deltaFormatted}</span>
                      <span className="text-xs text-muted-foreground">{dateFormatted}</span>
                    </div>
                    <EventActionsMenu
                      event={ev as any}
                      onChanged={() => {
                        qc.invalidateQueries({ queryKey: ["usage-events-edit", id] });
                        qc.invalidateQueries({ queryKey: ["usage-history-avg", id] });
                      }}
                    />
                  </li>
                );
              })}
            </ul>

            {usageEvents.data.length > usagePage && (
              <div className="border-t border-border p-3">
                <button
                  onClick={() => setUsagePage((p) => p + 20)}
                  className="w-full rounded-xl py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Ver mais ({usageEvents.data.length - usagePage} restantes)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <Button variant="outline" className="w-full" onClick={() => setView("menu")}>
        Voltar ao menu de edição
      </Button>
    </div>
  );
}
