import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BRANDS, uploadFile } from "@/lib/trailbook";
import {
  MODELS_BY_BRAND, DISPLACEMENTS, MOTO_TYPES, CONTROL_TYPES, OTHER,
  yearOptions, INCIDENT_DECLARATION_TEXT,
  useCatalogBrands, useCatalogTypes, useCatalogModels, useCatalogEngines, useCatalogModelDefaults,
} from "@/lib/motorcycle-catalog";
import { USE_PROFILES, type UseProfile } from "@/lib/plan-templates";
import { PhotoPicker } from "@/components/PhotoPicker";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { usePlan } from "@/hooks/usePlan";
import { canCreateMotorcycle } from "@/lib/plans";
import { useQuery } from "@tanstack/react-query";
import { Crown, ShieldAlert, CheckCircle2, Pencil, Info } from "lucide-react";

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
  control_type: z.enum(["hours", "km", "both", "not_informed"]),
  chassis: z.string().max(60).optional(),
  engine_number: z.string().max(60).optional(),
  plate: z.string().max(10).optional(),
  renavam: z.string().max(20).optional(),
  hours_total: z.coerce.number().min(0).default(0),
  km_total: z.coerce.number().min(0).default(0),
  condition: z.enum(["new", "used"]),
  catalog_model_id: z.string().uuid().nullable().optional(),
});

function NewMotorcycle() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [motoType, setMotoType] = useState<string>("");
  const [brand, setBrand] = useState("");
  const [brandId, setBrandId] = useState<string | null>(null);
  const [customBrand, setCustomBrand] = useState("");
  const [model, setModel] = useState("");
  const [modelId, setModelId] = useState<string | null>(null);
  const [customModel, setCustomModel] = useState("");
  const [displacement, setDisplacement] = useState("");
  const [customDisplacement, setCustomDisplacement] = useState("");
  const [yearMake, setYearMake] = useState("");
  const [yearModel, setYearModel] = useState("");
  const [controlType, setControlType] = useState("hours");
  const [condition, setCondition] = useState<"new" | "used">("used");
  const [hoursTotal, setHoursTotal] = useState<string>("0");
  const [kmTotal, setKmTotal] = useState<string>("0");
  const [incident, setIncident] = useState<"yes" | "no" | "unknown">("unknown");
  const [useProfile, setUseProfile] = useState<UseProfile>("normal");
  const [useProfileNote, setUseProfileNote] = useState("");
  const [applyPlan, setApplyPlan] = useState<"review" | "auto" | "skip">("review");
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<"edit" | "review">("edit");
  const [draft, setDraft] = useState<z.infer<typeof schema> | null>(null);
  const { plan } = usePlan();
  const years = useMemo(() => yearOptions(), []);

  // Catálogo mestre
  const catTypes = useCatalogTypes();
  const catBrands = useCatalogBrands();
  const catModels = useCatalogModels(brandId, motoType || null);
  const catEngines = useCatalogEngines(modelId);
  const catDefaults = useCatalogModelDefaults(modelId);

  // Fallback quando catálogo vazio: usa lista legada por marca
  const legacyModels = MODELS_BY_BRAND[brand] ?? [];
  const showModelFallback = !!brand && !brandId && legacyModels.length > 0;

  // Aplica sugestão de tipo de controle vinda do catálogo
  const suggested = catDefaults.data?.suggested_control_type;
  const suggestionApplied = useMemo(() => ({ modelId, suggested }), [modelId, suggested]);
  useMemo(() => {
    if (suggestionApplied.suggested && suggestionApplied.modelId) {
      setControlType(suggestionApplied.suggested);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestionApplied.modelId, suggestionApplied.suggested]);

  const motoCount = useQuery({
    queryKey: ["motorcycles", "count"],
    queryFn: async () => {
      const { count } = await supabase.from("motorcycles").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });
  const blocked = !canCreateMotorcycle(plan, motoCount.data ?? 0);

  function goReview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (blocked) { toast.error("Limite do plano atingido. Faça upgrade para cadastrar mais motos."); return; }
    const fd = new FormData(e.currentTarget);
    const finalBrand = brand === OTHER ? customBrand.trim() : brand;
    const finalModel = model === OTHER ? customModel.trim() : model;
    const finalDisp = displacement === OTHER ? customDisplacement.trim() : displacement;
    if (!motoType) { toast.error("Selecione o tipo da moto."); return; }
    if (!finalBrand) { toast.error("Selecione a marca."); return; }
    if (!finalModel) { toast.error("Informe o modelo."); return; }
    // Nova → força zeros; Usada → exige leitura conforme controle
    const isNew = condition === "new";
    const parsedHours = isNew ? 0 : Number(hoursTotal || 0);
    const parsedKm = isNew ? 0 : Number(kmTotal || 0);
    if (!isNew) {
      if ((controlType === "hours" || controlType === "both") && !(parsedHours > 0)) {
        toast.error("Informe o horímetro atual da moto usada."); return;
      }
      if ((controlType === "km" || controlType === "both") && !(parsedKm > 0)) {
        toast.error("Informe o KM atual da moto usada."); return;
      }
    }
    const raw = {
      ...Object.fromEntries(fd),
      brand: finalBrand,
      model: finalModel,
      displacement: finalDisp || undefined,
      year_make: yearMake || undefined,
      year_model: yearModel || undefined,
      control_type: controlType,
      condition,
      catalog_model_id: modelId,
      hours_total: parsedHours,
      km_total: parsedKm,
    };
    const parsed = schema.safeParse(raw);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (useProfile === "other" && !useProfileNote.trim()) {
      toast.error("Descreva o perfil de uso."); return;
    }
    setDraft(parsed.data);
    setMode("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function confirmAndSave() {
    if (!draft) return;
    if (blocked) { toast.error("Limite do plano atingido."); return; }
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
        ...draft,
        owner_id: uid,
        main_photo_url,
        incident_declaration: incidentDeclaration,
        use_profile: useProfile,
        use_profile_note: useProfile === "other" ? (useProfileNote.trim() || null) : null,
        // Moto nova: revisão marcada como skipped (não precisa revisar plano);
        // Moto usada: pending — dispara banner de revisão no dashboard da moto.
        plan_review_status: draft.condition === "new" ? "skipped" : "pending",
      } as never).select("id").single();
      if (error) throw error;
      // Se subiu foto principal no cadastro, registra na galeria
      if (main_photo_url) {
        await supabase.from("motorcycle_photos").insert({
          motorcycle_id: data.id,
          storage_path: main_photo_url,
          bucket: "motorcycle-photos",
          position: 0,
          is_primary: true,
          created_by: uid,
        } as never);
      }
      // Observação geral, se preenchida
      if (notes.trim()) {
        await supabase.from("events").insert({
          motorcycle_id: data.id,
          created_by: uid,
          type: "note",
          title: "Observação inicial",
          description: notes.trim(),
          occurred_at: new Date().toISOString(),
        } as never);
      }
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
      if (applyPlan === "skip" || applyPlan === "auto") {
        // "auto" também não abre wizard — aplicaremos o plano padrão em segundo plano no futuro.
        // Por ora, "auto" leva para a moto (o usuário pode aplicar depois).
        navigate({ to: "/motorcycles/$id", params: { id: data.id } });
      } else {
        navigate({ to: "/motorcycles/$id/plan", params: { id: data.id }, search: { first: true } });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao cadastrar");
    } finally { setLoading(false); }
  }

  const finalModelLabel = model === OTHER ? customModel : model;
  const finalDispLabel = displacement === OTHER ? customDisplacement : displacement;

  if (mode === "review" && draft) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Revisar e confirmar"
          crumbs={[{ label: "Motos", to: "/motorcycles" }, { label: "Nova", }, { label: "Revisão" }]}
          description="Confira as informações antes de salvar. Você pode voltar para editar qualquer seção."
        />
        <div className="surface-elevated space-y-4 rounded-2xl p-6">
          <ReviewSection title="Dados da motocicleta" onEdit={() => setMode("edit")}>
            <Kv k="Marca" v={brand} />
            <Kv k="Modelo" v={finalModelLabel} />
            <Kv k="Apelido" v={draft.nickname || "—"} />
            <Kv k="Cilindrada" v={finalDispLabel ? `${finalDispLabel} cc` : "—"} />
            <Kv k="Ano fabricação" v={draft.year_make ? String(draft.year_make) : "—"} />
            <Kv k="Ano modelo" v={draft.year_model ? String(draft.year_model) : "—"} />
            <Kv
              k="Tipo de moto"
              v={
                (catTypes.data ?? []).find((t) => t.code === motoType)?.label
                ?? MOTO_TYPES.find((t) => t.value === motoType)?.label
                ?? motoType
                ?? "—"
              }
            />
            <Kv k="Estado" v={draft.condition === "new" ? "Nova" : "Usada / Seminova"} />
            <Kv k="Controle" v={CONTROL_TYPES.find((c) => c.value === controlType)?.label ?? "—"} />
            <Kv k="Chassi" v={draft.chassis || "—"} />
            <Kv k="Nº motor" v={draft.engine_number || "—"} />
            <Kv k="Placa" v={draft.plate || "—"} />
            <Kv k="RENAVAM" v={draft.renavam || "—"} />
            <Kv k="Horas" v={`${draft.hours_total ?? 0} h`} />
            <Kv k="Km" v={`${draft.km_total ?? 0} km`} />
          </ReviewSection>

          <ReviewSection title="Foto principal" onEdit={() => setMode("edit")}>
            {photo ? (
              <div className="flex items-center gap-3 text-sm">
                <img src={URL.createObjectURL(photo)} alt="" className="h-20 w-20 rounded-lg object-cover" />
                <div>
                  <div className="font-medium">{photo.name}</div>
                  <div className="text-xs text-muted-foreground">Será definida como foto principal.</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma foto selecionada. Você poderá adicionar depois em <strong>Fotos da moto</strong>.</p>
            )}
          </ReviewSection>

          <ReviewSection title="Perfil de uso e plano" onEdit={() => setMode("edit")}>
            <Kv k="Perfil" v={USE_PROFILES.find((p) => p.value === useProfile)?.label ?? "—"} />
            {useProfile === "other" && <Kv k="Descrição" v={useProfileNote || "—"} />}
            <Kv k="Plano padrão" v={
              applyPlan === "review" ? "Revisar itens no próximo passo"
              : applyPlan === "auto" ? "Aplicar automaticamente"
              : "Configurar depois"
            } />
          </ReviewSection>

          <ReviewSection title="Declaração de sinistro" onEdit={() => setMode("edit")}>
            <Kv k="Histórico" v={incident === "no" ? "Sem histórico" : incident === "yes" ? "Com histórico relatado" : "Não informado"} />
            {incident === "no" && (
              <p className="mt-2 rounded-lg border border-border bg-background/40 p-3 text-[11px] text-muted-foreground">
                <em>{INCIDENT_DECLARATION_TEXT}</em>
              </p>
            )}
          </ReviewSection>

          <ReviewSection title="Observações" onEdit={() => setMode("edit")}>
            {notes.trim() ? <p className="whitespace-pre-wrap text-sm">{notes}</p> : <p className="text-sm text-muted-foreground">Nenhuma observação.</p>}
          </ReviewSection>

          <div className="rounded-xl border border-border bg-background/40 p-3 text-xs text-muted-foreground">
            <strong className="text-foreground">Documentos e acessórios</strong> não são registrados no cadastro — depois de confirmar, você adiciona pelo módulo <strong>Documentação</strong> e por <strong>Registrar atividade → Acessório</strong>.
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setMode("edit")}>
              <Pencil className="h-4 w-4" /> Voltar e editar
            </Button>
            <Button type="button" className="btn-glow" onClick={confirmAndSave} disabled={loading}>
              <CheckCircle2 className="h-4 w-4" /> {loading ? "Salvando…" : "Confirmar e salvar"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Nova motocicleta"
        crumbs={[{ label: "Motos", to: "/motorcycles" }, { label: "Nova" }]}
        description="Preencha os dados e revise antes de salvar. Nada é gravado até você confirmar."
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
      <form onSubmit={goReview} className="surface-elevated space-y-5 rounded-2xl p-6">
        {/* Identificação — fluxo guiado pelo Catálogo Mestre */}
        <div className="rounded-2xl border border-border/60 bg-background/30 p-4 space-y-4">
          <div>
            <div className="text-sm font-semibold">Identificação da moto</div>
            <div className="text-xs text-muted-foreground">
              Selecione tipo, marca e modelo. Os campos seguintes são filtrados automaticamente. Use <em>Outro</em> quando não encontrar.
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo da moto" required>
              <Select value={motoType} onValueChange={(v) => { setMotoType(v); setModel(""); setModelId(null); setDisplacement(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(catTypes.data ?? []).map((t) => (
                    <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>
                  ))}
                  {/* fallback offline */}
                  {(catTypes.data ?? []).length === 0 && MOTO_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Marca" required>
              <Select
                value={brand}
                onValueChange={(v) => {
                  if (v === OTHER) { setBrand(OTHER); setBrandId(null); }
                  else {
                    setBrand(v);
                    const found = (catBrands.data ?? []).find((b) => b.name === v);
                    setBrandId(found?.id ?? null);
                  }
                  setModel(""); setModelId(null); setDisplacement("");
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(catBrands.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                  ))}
                  {(catBrands.data ?? []).length === 0 && BRANDS.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                  <SelectItem value={OTHER}>Outra marca…</SelectItem>
                </SelectContent>
              </Select>
              {brand === OTHER && (
                <Input className="mt-2" placeholder="Informe a marca" value={customBrand} onChange={(e) => setCustomBrand(e.target.value)} />
              )}
            </Field>
            <Field label="Modelo" required>
              {brandId && motoType ? (
                <>
                  <Select
                    value={model}
                    onValueChange={(v) => {
                      if (v === OTHER) { setModel(OTHER); setModelId(null); setDisplacement(""); return; }
                      setModel(v);
                      const found = (catModels.data ?? []).find((m) => m.name === v);
                      setModelId(found?.id ?? null);
                      setDisplacement("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={catModels.isLoading ? "Carregando…" : (catModels.data ?? []).length === 0 ? "Nenhum modelo — use Outro" : "Selecione"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(catModels.data ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                      ))}
                      <SelectItem value={OTHER}>Outro modelo…</SelectItem>
                    </SelectContent>
                  </Select>
                  {model === OTHER && (
                    <Input className="mt-2" placeholder="Informe o modelo" value={customModel} onChange={(e) => setCustomModel(e.target.value)} />
                  )}
                </>
              ) : showModelFallback ? (
                <>
                  <Select value={model} onValueChange={(v) => { setModel(v); setModelId(null); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {legacyModels.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      <SelectItem value={OTHER}>Outro modelo…</SelectItem>
                    </SelectContent>
                  </Select>
                  {model === OTHER && (
                    <Input className="mt-2" placeholder="Informe o modelo" value={customModel} onChange={(e) => setCustomModel(e.target.value)} />
                  )}
                </>
              ) : (
                <Input
                  placeholder={motoType && brand ? "ex: CRF 250F" : "Selecione tipo e marca primeiro"}
                  disabled={!brand || !motoType}
                  value={customModel}
                  onChange={(e) => { setCustomModel(e.target.value); setModel(OTHER); }}
                />
              )}
            </Field>
            <Field label="Cilindrada (cc)">
              {modelId && (catEngines.data ?? []).length > 0 ? (
                <Select value={displacement} onValueChange={setDisplacement}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(catEngines.data ?? []).map((d) => (
                      <SelectItem key={d} value={String(d)}>{d} cc</SelectItem>
                    ))}
                    <SelectItem value={OTHER}>Outra…</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Select value={displacement} onValueChange={setDisplacement}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {DISPLACEMENTS.map((d) => <SelectItem key={d} value={d}>{d} cc</SelectItem>)}
                    <SelectItem value={OTHER}>Outra…</SelectItem>
                  </SelectContent>
                </Select>
              )}
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
            <Field label="Apelido"><Input name="nickname" placeholder="ex: A vermelhinha" /></Field>
          </div>
        </div>

        {/* Estado da moto */}
        <div className="rounded-2xl border border-border/60 bg-background/30 p-4 space-y-3">
          <div>
            <div className="text-sm font-semibold">Estado da moto</div>
            <div className="text-xs text-muted-foreground">Define a leitura inicial e o fluxo de revisão do plano.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              { v: "new", label: "Nova (zero km/h)" },
              { v: "used", label: "Usada / Seminova" },
            ] as const).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setCondition(o.v)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${condition === o.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {condition === "used" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {(controlType === "hours" || controlType === "both") && (
                  <Field label="Horímetro atual (h)" required>
                    <Input type="number" step="0.1" value={hoursTotal} onChange={(e) => setHoursTotal(e.target.value)} />
                  </Field>
                )}
                {(controlType === "km" || controlType === "both") && (
                  <Field label="KM atual" required>
                    <Input type="number" step="1" value={kmTotal} onChange={(e) => setKmTotal(e.target.value)} />
                  </Field>
                )}
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Como esta moto já possui uso anterior, revise o estado atual dos itens de manutenção antes de ativar os alertas.</span>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-200">
              Horímetro e KM começam em zero. O plano de manutenção inicia zerado.
            </div>
          )}
        </div>

        {/* Tipo de controle (sugerido pelo catálogo quando disponível) */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de controle">
            <Select value={controlType} onValueChange={setControlType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CONTROL_TYPES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
            {suggested && (
              <p className="mt-1 text-[11px] text-muted-foreground">Sugestão do catálogo aplicada. Você pode alterar se preferir.</p>
            )}
          </Field>
        </div>

        {/* Dados opcionais */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Chassi"><Input name="chassis" /></Field>
          <Field label="Nº motor"><Input name="engine_number" /></Field>
          <Field label="Placa"><Input name="plate" /></Field>
          <Field label="RENAVAM"><Input name="renavam" /></Field>
        </div>

        <Field label="Foto principal">
          <PhotoPicker value={photo} onChange={setPhoto} label="Selecionar foto principal" hint="JPG ou PNG. Aparece no certificado público." />
        </Field>

        <Field label="Observações iniciais">
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas gerais sobre a moto no momento do cadastro (opcional)." />
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

        {/* Perfil de uso */}
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div>
            <div className="text-sm font-semibold">Perfil de uso</div>
            <div className="text-xs text-muted-foreground">Ajusta os intervalos sugeridos do plano de manutenção.</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo de uso">
              <Select value={useProfile} onValueChange={(v) => setUseProfile(v as UseProfile)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {USE_PROFILES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {useProfile === "other" && (
              <Field label="Descreva o uso" required>
                <Input value={useProfileNote} onChange={(e) => setUseProfileNote(e.target.value)} placeholder="ex: uso comercial em fazenda" />
              </Field>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Plano de manutenção</Label>
            <div className="flex flex-wrap gap-2">
              {([
                { v: "review", label: "Revisar antes de aplicar" },
                { v: "auto", label: "Aplicar plano recomendado" },
                { v: "skip", label: "Configurar manualmente" },
              ] as const).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setApplyPlan(o.v)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${applyPlan === o.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" className="btn-glow" disabled={loading || blocked}>Revisar e confirmar</Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/motorcycles" })}>Cancelar</Button>
        </div>
      </form>
    </div>
  );
}

function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          <Pencil className="h-3 w-3" /> Editar
        </button>
      </div>
      <div className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1 last:border-0">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
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