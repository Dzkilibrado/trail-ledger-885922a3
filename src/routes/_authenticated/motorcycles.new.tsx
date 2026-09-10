import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
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
import { Textarea } from "@/components/ui/textarea";
import { BRANDS, uploadFile, MAINT_CATEGORY_LABEL } from "@/lib/trailbook";
import {
  MODELS_BY_BRAND,
  DISPLACEMENTS,
  MOTO_TYPES,
  CONTROL_TYPES,
  OTHER,
  yearOptions,
  INCIDENT_DECLARATION_TEXT,
  useCatalogBrands,
  useCatalogTypes,
  useCatalogModels,
  useCatalogEngines,
  useCatalogModelDefaults,
} from "@/lib/motorcycle-catalog";

import {
  USE_PROFILES,
  fetchDefaultTemplate,
  fetchTemplateItems,
  proposeSchedules,
  applyPlan,
  ACTION_LABEL,
  SEVERITY_LABEL,
  type UseProfile,
  type ProposedSchedule,
  type PlanAction,
  type PlanSeverity,
} from "@/lib/plan-templates";
import { PhotoPicker } from "@/components/PhotoPicker";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { usePlan } from "@/hooks/usePlan";
import { canCreateMotorcycle } from "@/lib/plans";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Crown,
  ShieldAlert,
  CheckCircle2,
  Pencil,
  Info,
  Paperclip,
  X,
  ChevronDown,
  Plus,
  Trash2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { PlanItemRow } from "@/components/PlanItemRow";
import { ORIGIN_OPTIONS, type OriginType } from "@/lib/motorcycle-origin";
import { DOC_TYPE_LABEL } from "@/lib/motorcycle-documents";
import {
  invalidateMotorcycleState,
  setStoredActiveMotorcycleId,
} from "@/hooks/useActiveMotorcycle";

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
  const qc = useQueryClient();
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
  const [notes, setNotes] = useState("");
  const [nickname, setNickname] = useState("");
  const [originType, setOriginType] = useState<OriginType | "">("");
  const [originNotes, setOriginNotes] = useState("");
  // Upload opcional do documento de origem durante o cadastro
  const [wantsDocUpload, setWantsDocUpload] = useState<boolean | null>(null);
  const [originDocFile, setOriginDocFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"edit" | "review">("edit");
  const [draft, setDraft] = useState<z.infer<typeof schema> | null>(null);
  const [hasPriorUse, setHasPriorUse] = useState<boolean | null>(null); // UI-only, não persiste
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
      const { count } = await supabase
        .from("motorcycles")
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });
  const blocked = !canCreateMotorcycle(plan, motoCount.data ?? 0);

  function goReview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (blocked) {
      toast.error("Limite do plano atingido. Faça upgrade para cadastrar mais motos.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const finalBrand = brand === OTHER ? customBrand.trim() : brand;
    const finalModel = model === OTHER ? customModel.trim() : model;
    const finalDisp = displacement === OTHER ? customDisplacement.trim() : displacement;
    if (!motoType) {
      toast.error("Selecione o tipo da moto.");
      return;
    }
    if (!finalBrand) {
      toast.error("Selecione a marca.");
      return;
    }
    if (!finalModel) {
      toast.error("Informe o modelo.");
      return;
    }
    // Baseline: independente da condition — moto nova pode ter uso anterior
    // hasPriorUse é controle de UI; o que persiste são hours_initial/km_initial
    const hasUse = hasPriorUse === true;
    const parsedHours = hasUse ? Number(hoursTotal || 0) : 0;
    const parsedKm = hasUse ? Number(kmTotal || 0) : 0;

    if (hasUse) {
      if ((controlType === "hours" || controlType === "both") && !(parsedHours > 0)) {
        toast.error("Informe o horímetro atual da moto.");
        return;
      }
      if ((controlType === "km" || controlType === "both") && !(parsedKm > 0)) {
        toast.error("Informe o KM atual da moto.");
        return;
      }
    }
    if (hasPriorUse === null && controlType !== "not_informed") {
      toast.error("Informe se a moto já possui horas ou km de uso.");
      return;
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
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (useProfile === "other" && !useProfileNote.trim()) {
      toast.error("Descreva o perfil de uso.");
      return;
    }
    if (!originType) {
      toast.error("Informe como a motocicleta foi adquirida.");
      return;
    }
    setDraft(parsed.data);
    setMode("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function confirmAndSave() {
    if (!draft) return;
    if (blocked) {
      toast.error("Limite do plano atingido.");
      return;
    }
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session!.user.id;
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
      const { data, error } = await supabase
        .from("motorcycles")
        .insert({
          ...draft,
          owner_id: uid,
          main_photo_url,
          // Baseline preservada — nunca é sobrescrita pela recomposição da
          // linha do tempo. Fix crítico do bug de zeramento do horímetro.
          hours_initial: draft.hours_total,
          km_initial: draft.km_total,
          incident_declaration: incidentDeclaration,
          use_profile: useProfile,
          use_profile_note: useProfile === "other" ? useProfileNote.trim() || null : null,
          // plan_review_status: baseline zerada → skipped; baseline com uso → pending.
          // Válido para qualquer condition; moto nova com 60h já tem uso anterior.
          // control_type = not_informed → sem baseline confiável → skipped.
          plan_review_status:
            draft.control_type === "not_informed" ||
            (draft.hours_total === 0 && draft.km_total === 0)
              ? "skipped"
              : "pending",
          origin_type: originType || null,
          origin_notes: originNotes.trim() || null,
          origin_set_at: originType ? new Date().toISOString() : null,
        } as never)
        .select("id")
        .single();
      if (error) throw error;

      const secondaryIssues: string[] = [];

      // Se subiu foto principal no cadastro, registra na galeria
      if (main_photo_url) {
        const { error: photoErr } = await supabase.from("motorcycle_photos").insert({
          motorcycle_id: data.id,
          storage_path: main_photo_url,
          bucket: "motorcycle-photos",
          position: 0,
          is_primary: true,
          created_by: uid,
        } as never);
        // A moto já foi criada com a foto principal salva (main_photo_url);
        // isso aqui é só a cópia dela na galeria. Se falhar, a foto não some,
        // só não aparece ainda na aba Documentos — por isso avisamos sem
        // bloquear o cadastro.
        if (photoErr) secondaryIssues.push("a foto não foi adicionada à galeria");
      }
      // Observação geral, se preenchida
      if (notes.trim()) {
        const { error: noteErr } = await supabase.from("events").insert({
          motorcycle_id: data.id,
          created_by: uid,
          type: "note",
          title: "Observação inicial",
          description: notes.trim(),
          occurred_at: new Date().toISOString(),
        } as never);
        if (noteErr) secondaryIssues.push("a observação inicial não foi salva");
      }
      // Registra declaração inicial na linha do tempo
      if (incident !== "unknown") {
        const { error: declErr } = await supabase.from("events").insert({
          motorcycle_id: data.id,
          created_by: uid,
          type: "declaration",
          title:
            incident === "no"
              ? "Declaração: sem histórico de sinistro"
              : "Declaração: histórico de sinistro relatado",
          description:
            incident === "no"
              ? INCIDENT_DECLARATION_TEXT
              : "O proprietário declarou que esta motocicleta possui histórico de sinistro relevante.",
          occurred_at: new Date().toISOString(),
        } as never);
        if (declErr)
          secondaryIssues.push("a declaração de sinistro não foi registrada na linha do tempo");
      }
      setStoredActiveMotorcycleId(data.id);
      await invalidateMotorcycleState(qc);
      toast.success("Moto cadastrada!");
      if (secondaryIssues.length > 0) {
        toast.warning("Alguns detalhes não foram salvos", {
          description: `A moto foi cadastrada normalmente, mas ${secondaryIssues.join(" e ")}. Você pode adicionar isso depois pela Central da moto.`,
        });
      }
      if (originDocFile) {
        try {
          const { data: s } = await supabase.auth.getSession();
          const uid2 = s.session?.user.id;
          if (uid2) {
            const { path } = await uploadFile("documents", originDocFile, uid2);
            const docType =
              originType === "zero_km"
                ? "invoice"
                : originType === "private"
                  ? "bill_of_sale"
                  : originType === "dealer"
                    ? "invoice"
                    : "other";
            await supabase.from("motorcycle_documents" as never).insert({
              motorcycle_id: data.id,
              doc_type: docType,
              bucket: "documents",
              storage_path: path,
              file_name: originDocFile.name,
              mime_type: originDocFile.type || null,
              size_bytes: originDocFile.size,
              created_by: uid2,
              version: 1,
              is_current: true,
              is_origin_document: true,
            } as never);
          }
        } catch {
          toast.warning("Moto cadastrada, mas o documento de origem não foi salvo", {
            description: "Você pode anexar o documento depois, na Central da moto → Documentos.",
          });
        }
      }

      // Sempre segue direto para o plano de manutenção: ele já sugere os
      // itens e prazos automaticamente (o usuário só revisa e confirma).
      // Isso garante que toda moto cadastrada termine com um plano de
      // verdade — sem isso, a "Revisão inicial" fica sem nenhum
      // componente para mostrar.
      navigate({ to: "/motorcycles/$id/plan", params: { id: data.id }, search: { first: true } });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  const finalModelLabel = model === OTHER ? customModel : model;
  const finalDispLabel = displacement === OTHER ? customDisplacement : displacement;

  // ─── WIZARD STATE ────────────────────────────────────────────────────────
  const [wizStep, setWizStep] = useState<1 | 2 | 3 | 4>(1);
  const [wizPlanMode, setWizPlanMode] = useState<"suggested" | "custom">("suggested");
  const [wizPlanRows, setWizPlanRows] = useState<ProposedSchedule[]>([]);
  const [wizPlanLoaded, setWizPlanLoaded] = useState(false);
  const [wizDocAnswer, setWizDocAnswer] = useState<"yes" | "no" | null>(null);
  const [wizDocUpload, setWizDocUpload] = useState<boolean | null>(null);
  const [planProfile, setPlanProfile] = useState<UseProfile>("normal");
  const [planProfileNote, setPlanProfileNote] = useState("");
  const [planOpenCats, setPlanOpenCats] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [savedMotoId, setSavedMotoId] = useState<string | null>(null);
  const [successScreen, setSuccessScreen] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [docUploadError, setDocUploadError] = useState(false);

  const STEPS = ["Sua moto", "Uso", "Plano", "Revisar"] as const;

  // Carrega plano sugerido ao entrar no step 3
  useEffect(() => {
    if (wizStep !== 3 || wizPlanLoaded) return;
    (async () => {
      const tmpl = await fetchDefaultTemplate(brand || undefined, model || undefined);
      if (!tmpl) {
        setWizPlanLoaded(true);
        return;
      }
      const items = await fetchTemplateItems(tmpl.id);
      setWizPlanRows(proposeSchedules(items, planProfile));
      setWizPlanLoaded(true);
    })();
  }, [wizStep]);

  function reapplyWizProfile(p: UseProfile) {
    setPlanProfile(p);
    (async () => {
      const tmpl = await fetchDefaultTemplate(brand || undefined, model || undefined);
      if (!tmpl) return;
      const items = await fetchTemplateItems(tmpl.id);
      setWizPlanRows(proposeSchedules(items, p));
    })();
  }

  function updatePlanRow(i: number, patch: Partial<ProposedSchedule>) {
    setWizPlanRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removePlanRow(i: number) {
    setWizPlanRows((prev) => prev.filter((_, idx) => idx !== i));
  }
  const activeCount = wizPlanRows.filter((r) => r.keep).length;

  async function finalizarCadastro() {
    if (saving) return;
    setSaving(true);
    setPlanError(null);
    setDocUploadError(false);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const uid = user?.id ?? "";
      let motoId = savedMotoId;

      // 1. Cria a moto (apenas se ainda não foi criada)
      if (!motoId) {
        if (blocked) {
          toast.error("Limite do plano atingido.");
          setSaving(false);
          return;
        }
        const hasUse = hasPriorUse === true;
        const parsedHours = hasUse ? Number(hoursTotal || 0) : 0;
        const parsedKm = hasUse ? Number(kmTotal || 0) : 0;
        const b = brand === OTHER ? customBrand.trim() : brand;
        const m = model === OTHER ? customModel.trim() : model;
        const payload: Record<string, unknown> = {
          owner_id: uid,
          brand: b,
          model: m,
          displacement: displacement === OTHER ? customDisplacement.trim() : displacement || null,
          year_make: yearMake ? parseInt(yearMake) : null,
          year_model: yearModel ? parseInt(yearModel) : null,
          control_type: controlType,
          condition,
          hours_initial: parsedHours,
          km_initial: parsedKm,
          hours_total: parsedHours,
          km_total: parsedKm,
          use_profile: planProfile,
          use_profile_note: planProfile === "other" ? planProfileNote.trim() || null : null,
          incident_declaration: incident === "no" ? INCIDENT_DECLARATION_TEXT : null,
          nickname: nickname.trim() || null,
          plan_review_status:
            controlType === "not_informed" || (parsedHours === 0 && parsedKm === 0)
              ? "skipped"
              : "pending",
        };
        const { data: motoData, error: motoErr } = await supabase
          .from("motorcycles")
          .insert(payload as never)
          .select("id")
          .single();
        if (motoErr) throw new Error(motoErr.message);
        motoId = motoData.id;
        setSavedMotoId(motoId);

        // Foto — skip se já existe (retentativa segura)
        if (photo) {
          try {
            const { count: photoCount } = await supabase
              .from("motorcycle_photos")
              .select("id", { count: "exact", head: true })
              .eq("motorcycle_id", motoId);
            if (!photoCount || photoCount === 0) {
              const up = await uploadFile("motorcycle-photos", photo, uid);
              await supabase.from("motorcycle_photos").insert({
                motorcycle_id: motoId,
                storage_path: up.path,
                bucket: "motorcycle-photos",
                is_main: true,
              } as never);
              await supabase
                .from("motorcycles")
                .update({ main_photo_url: up.path } as never)
                .eq("id", motoId);
            }
          } catch {
            /* foto é opcional */
          }
        }
      }

      // 2. Cria plano — CRÍTICO — não navega se falhar
      try {
        await applyPlan(supabase, motoId!, wizPlanRows, planProfile, planProfileNote);
      } catch (e: any) {
        setPlanError(e.message ?? "Falha ao criar o plano de manutenção.");
        setSaving(false);
        return;
      }

      // 3. Documento opcional
      // Documento — skip se já existe (retentativa segura)
      if (originDocFile && wizDocUpload === true) {
        try {
          const { count: docCount } = await supabase
            .from("motorcycle_documents" as never)
            .select("id", { count: "exact", head: true })
            .eq("motorcycle_id", motoId)
            .eq("is_origin_document", true as never);
          if (!docCount || docCount === 0) {
            const up = await uploadFile("documents", originDocFile, uid);
            await supabase.from("motorcycle_documents" as never).insert({
              motorcycle_id: motoId,
              doc_type: originType || "other",
              bucket: "documents",
              storage_path: up.path,
              file_name: originDocFile.name,
              mime_type: originDocFile.type || null,
              size_bytes: originDocFile.size,
              created_by: uid,
              version: 1,
              is_current: true,
              is_origin_document: true,
            } as never);
          }
        } catch {
          setDocUploadError(true);
        }
      }

      setSuccessScreen(true);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao cadastrar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const finalBrand = brand === OTHER ? customBrand : brand;
  const finalModel = model === OTHER ? customModel : model;

  // Tela de sucesso
  if (successScreen && savedMotoId) {
    return (
      <div className="mx-auto max-w-xl space-y-6 pb-24 pt-8 text-center px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-3xl">
            🏍️
          </div>
          <h1 className="font-display text-2xl font-bold">Sua moto está pronta!</h1>
          <p className="text-sm text-muted-foreground">
            {[finalBrand, finalModel].filter(Boolean).join(" ")} cadastrada com sucesso.
          </p>
          <p className="text-xs text-muted-foreground">
            O plano de manutenção foi configurado. O TrailBook está pronto para acompanhar sua moto.
          </p>
          {docUploadError && (
            <div className="w-full rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-200 text-left">
              ⚠ O documento não foi salvo. Você pode anexá-lo depois em{" "}
              <strong>Documentação da moto</strong>.
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <Button
            className="w-full btn-glow text-base"
            size="lg"
            onClick={() =>
              navigate({ to: "/motorcycles/$id", params: { id: savedMotoId } } as never)
            }
          >
            Ir para minha moto
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              navigate({
                to: "/motorcycles/$id/registrar-manutencao",
                params: { id: savedMotoId },
              } as never)
            }
          >
            Registrar atividade
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-0 pb-[140px]">
      {/* Stepper compacto */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pt-4 pb-3 px-1">
        <div className="flex gap-1">
          {STEPS.map((label, idx) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-0.5">
              <div
                className={`h-1.5 w-full rounded-full transition-colors ${wizStep > idx ? "bg-primary" : wizStep === idx + 1 ? "bg-primary/70" : "bg-border"}`}
              />
              <span
                className={`text-[10px] leading-tight ${wizStep === idx + 1 ? "text-primary font-semibold" : "text-muted-foreground"}`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ───────────────── STEP 1 — SUA MOTO ──────────────────── */}
      {wizStep === 1 && (
        <div className="space-y-4 pt-2 px-1">
          <PageHeader
            title="Sua moto"
            crumbs={[{ label: "Motos", to: "/motorcycles" }, { label: "Adicionar" }]}
            description="Informe os dados básicos da motocicleta."
          />

          <div className="surface-elevated rounded-2xl p-4 space-y-4">
            <Field label="Tipo da moto" required>
              <Select value={motoType} onValueChange={setMotoType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {(catTypes.data ?? []).map((t) => (
                    <SelectItem key={t.code} value={t.code}>
                      {t.label}
                    </SelectItem>
                  ))}
                  {MOTO_TYPES.filter(
                    (t) => !(catTypes.data ?? []).some((ct) => ct.code === t.value),
                  ).map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Marca" required>
              <Select
                value={brand}
                onValueChange={(v) => {
                  setBrand(v);
                  setBrandId(catBrands.data?.find((b) => b.name === v)?.id ?? null);
                  setModel("");
                  setModelId(null);
                  setDisplacement("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {(catBrands.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                  {BRANDS.filter((b) => !(catBrands.data ?? []).some((cb) => cb.name === b)).map(
                    (b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ),
                  )}
                  <SelectItem value={OTHER}>Outra…</SelectItem>
                </SelectContent>
              </Select>
              {brand === OTHER && (
                <Input
                  className="mt-2"
                  value={customBrand}
                  onChange={(e) => setCustomBrand(e.target.value)}
                  placeholder="Digite a marca"
                />
              )}
            </Field>

            <Field label="Modelo" required>
              {brand && brand !== OTHER ? (
                <>
                  <Select
                    value={model}
                    onValueChange={(v) => {
                      setModel(v);
                      const found = catModels.data?.find((m) => m.name === v);
                      setModelId(found?.id ?? null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(catModels.data ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.name}>
                          {m.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={OTHER}>Outro…</SelectItem>
                    </SelectContent>
                  </Select>
                  {model === OTHER && (
                    <Input
                      className="mt-2"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      placeholder="Digite o modelo"
                    />
                  )}
                </>
              ) : (
                <Input
                  value={model === OTHER ? customModel : model}
                  onChange={(e) => {
                    setModel(OTHER);
                    setCustomModel(e.target.value);
                  }}
                  placeholder="Digite o modelo"
                />
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Cilindrada (cc)">
                <Select value={displacement} onValueChange={setDisplacement}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ex: 250" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "50",
                      "125",
                      "150",
                      "160",
                      "190",
                      "230",
                      "250",
                      "300",
                      "350",
                      "400",
                      "450",
                      "500",
                      "600",
                      "650",
                      "700",
                      "750",
                      "800",
                      "900",
                      "1000",
                      "1100",
                      "1200",
                    ].map((d) => (
                      <SelectItem key={d} value={d}>
                        {d} cc
                      </SelectItem>
                    ))}
                    <SelectItem value={OTHER}>Outro…</SelectItem>
                  </SelectContent>
                </Select>
                {displacement === OTHER && (
                  <Input
                    className="mt-2"
                    type="number"
                    value={customDisplacement}
                    onChange={(e) => setCustomDisplacement(e.target.value)}
                    placeholder="Ex: 300"
                  />
                )}
              </Field>
              <Field label="Ano">
                <Select value={yearMake} onValueChange={setYearMake}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
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
            </div>

            <Field label="Apelido (opcional)">
              <Input
                name="nickname"
                placeholder="Ex: A vermelhinha"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </Field>
          </div>

          {/* Foto */}
          <div className="surface-elevated rounded-2xl p-4 space-y-2">
            <p className="text-sm font-semibold">Foto da moto</p>
            <p className="text-xs text-muted-foreground">Opcional. Aparece no perfil da moto.</p>
            <PhotoPicker
              value={photo}
              onChange={setPhoto}
              label="Selecionar foto"
              hint="JPG ou PNG."
            />
          </div>

          {/* Documento */}
          <div className="surface-elevated rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold">Documento da moto</p>
            <p className="text-xs text-muted-foreground">
              Nota Fiscal, recibo ou comprovante de origem — opcional.
            </p>
            {wizDocAnswer === null && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setWizDocAnswer("yes")}
                >
                  Estou com o documento
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setWizDocAnswer("no");
                    setWizDocUpload(false);
                  }}
                >
                  Não estou
                </Button>
              </div>
            )}
            {wizDocAnswer === "no" && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Sem problema. Adicione depois em <strong>Documentação da moto</strong>.
                </p>
                <button
                  type="button"
                  className="text-xs underline text-muted-foreground"
                  onClick={() => {
                    setWizDocAnswer(null);
                    setWizDocUpload(null);
                  }}
                >
                  Alterar
                </button>
              </div>
            )}
            {wizDocAnswer === "yes" && wizDocUpload === null && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="flex-1 btn-glow"
                  onClick={() => setWizDocUpload(true)}
                >
                  Anexar agora
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setWizDocUpload(false)}
                >
                  Adicionar depois
                </Button>
              </div>
            )}
            {wizDocAnswer === "yes" && wizDocUpload === false && (
              <p className="text-xs text-muted-foreground">
                📌 Adicione depois em <strong>Documentação da moto</strong>.
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={() => setWizDocUpload(null)}
                >
                  Alterar
                </button>
              </p>
            )}
            {wizDocAnswer === "yes" && wizDocUpload === true && (
              <div className="space-y-2">
                <Select
                  value={originType || "invoice"}
                  onValueChange={(v) => setOriginType(v as never)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIGIN_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.emoji} {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!originDocFile ? (
                  <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 text-center hover:border-primary/70">
                    <Paperclip className="h-6 w-6 text-primary/60" />
                    <span className="text-xs text-muted-foreground">
                      Toque para selecionar — PDF, JPG ou PNG (máx. 20 MB)
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f && f.size > 20 * 1024 * 1024) {
                          toast.error("Arquivo muito grande (máx. 20 MB)");
                          return;
                        }
                        setOriginDocFile(f ?? null);
                      }}
                    />
                  </label>
                ) : (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{originDocFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(originDocFile.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOriginDocFile(null)}
                      className="shrink-0 rounded p-1 hover:bg-muted"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-50 flex gap-2 border-t border-border bg-background/95 px-4 py-3 pb-safe backdrop-blur-sm">
            <Button
              variant="outline"
              className="flex-none"
              onClick={() => navigate({ to: "/motorcycles" })}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 btn-glow"
              onClick={() => {
                if (!motoType) {
                  toast.error("Selecione o tipo da moto.");
                  return;
                }
                if (!(brand === OTHER ? customBrand.trim() : brand)) {
                  toast.error("Informe a marca.");
                  return;
                }
                if (!(model === OTHER ? customModel.trim() : model)) {
                  toast.error("Informe o modelo.");
                  return;
                }
                setWizStep(2);
                window.scrollTo({ top: 0 });
              }}
            >
              Continuar →
            </Button>
          </div>
        </div>
      )}

      {/* ───────────────── STEP 2 — USO E PERFIL ──────────────── */}
      {wizStep === 2 && (
        <div className="space-y-4 pt-2 px-1">
          <PageHeader
            title="Uso e perfil"
            crumbs={[{ label: "Motos", to: "/motorcycles" }, { label: "Adicionar" }]}
            description="Como você utiliza esta moto?"
          />

          <div className="surface-elevated rounded-2xl p-4 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Como você adquiriu esta moto?</p>
              <div className="flex gap-2">
                {(
                  [
                    { v: "new", label: "Nova" },
                    { v: "used", label: "Usada / Seminova" },
                  ] as const
                ).map((o) => (
                  <Button
                    key={o.v}
                    type="button"
                    variant={condition === o.v ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setCondition(o.v)}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
            </div>

            <Field label="Tipo de controle">
              <Select value={controlType} onValueChange={setControlType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTROL_TYPES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {controlType !== "not_informed" && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">A moto já possui horas ou km de uso?</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={hasPriorUse === false ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => {
                      setHasPriorUse(false);
                      setHoursTotal("0");
                      setKmTotal("0");
                    }}
                  >
                    Não
                  </Button>
                  <Button
                    type="button"
                    variant={hasPriorUse === true ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setHasPriorUse(true)}
                  >
                    Sim
                  </Button>
                </div>
                {hasPriorUse === true && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {(controlType === "hours" || controlType === "both") && (
                      <Field label="Horímetro (h)" required>
                        <Input
                          type="number"
                          step="0.1"
                          value={hoursTotal}
                          onChange={(e) => setHoursTotal(e.target.value)}
                        />
                      </Field>
                    )}
                    {(controlType === "km" || controlType === "both") && (
                      <Field label="KM atual" required>
                        <Input
                          type="number"
                          step="1"
                          value={kmTotal}
                          onChange={(e) => setKmTotal(e.target.value)}
                        />
                      </Field>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-semibold">Perfil de uso</p>
              <p className="text-xs text-muted-foreground">
                Ajusta os intervalos de manutenção para o seu estilo de pilotagem.
              </p>
              <Select value={planProfile} onValueChange={(v) => reapplyWizProfile(v as UseProfile)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USE_PROFILES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {planProfile === "other" && (
                <Input
                  value={planProfileNote}
                  onChange={(e) => setPlanProfileNote(e.target.value)}
                  placeholder="Ex: uso comercial em fazenda"
                />
              )}
              <p className="text-[11px] text-muted-foreground">
                {USE_PROFILES.find((p) => p.value === planProfile)?.hint}
              </p>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-50 flex gap-2 border-t border-border bg-background/95 px-4 py-3 pb-safe backdrop-blur-sm">
            <Button
              variant="outline"
              className="flex-none"
              onClick={() => {
                setWizStep(1);
                window.scrollTo({ top: 0 });
              }}
            >
              ← Voltar
            </Button>
            <Button
              className="flex-1 btn-glow"
              onClick={() => {
                if (controlType !== "not_informed" && hasPriorUse === null) {
                  toast.error("Informe se a moto já possui uso acumulado.");
                  return;
                }
                if (hasPriorUse === true) {
                  if ((controlType === "hours" || controlType === "both") && !Number(hoursTotal)) {
                    toast.error("Informe o horímetro atual.");
                    return;
                  }
                  if ((controlType === "km" || controlType === "both") && !Number(kmTotal)) {
                    toast.error("Informe o KM atual.");
                    return;
                  }
                }
                setWizPlanLoaded(false);
                setWizStep(3);
                window.scrollTo({ top: 0 });
              }}
            >
              Continuar →
            </Button>
          </div>
        </div>
      )}

      {/* ───────────────── STEP 3 — PLANO ─────────────────────── */}
      {wizStep === 3 && (
        <div className="space-y-4 pt-2 px-1">
          <PageHeader
            title="Plano de manutenção"
            crumbs={[{ label: "Motos", to: "/motorcycles" }, { label: "Adicionar" }]}
            description="Preparamos uma sugestão inicial. Você pode aceitar ou personalizar."
          />

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setWizPlanMode("suggested")}
              className={`w-full rounded-2xl border p-4 text-left transition ${wizPlanMode === "suggested" ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">Plano sugerido pelo TrailBook</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Recomendado — intervalos ajustados para o perfil{" "}
                    <strong>{USE_PROFILES.find((p) => p.value === planProfile)?.label}</strong>.
                  </p>
                </div>
                {wizPlanMode === "suggested" && (
                  <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                    ✓ Selecionado
                  </span>
                )}
              </div>
              {!wizPlanLoaded ? (
                <div className="mt-3 space-y-1.5">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="h-4 rounded bg-muted/60 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="mt-3 space-y-1">
                  {(Object.entries(MAINT_CATEGORY_LABEL) as [string, string][]).map(
                    ([cat, label]) => {
                      const count = wizPlanRows.filter((r) => r.category === cat && r.keep).length;
                      if (!count) return null;
                      return (
                        <div
                          key={cat}
                          className="flex justify-between text-xs text-muted-foreground"
                        >
                          <span>{label}</span>
                          <span>
                            {count} {count === 1 ? "item" : "itens"}
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setWizPlanMode("custom")}
              className={`w-full rounded-2xl border p-4 text-left transition ${wizPlanMode === "custom" ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">Personalizar</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ajuste itens, intervalos e severidade.
                  </p>
                </div>
                {wizPlanMode === "custom" && (
                  <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                    ✓ Selecionado
                  </span>
                )}
              </div>
            </button>
          </div>

          {wizPlanMode === "custom" && wizPlanLoaded && (
            <WizardPlanEditor
              rows={wizPlanRows}
              openCats={planOpenCats}
              onToggleCat={(cat) =>
                setPlanOpenCats((prev) => {
                  const next = new Set(prev);
                  if (next.has(cat)) next.delete(cat);
                  else next.add(cat);
                  return next;
                })
              }
              onUpdate={updatePlanRow}
              onRemove={removePlanRow}
              onAdd={() =>
                setWizPlanRows((prev) => [
                  ...prev,
                  {
                    key: `custom-${Date.now()}`,
                    item_name: "",
                    name: "",
                    category: "other",
                    action: "inspect",
                    severity: "medium",
                    interval_hours: null,
                    interval_km: null,
                    interval_days: null,
                    sort_order: 999,
                    keep: true,
                    notes: null,
                  },
                ])
              }
            />
          )}

          <div className="fixed bottom-0 left-0 right-0 z-50 flex gap-2 border-t border-border bg-background/95 px-4 py-3 pb-safe backdrop-blur-sm">
            <Button
              variant="outline"
              className="flex-none"
              onClick={() => {
                setWizStep(2);
                window.scrollTo({ top: 0 });
              }}
            >
              ← Voltar
            </Button>
            <Button
              className="flex-1 btn-glow"
              disabled={!wizPlanLoaded}
              onClick={() => {
                setWizStep(4);
                window.scrollTo({ top: 0 });
              }}
            >
              Continuar →
            </Button>
          </div>
        </div>
      )}

      {/* ───────────────── STEP 4 — REVISAR ───────────────────── */}
      {wizStep === 4 && (
        <div className="space-y-4 pt-2 px-1">
          <PageHeader
            title="Revisar"
            crumbs={[{ label: "Motos", to: "/motorcycles" }, { label: "Adicionar" }]}
            description="Confira os dados antes de finalizar."
          />

          <div className="space-y-3">
            <SummaryCard
              title="Moto"
              onEdit={() => {
                setWizStep(1);
                window.scrollTo({ top: 0 });
              }}
            >
              <p className="text-sm font-medium">
                {[finalBrand, finalModel].filter(Boolean).join(" ")}
              </p>
              {yearMake && <p className="text-xs text-muted-foreground">Ano {yearMake}</p>}
              {displacement && (
                <p className="text-xs text-muted-foreground">
                  {displacement === OTHER ? customDisplacement : displacement} cc
                </p>
              )}
            </SummaryCard>

            <SummaryCard
              title="Foto"
              onEdit={() => {
                setWizStep(1);
                window.scrollTo({ top: 0 });
              }}
            >
              {photo ? (
                <p className="text-xs text-emerald-400">✓ Foto selecionada</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sem foto — adicionar depois em Editar dados
                </p>
              )}
            </SummaryCard>

            <SummaryCard
              title="Documento"
              onEdit={() => {
                setWizStep(1);
                window.scrollTo({ top: 0 });
              }}
            >
              {originDocFile && wizDocUpload === true ? (
                <p className="text-xs text-emerald-400">✓ {originDocFile.name}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sem documento — adicionar depois em Documentação
                </p>
              )}
            </SummaryCard>

            <SummaryCard
              title="Uso"
              onEdit={() => {
                setWizStep(2);
                window.scrollTo({ top: 0 });
              }}
            >
              <p className="text-sm font-medium">
                {condition === "new" ? "Nova" : "Usada / Seminova"}
              </p>
              {hasPriorUse === true && (
                <p className="text-xs text-muted-foreground">
                  {(controlType === "hours" || controlType === "both") && `${hoursTotal} h`}
                  {controlType === "both" && " · "}
                  {(controlType === "km" || controlType === "both") && `${kmTotal} km`}
                </p>
              )}
            </SummaryCard>

            <SummaryCard
              title="Perfil"
              onEdit={() => {
                setWizStep(2);
                window.scrollTo({ top: 0 });
              }}
            >
              <p className="text-sm font-medium">
                {USE_PROFILES.find((p) => p.value === planProfile)?.label}
              </p>
            </SummaryCard>

            <SummaryCard
              title="Plano de manutenção"
              onEdit={() => {
                setWizStep(3);
                window.scrollTo({ top: 0 });
              }}
            >
              <p className="text-sm font-medium">
                {wizPlanMode === "suggested" ? "Plano sugerido TrailBook" : "Plano personalizado"}
              </p>
              <p className="text-xs text-muted-foreground">{activeCount} itens selecionados</p>
            </SummaryCard>
          </div>

          {planError && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              <p className="font-semibold">Falha ao criar o plano de manutenção</p>
              <p className="mt-0.5">{planError}</p>
              {savedMotoId && (
                <p className="mt-1 text-muted-foreground">
                  A moto foi criada. Toque em "Finalizar cadastro" para tentar novamente sem criar
                  duplicata.
                </p>
              )}
            </div>
          )}

          <div className="fixed bottom-0 left-0 right-0 z-50 flex gap-2 border-t border-border bg-background/95 px-4 py-3 pb-safe backdrop-blur-sm">
            <Button
              variant="outline"
              className="flex-none"
              disabled={saving}
              onClick={() => {
                setWizStep(3);
                window.scrollTo({ top: 0 });
              }}
            >
              ← Voltar
            </Button>
            <Button
              className="flex-1 btn-glow"
              size="lg"
              disabled={saving}
              onClick={finalizarCadastro}
            >
              {saving ? "Finalizando…" : "Finalizar cadastro"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SummaryCard ─────────────────────────────────────────────────────────────
function SummaryCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="min-w-0 space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
        {children}
      </div>
      <Button variant="outline" size="sm" className="shrink-0" onClick={onEdit}>
        Editar
      </Button>
    </div>
  );
}

// ─── WizardPlanEditor ────────────────────────────────────────────────────────
function WizardPlanEditor({
  rows,
  openCats,
  onToggleCat,
  onUpdate,
  onRemove,
  onAdd,
}: {
  rows: ProposedSchedule[];
  openCats: Set<string>;
  onToggleCat: (cat: string) => void;
  onUpdate: (i: number, patch: Partial<ProposedSchedule>) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
}) {
  const indexed = rows.map((r, i) => ({ r, i }));
  const grouped = (Object.keys(MAINT_CATEGORY_LABEL) as string[])
    .map((cat) => ({
      cat,
      label: (MAINT_CATEGORY_LABEL as Record<string, string>)[cat],
      items: indexed.filter(({ r }) => r.category === cat),
    }))
    .filter(({ items }) => items.length > 0);

  function intervalSummary(r: ProposedSchedule) {
    const parts: string[] = [];
    if (r.interval_hours) parts.push(`${r.interval_hours} h`);
    if (r.interval_km) parts.push(`${r.interval_km} km`);
    if (r.interval_days) parts.push(`${r.interval_days} dias`);
    return parts.length ? `A cada ${parts.join(" · ")}` : "Sem intervalo";
  }

  return (
    <div className="space-y-2">
      {grouped.map(({ cat, label, items }) => {
        const open = openCats.has(cat);
        const activeInCat = items.filter(({ r }) => r.keep).length;
        return (
          <div key={cat} className="rounded-2xl border border-border bg-card overflow-hidden">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => onToggleCat(cat)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition"
            >
              <span className="font-semibold text-sm">{label}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {activeInCat}/{items.length}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                />
              </div>
            </button>
            {open && (
              <div className="border-t border-border divide-y divide-border/60">
                {items.map(({ r, i }) => (
                  <PlanItemRow
                    key={r.key}
                    row={r}
                    globalIndex={i}
                    intervalSummary={intervalSummary(r)}
                    onUpdate={(patch: Partial<ProposedSchedule>) => onUpdate(i, patch)}
                    onRemove={() => onRemove(i)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/60 py-3 text-sm text-muted-foreground hover:border-primary/40 transition"
      >
        <Plus className="h-4 w-4" /> Adicionar item personalizado
      </button>
    </div>
  );
}

function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
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

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
        {required && <span className="text-primary"> *</span>}
      </Label>
      {children}
    </div>
  );
}
