import { shareUrl } from "@/lib/external-links";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { EVENT_TYPE_LABEL, MAINT_CATEGORY_LABEL, formatDate, brl, type EventRow, type Motorcycle } from "@/lib/trailbook";
import { EventTypeIcon } from "@/components/EventTypeIcon";
import { Bike, ShieldCheck, Copy, Download, Share2, CheckCircle2, AlertTriangle, Clock, Camera, Receipt, Wrench } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { priorityList } from "@/lib/maintenance-engine";
import { computeConservation, categoryHealth, docsHealth, historyHealth } from "@/lib/conservation";
import { generateCertificatePdf } from "@/lib/cert-pdf";
import { prepareCertPhotoDataUrl } from "@/lib/cert-pdf";
import { saveFile } from "@/lib/save-file";
import { isAllowed, type CertSectionKey } from "@/lib/cert-sections";
import { EvaluationPill } from "@/components/health/EvaluationPill";
import { stateFromScore, RIDE_VERDICT } from "@/lib/ui/evaluation";
import { OwnershipTimeline } from "@/components/OwnershipTimeline";

export const Route = createFileRoute("/c/$token")({
  head: () => ({ meta: [{ title: "Certificado TrailBook" }] }),
  component: PublicCert,
});

function makePublicClient() {
  return createClient<Database>(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function normalizeSignedStorageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const storageOrigin = import.meta.env.VITE_SUPABASE_URL;
  if (!storageOrigin) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${storageOrigin}${path.startsWith("/storage/v1") ? "" : "/storage/v1"}${path}`;
}

type CertPayload = {
  certificate: { public_token: string; created_at: string; expires_at: string | null; status?: string; allowed_sections?: CertSectionKey[] };
  motorcycle: Motorcycle;
  owner: { full_name: string | null; avatar_url: string | null } | null;
  events: EventRow[];
  schedules: Database["public"]["Tables"]["maintenance_schedules"]["Row"][];
  attachments: { id: string; event_id: string; bucket: string; storage_path: string; kind: string; caption: string | null }[];
  workshops: { id: string; name: string; city: string | null; verified: boolean; verified_label?: string | null }[];
  ownership?: { id: string; started_at: string; ended_at: string | null; method: "creation" | "transfer" | "import"; owner_name: string | null }[];
  documents_presence?: { invoice?: boolean };
};

function PublicCert() {
  const { token } = Route.useParams();
  const [data, setData] = useState<CertPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [autoDownload, setAutoDownload] = useState(false);
  const [autoDownloadDone, setAutoDownloadDone] = useState(false);

  const publicUrl = shareUrl(`/c/${token}`);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => setAutoDownload(window.location.hash === "#download");
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const sb = makePublicClient();
      const { data: res, error: e } = await sb.rpc("get_public_certificate", { _token: token });
      if (!active) return;
      if (e || !res) { setError("Certificado inválido, revogado ou expirado."); setLoading(false); return; }
      const payload = res as unknown as CertPayload;
      setData(payload);
      setLoading(false);
      const allowedSections = (payload.certificate.allowed_sections ?? []) as string[];
      const photo = payload.motorcycle.main_photo_url;
      const photoAllowed = allowedSections.includes("photo");
      // Parallelize the follow-up calls — none depend on each other.
      const photoTask = (photo && photoAllowed)
        ? (async () => {
            try {
              const normalizedPath = photo.startsWith("motorcycle-photos/")
                ? photo.replace(/^motorcycle-photos\//, "")
                : photo;
              const { data: signed } = await sb.storage
                .from("motorcycle-photos")
                .createSignedUrl(normalizedPath, 3600);
              const normalizedUrl = normalizeSignedStorageUrl(signed?.signedUrl);
              if (active) setPhotoUrl(normalizedUrl);
            } catch {
              if (active) setPhotoUrl(null);
            }
          })()
        : Promise.resolve();
      const logTask = sb.rpc("log_certificate_access", {
        _token: token,
        _ip: undefined,
        _user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 512) : undefined,
        _referer: typeof document !== "undefined" ? (document.referrer || undefined) : undefined,
        _country: undefined,
      }).then(() => undefined, () => undefined);
      void Promise.all([photoTask, logTask]);
    })();
    QRCode.toDataURL(publicUrl, { margin: 1, width: 320, color: { dark: "#111113", light: "#FFFFFF" } }).then((u) => active && setQrUrl(u));
    return () => { active = false; };
  }, [token, publicUrl]);

  const computed = useMemo(() => {
    if (!data) return null;
    const statuses = priorityList(data.schedules, data.motorcycle, data.events);
    const workshopEventIds = new Set(data.events.filter((e) => e.workshop_id).map((e) => e.id));
    const hasDocs = { plate: !!data.motorcycle.plate, renavam: !!data.motorcycle.renavam, chassis: !!data.motorcycle.chassis };
    const conservation = computeConservation({
      events: data.events,
      attachments: data.attachments as any,
      statuses,
      workshopEventIds,
      hasDocs,
    });
    const health = [
      ...categoryHealth(statuses),
      docsHealth(hasDocs),
      historyHealth(data.events),
    ];
    return { statuses, conservation, health };
  }, [data]);

  if (loading) return <div className="grid min-h-dvh place-items-center text-muted-foreground">Carregando certificado…</div>;
  if (error || !data || !computed) return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="surface-elevated max-w-md rounded-3xl p-8 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-4 font-display text-2xl font-bold">Certificado indisponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error ?? "Esse certificado pode ter sido revogado ou ainda não foi emitido."}</p>
        <p className="mt-4 text-xs text-muted-foreground">Se você acredita que isso é um erro, peça ao proprietário um novo link.</p>
      </div>
    </div>
  );

  const moto = data.motorcycle;
  const certData = data;
  const certComputed = computed;
  const allowed = data.certificate.allowed_sections ?? [];
  const show = (k: CertSectionKey) => isAllowed(allowed, k);
  const upcoming = computed.statuses.filter((s) => s.status !== "ok").slice(0, 6);
  const lastMaint = data.events.filter((e) => e.type === "maintenance" || e.type === "revision").slice(0, 6);
  const photosCount = data.attachments.filter((a) => a.kind === "photo").length;
  const invoicesCount = data.attachments.filter((a) => a.kind === "invoice").length;
  const documentsCount = data.attachments.filter((a) => a.kind === "document").length;
  // Presence-only badge — no sensitive data is exposed, so it is always shown when a Nota Fiscal exists.
  const hasOriginDoc = !!data.documents_presence?.invoice;
  const evidenceVisible = show("photos") || show("documents") || show("workshop") || hasOriginDoc;

  async function share() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "TrailBook – Certificado Digital",
          text: "Confira o Certificado Digital desta motocicleta no TrailBook.",
          url: publicUrl,
        });
        return;
      } catch (err) {
        // User cancelled the native sheet — do nothing, do not silently copy.
        if (err instanceof Error && err.name === "AbortError") return;
        // Other errors fall through to clipboard fallback below.
      }
    }
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.info("Compartilhamento não disponível neste navegador. O link foi copiado.");
    } catch {
      toast.error("Não foi possível compartilhar nem copiar o link.");
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl).then(
      () => toast.success("Link copiado."),
      () => toast.error("Não foi possível copiar o link."),
    );
  }

  async function downloadPdf() {
    const loadingId = toast.loading("Preparando certificado…");
    let stage = "iniciando";
    try {
      let photoDataUrl: string | null = null;
      if (show("photo") && photoUrl) {
        stage = "preparando foto";
        photoDataUrl = await prepareCertPhotoDataUrl(photoUrl);
      }
      stage = "gerando PDF";
      const { blob, fileName } = await generateCertificatePdf({
        moto, events: certData.events,
        conservation: certComputed.conservation,
        health: certComputed.health,
        upcoming: certComputed.statuses.slice(0, 6),
        publicUrl, photoDataUrl,
        attachmentsCount: certData.attachments.length,
        workshopsCount: certData.workshops.length,
      });
      stage = "salvando arquivo";
      const result = await saveFile({
        blob,
        fileName,
        mime: "application/pdf",
        shareTitle: `TrailBook — ${moto.nickname || moto.model}`,
      });
      if (result.outcome === "saved") toast.success("Certificado salvo com sucesso.");
      else if (result.outcome === "shared") toast.success("Certificado enviado para compartilhamento.");
      else if (result.outcome === "downloaded") toast.success("Download iniciado. Verifique a pasta de downloads ou o aplicativo de arquivos.");
      else if (result.outcome === "cancelled") toast("Salvamento cancelado.");
      else toast.error("Não foi possível salvar o certificado. Tente novamente.");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[PDF] falha na etapa "${stage}"`, err);
      toast.error(`Falha ao gerar o certificado (${stage}): ${message}`);
    } finally {
      toast.dismiss(loadingId);
    }
  }

  return (
    <div className="min-h-dvh surface-hero">
      <div className="container mx-auto max-w-5xl px-4 py-4 sm:py-8">
        {autoDownload && !autoDownloadDone ? (
          <AutoDownload run={() => { setAutoDownloadDone(true); downloadPdf(); }} />
        ) : null}
        {/* Header */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground"><Bike className="h-4 w-4" /></div>
            <div className="min-w-0 truncate font-display text-sm font-bold leading-none">TrailBook <span className="ml-1 text-[10px] font-normal uppercase tracking-widest text-muted-foreground">Prontuário digital</span></div>
          </div>
          <div className="col-span-2 flex flex-wrap justify-end gap-2 sm:col-span-1">
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado"); }}><Copy className="h-4 w-4" /> <span className="hidden sm:inline">Copiar link</span></Button>
            <Button variant="outline" size="sm" onClick={share}><Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Compartilhar</span></Button>
            <Button size="sm" onClick={downloadPdf}><Download className="h-4 w-4" /> <span className="hidden sm:inline">Salvar certificado</span><span className="sm:hidden">PDF</span></Button>
          </div>
        </header>

        {/* Hero */}
        <section className="mt-4 surface-elevated overflow-hidden rounded-3xl">
          <div className="grid gap-0 md:grid-cols-[1.4fr_1fr]">
            <div className="relative aspect-[2/1] bg-elevated md:aspect-auto">
              {photoUrl && show("photo") ? (
                <img
                  src={photoUrl}
                  alt={moto.nickname || moto.model}
                  className="h-full w-full object-cover"
                  onError={() => setPhotoUrl(null)}
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-muted-foreground"><Bike className="h-16 w-16 opacity-40" /></div>
              )}
              <div className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground btn-glow">
                <ShieldCheck className="h-3 w-3" /> TrailBook Certified
              </div>
            </div>
            <div className="flex flex-col justify-between p-6 md:p-8">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{moto.brand}</div>
                <h1 className="font-display text-3xl font-bold leading-tight">{moto.nickname || moto.model}</h1>
                <p className="text-sm text-muted-foreground">{moto.model} · {moto.year_model ?? "—"}{moto.displacement ? ` · ${moto.displacement}cc` : ""}</p>
                {(moto as any).trailbook_id ? (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 font-mono text-[11px] font-bold tracking-wider text-primary">
                    <ShieldCheck className="h-3 w-3" /> {(moto as any).trailbook_id}
                  </div>
                ) : null}
                {show("basic") ? (
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <KV k="Placa" v={moto.plate ?? "—"} />
                    <KV k="Chassi" v={moto.chassis ?? "—"} />
                    <KV k="Renavam" v={moto.renavam ?? "—"} />
                    <KV k="Ano" v={String(moto.year_model ?? "—")} />
                  </div>
                ) : null}
              </div>
              {show("usage") ? (
                <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                  <Stat label="Horas" value={`${Number(moto.hours_total ?? 0).toFixed(1)}`} unit="h" />
                  <Stat label="Quilometragem" value={`${Number(moto.km_total ?? 0).toFixed(0)}`} unit="km" />
                  <Stat label="Eventos" value={`${data.events.length}`} />
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* Conservation + QR */}
        <section className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {show("conservation") ? (
          <div className="surface-elevated rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Avaliação TrailBook</h2>
              <span className="text-xs text-muted-foreground">Avaliação automática TrailBook</span>
            </div>
            <div className="mt-4 flex items-center gap-6">
              <div className="space-y-2">
                <EvaluationPill state={stateFromScore(computed.conservation.score)} />
                <p className="max-w-md text-sm text-muted-foreground">
                  O TrailBook avaliou esta motocicleta utilizando todas as informações registradas até a emissão deste certificado.
                </p>
                <p className="max-w-md text-sm">{RIDE_VERDICT[stateFromScore(computed.conservation.score)]}</p>
              </div>
            </div>
          </div>
          ) : <div />}
          <div className="surface-elevated rounded-3xl p-6 text-center">
            <h2 className="font-display text-lg font-bold">Validação</h2>
            <p className="mt-1 text-xs text-muted-foreground">Escaneie para abrir este certificado</p>
            {qrUrl ? <img src={qrUrl} alt="QR Code" className="mx-auto mt-4 h-44 w-44 rounded-xl bg-white p-2" /> : <div className="mx-auto mt-4 h-44 w-44 animate-pulse rounded-xl bg-elevated" />}
            <div className="mt-3 font-mono text-[10px] break-all text-muted-foreground">{data.certificate.public_token}</div>
            <div className="mt-2 text-xs text-muted-foreground">Emitido em {formatDate(data.certificate.created_at)}</div>
          </div>
        </section>

        {/* Health */}
        {show("health") ? <section className="mt-6 surface-elevated rounded-3xl p-6">
          <h2 className="font-display text-lg font-bold">Saúde da motocicleta</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {computed.health.map((h) => {
              const tone = h.status === "good" ? "border-green-500/40 bg-green-500/5" : h.status === "warn" ? "border-yellow-500/40 bg-yellow-500/5" : "border-destructive/40 bg-destructive/5";
              const Icon = h.status === "good" ? CheckCircle2 : h.status === "warn" ? Clock : AlertTriangle;
              const iconTone = h.status === "good" ? "text-green-500" : h.status === "warn" ? "text-yellow-500" : "text-destructive";
              return (
                <div key={h.label} className={`rounded-2xl border p-4 ${tone}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h.label}</div>
                    <Icon className={`h-4 w-4 ${iconTone}`} />
                  </div>
                  <div className="mt-2"><EvaluationPill state={stateFromScore(h.score)} size="sm" /></div>
                  <div className="text-xs text-muted-foreground">{h.reason}</div>
                </div>
              );
            })}
          </div>
        </section> : null}

        {/* Upcoming + Last maintenance */}
        {(show("upcoming") || show("history")) ? <section className="mt-6 grid gap-6 lg:grid-cols-2">
          {show("upcoming") ? <div className="surface-elevated rounded-3xl p-6">
            <h2 className="font-display text-lg font-bold">Próximas manutenções críticas</h2>
            {upcoming.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Nenhuma manutenção pendente.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {upcoming.map((u) => {
                  const tag = u.status === "overdue" ? "Vencida" : u.status === "due" ? "Devida" : "Em breve";
                  const tagTone = u.status === "overdue" ? "bg-destructive text-destructive-foreground" : u.status === "due" ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" : "bg-muted text-muted-foreground";
                  return (
                    <li key={u.schedule.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
                      <div>
                        <div className="text-sm font-semibold">{u.label}</div>
                        <div className="text-xs text-muted-foreground">{MAINT_CATEGORY_LABEL[u.category]}{u.estimatedDueDate ? ` · est. ${formatDate(u.estimatedDueDate.toISOString())}` : ""}</div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tagTone}`}>{tag}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div> : null}
          {show("history") ? <div className="surface-elevated rounded-3xl p-6">
            <h2 className="font-display text-lg font-bold">Últimas manutenções</h2>
            {lastMaint.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Nenhuma manutenção registrada.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {lastMaint.map((e) => (
                  <li key={e.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary"><EventTypeIcon type={e.type} className="h-4 w-4" /></div>
                      <div>
                        <div className="text-sm font-semibold">{e.title || EVENT_TYPE_LABEL[e.type]}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(e.occurred_at)}{show("costs") && e.cost ? ` · ${brl(Number(e.cost))}` : ""}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div> : null}
        </section> : null}

        {/* Evidence summary */}
        {evidenceVisible ? <section className="mt-6 surface-elevated rounded-3xl p-6">
          <h2 className="font-display text-lg font-bold">Evidências e parceiros</h2>
          {hasOriginDoc ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
              <Receipt className="h-3.5 w-3.5" /> 📄 Documento de origem registrado
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {show("photos") ? <EvidenceCard icon={Camera} label="Fotos" value={photosCount} /> : null}
            {show("documents") ? (
              <EvidenceCard icon={Receipt} label="Documentos anexados" value={invoicesCount + documentsCount} />
            ) : null}
            {show("workshop") ? <EvidenceCard icon={Wrench} label="Oficinas registradas" value={data.workshops.length} extra={data.workshops.find((w) => w.verified) ? "Inclui oficina verificada" : undefined} /> : null}
          </div>
        </section> : null}

        {show("owners") ? (
          <section className="mt-6 surface-elevated rounded-3xl p-6">
            <h2 className="font-display text-lg font-bold">Histórico de proprietários</h2>
            <p className="mt-1 text-xs text-muted-foreground">Linha do tempo da titularidade. Nomes são preservados em anonimato no link público.</p>
            <div className="mt-4">
              <OwnershipTimeline entries={data.ownership ?? []} anonymize />
            </div>
          </section>
        ) : null}

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          <p>Este documento é um laudo digital gerado pelo TrailBook a partir do prontuário ativo da motocicleta.</p>
          <p className="mt-1">trailbook · prontuário digital para motos off-road</p>
        </footer>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl bg-elevated p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-bold">{value}<span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span></div>
    </div>
  );
}

function EvidenceCard({ icon: Icon, label, value, extra }: { icon: any; label: string; value: number; extra?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" /> {label}</div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
      {extra ? <div className="text-xs text-primary">{extra}</div> : null}
    </div>
  );
}

function AutoDownload({ run }: { run: () => void }) {
  useEffect(() => {
    const t = setTimeout(run, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}