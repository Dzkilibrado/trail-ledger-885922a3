import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TBLoadingState } from "@/design-system";
import { BRANDS } from "@/lib/trailbook";
import { yearOptions } from "@/lib/motorcycle-catalog";

export const Route = createFileRoute("/_authenticated/motorcycles/$id/editar")({
  head: () => ({ meta: [{ title: "Editar dados da moto — TrailBook" }] }),
  component: EditMotorcyclePage,
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function EditMotorcyclePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

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

  const years = yearOptions();

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
    navigate({ to: "/motorcycles/$id/control", params: { id } });
  }

  if (moto.isLoading) return <TBLoadingState label="Carregando dados da moto…" />;
  if (moto.isError || !moto.data) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-3 text-center">
        <p className="text-sm text-muted-foreground">Não foi possível carregar esta moto.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 pb-24">
      <PageHeader
        title="Editar dados da moto"
        crumbs={[
          { label: "Minhas Motos", to: "/motorcycles" },
          {
            label: moto.data.nickname || moto.data.model,
            to: "/motorcycles/$id",
            params: { id } as never,
          },
          { label: "Editar" },
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
            <Select value={form.brand ?? ""} onValueChange={(v) => set("brand", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {BRANDS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
                {!BRANDS.includes(form.brand) && form.brand && (
                  <SelectItem value={form.brand}>{form.brand}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Modelo">
            <Input value={form.model ?? ""} onChange={(e) => set("model", e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Ano fabricação">
            <Select value={form.year_make ?? ""} onValueChange={(v) => set("year_make", v)}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Ano modelo">
            <Select value={form.year_model ?? ""} onValueChange={(v) => set("year_model", v)}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <p className="mb-3 text-xs text-muted-foreground">
            Identificação — o <strong>chassi</strong> é o único campo exigido para emitir laudos.
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
          <Button type="submit" disabled={saving} className="flex-1 btn-glow">
            {saving ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      </form>
    </div>
  );
}
