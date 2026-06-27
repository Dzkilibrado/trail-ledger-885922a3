import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRANDS, uploadFile } from "@/lib/trailbook";
import { MODELS_BY_BRAND, DISPLACEMENTS, MOTO_TYPES, CONTROL_TYPES, OTHER, yearOptions, INCIDENT_DECLARATION_TEXT } from "@/lib/motorcycle-catalog";
import { PhotoPicker } from "@/components/PhotoPicker";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { usePlan } from "@/hooks/usePlan";
import { canCreateMotorcycle } from "@/lib/plans";
import { useQuery } from "@tanstack/react-query";
import { Crown, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/motorcycles/new")({
  head: () => ({ meta: [{ title: "Nova moto — TrailBook" }] }),
  component: NewMotorcycle,
});

const schema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1).max(80),
  nickname: z.string().max(60).optional(),
  year_make: z.coerce.number().int().min(1950).max(2100).optional(),
  year_model: z.coerce.number().int().min(1950).max(2100).optional(),
  displacement: z.coerce.number().int().min(50).max(2000).optional(),
  control_type: z.enum(["hours", "km", "both"]),
  chassis: z.string().max(60).optional(),
  engine_number: z.string().max(60).optional(),
  plate: z.string().max(10).optional(),
  renavam: z.string().max(20).optional(),
  hours_total: z.coerce.number().min(0).default(0),
  km_total: z.coerce.number().min(0).default(0),
});

function NewMotorcycle() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [displacement, setDisplacement] = useState("");
  const [customDisplacement, setCustomDisplacement] = useState("");
  const [yearMake, setYearMake] = useState("");
  const [yearModel, setYearModel] = useState("");
  const [motoType, setMotoType] = useState("trail_light");
  const [controlType, setControlType] = useState("hours");
  const [incident, setIncident] = useState<"yes" | "no" | "unknown">("unknown");
  const { plan } = usePlan();
  const years = useMemo(() => yearOptions(), []);
  const availableModels = MODELS_BY_BRAND[brand] ?? [];

  const motoCount = useQuery({
    queryKey: ["motorcycles", "count"],
    queryFn: async () => {
      const { count } = await supabase.from("motorcycles").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });
  const blocked = !canCreateMotorcycle(plan, motoCount.data ?? 0);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (blocked) { toast.error("Limite do plano atingido. Faça upgrade para cadastrar mais motos."); return; }
    const fd = new FormData(e.currentTarget);
    const finalModel = model === OTHER ? customModel.trim() : model;
    const finalDisp = displacement === OTHER ? customDisplacement.trim() : displacement;
    const raw = {
      ...Object.fromEntries(fd),
      brand,
      model: finalModel,
      displacement: finalDisp || undefined,
      year_make: yearMake || undefined,
      year_model: yearModel || undefined,
      control_type: controlType,
    };
    const parsed = schema.safeParse(raw);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;
      let main_photo_url: string | null = null;
      if (photo) {
        const up = await uploadFile("motorcycle-photos", photo, uid);
        main_photo_url = up.path;
      }
      const incidentDeclaration = {
        value: incident,
        accepted_at: new Date().toISOString(),
        text: incident === "no" ? INCIDENT_DECLARATION_TEXT : null,
      };
      const { data, error } = await supabase.from("motorcycles").insert({
        ...parsed.data,
        owner_id: uid,
        main_photo_url,
        incident_declaration: incidentDeclaration,
      } as never).select("id").single();
      if (error) throw error;
      // Registra declaração inicial na linha do tempo
      if (incident !== "unknown") {
        await supabase.from("events").insert({
          motorcycle_id: data.id,
          created_by: uid,
          type: "declaration",
          title: incident === "no" ? "Declaração: sem histórico de sinistro" : "Declaração: histórico de sinistro relatado",
          description: incident === "no" ? INCIDENT_DECLARATION_TEXT : "O proprietário declarou que esta motocicleta possui histórico de sinistro relevante.",
          occurred_at: new Date().toISOString(),
        } as never);
      }
      toast.success("Moto cadastrada!");
      navigate({ to: "/motorcycles/$id", params: { id: data.id } });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao cadastrar");
    } finally { setLoading(false); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Nova motocicleta"
        crumbs={[{ label: "Motos", to: "/motorcycles" }, { label: "Nova" }]}
        description="Quanto mais detalhes você informar, mais preciso fica o índice de conservação."
      />
      {blocked && (
        <div className="surface-elevated flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-sm">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            <span>Plano <strong>{plan.label}</strong> permite até {plan.limits.motorcycles} moto(s). Faça upgrade para continuar.</span>
          </div>
          <Link to="/plans"><Button size="sm" className="btn-glow">Ver planos</Button></Link>
        </div>
      )}
      <form onSubmit={onSubmit} className="surface-elevated space-y-5 rounded-2xl p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Marca" required>
            <Select value={brand} onValueChange={(v) => { setBrand(v); setModel(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{BRANDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Modelo" required>
            {availableModels.length > 0 ? (
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {availableModels.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  <SelectItem value={OTHER}>Outro modelo…</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input placeholder="ex: CRF 250F" value={customModel} onChange={(e) => { setCustomModel(e.target.value); setModel(OTHER); }} />
            )}
            {model === OTHER && availableModels.length > 0 && (
              <Input className="mt-2" placeholder="Informe o modelo" value={customModel} onChange={(e) => setCustomModel(e.target.value)} />
            )}
          </Field>
          <Field label="Apelido"><Input name="nickname" placeholder="ex: A vermelhinha" /></Field>
          <Field label="Cilindrada (cc)">
            <Select value={displacement} onValueChange={setDisplacement}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {DISPLACEMENTS.map((d) => <SelectItem key={d} value={d}>{d} cc</SelectItem>)}
                <SelectItem value={OTHER}>Outra…</SelectItem>
              </SelectContent>
            </Select>
            {displacement === OTHER && (
              <Input className="mt-2" type="number" placeholder="Informe a cilindrada em cc" value={customDisplacement} onChange={(e) => setCustomDisplacement(e.target.value)} />
            )}
          </Field>
          <Field label="Ano de fabricação">
            <Select value={yearMake} onValueChange={setYearMake}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Ano modelo">
            <Select value={yearModel} onValueChange={setYearModel}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Tipo de moto">
            <Select value={motoType} onValueChange={setMotoType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MOTO_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Tipo de controle">
            <Select value={controlType} onValueChange={setControlType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CONTROL_TYPES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Chassi"><Input name="chassis" /></Field>
          <Field label="Nº motor"><Input name="engine_number" /></Field>
          <Field label="Placa"><Input name="plate" /></Field>
          <Field label="RENAVAM"><Input name="renavam" /></Field>
          <Field label="Horas atuais"><Input name="hours_total" type="number" step="0.1" defaultValue={0} /></Field>
          <Field label="Km atuais"><Input name="km_total" type="number" step="1" defaultValue={0} /></Field>
        </div>
        <Field label="Foto principal">
          <PhotoPicker value={photo} onChange={setPhoto} label="Selecionar foto principal" hint="JPG ou PNG. Aparece no certificado público." />
        </Field>

        {/* Declaração de sinistro */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold">Histórico de sinistro</div>
                <div className="text-xs text-muted-foreground">
                  A moto já sofreu sinistro relevante (queda grave, batida, submersão, danos estruturais)?
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  { v: "no", label: "Não" },
                  { v: "yes", label: "Sim" },
                  { v: "unknown", label: "Não informado" },
                ] as const).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setIncident(o.v)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${incident === o.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {incident === "no" && (
                <p className="rounded-lg border border-border bg-background/40 p-3 text-[11px] text-muted-foreground">
                  Ao cadastrar, você aceita: <em>"{INCIDENT_DECLARATION_TEXT}"</em>
                </p>
              )}
              {incident === "yes" && (
                <p className="text-[11px] text-amber-300">
                  Após criar a moto, registre cada ocorrência usando <strong>Registrar atividade → Sinistro</strong> para compor o histórico.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" className="btn-glow" disabled={loading || blocked}>{loading ? "Salvando…" : "Cadastrar moto"}</Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/motorcycles" })}>Cancelar</Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}{required && <span className="text-primary"> *</span>}
      </Label>
      {children}
    </div>
  );
}