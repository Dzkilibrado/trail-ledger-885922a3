import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CertificateSettingsDialog } from "@/components/CertificateSettingsDialog";
import { CertificateAccessLogDialog } from "@/components/CertificateAccessLogDialog";
import { RevokeCertificateDialog } from "@/components/RevokeCertificateDialog";
import { HelpTooltip } from "@/components/HelpTooltip";
import { HELP } from "@/lib/help/texts";
import { usePlan } from "@/hooks/usePlan";
import { canCreateCertificate } from "@/lib/plans";
import { effectiveStatus, STATUS_LABEL, STATUS_TONE, type CertStatus } from "@/lib/cert-sections";
import {
  ArrowLeft, BadgeCheck, Copy, ExternalLink, Eye, Globe2, Lock,
  QrCode, RefreshCcw, Settings2, ShieldOff, Share2, Sparkles, Activity,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/motorcycles/$id/certificate")({
  head: () => ({ meta: [{ title: "Certificado Digital — TrailBook" }] }),
  component: CertificatePage,
});

type CertRow = {
  id: string;
  public_token: string;
  status: string | null;
  expires_at: string | null;
  allowed_sections: unknown;
  audience?: string | null;
  created_at?: string | null;
};

function CertificatePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { plan } = usePlan();
  const [revokeOpen, setRevokeOpen] = useState(false);

  const moto = useQuery({
    queryKey: ["motorcycle", id],
    queryFn: async () => (await supabase.from("motorcycles").select("*").eq("id", id).single()).data,
  });

  const certs = useQuery({
    queryKey: ["certificates", id],
    queryFn: async () =>
      (await supabase
        .from("certificates")
        .select("*")
        .eq("motorcycle_id", id)
        .order("created_at", { ascending: false })).data ?? [],
  });

  const cert = (certs.data?.[0] as CertRow | undefined) ?? null;
  const eff: CertStatus | null = cert ? effectiveStatus(cert as any) : null;
  const publicUrl =
    cert && typeof window !== "undefined" ? `${window.location.origin}/c/${cert.public_token}` : null;

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!publicUrl) { setQrDataUrl(null); return; }
    let active = true;
    QRCode.toDataURL(publicUrl, { margin: 1, width: 220, color: { dark: "#111113", light: "#FFFFFF" } })
      .then((u) => { if (active) setQrDataUrl(u); })
      .catch(() => { if (active) setQrDataUrl(null); });
    return () => { active = false; };
  }, [publicUrl]);

  async function checkCertLimit(e: React.MouseEvent) {
    const { count } = await supabase.from("certificates").select("id", { count: "exact", head: true });
    if (!canCreateCertificate(plan, count ?? 0)) {
      e.preventDefault();
      e.stopPropagation();
      toast.error(`Plano ${plan.label} permite ${plan.limits.activeCertificates} certificado(s). Faça upgrade.`);
      navigate({ to: "/plans" });
    }
  }

  async function reactivateCert() {
    if (!cert) return;
    const { error } = await supabase.from("certificates").update({ status: "active" }).eq("id", cert.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Certificado reativado.");
    qc.invalidateQueries({ queryKey: ["certificates", id] });
  }

  function copyLink() {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    toast.success("Link copiado");
  }
  async function shareLink() {
    if (!publicUrl) return;
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({
          title: "Certificado Digital — TrailBook",
          text: `Certificado Digital de ${moto.data?.nickname || moto.data?.model || "moto"}`,
          url: publicUrl,
        });
        return;
      }
    } catch { /* usuário cancelou */ }
    copyLink();
  }
  function downloadQr() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `trailbook-qr-${cert?.public_token ?? "cert"}.png`;
    a.click();
  }

  const m = moto.data;
  const motoLabel = useMemo(() => m?.nickname || m?.model || "Moto", [m]);

  if (moto.isLoading || certs.isLoading) {
    return <div className="surface-elevated h-64 animate-pulse rounded-2xl" />;
  }
  if (!m) {
    return (
      <div className="surface-elevated rounded-2xl p-10 text-center">
        <h2 className="font-display text-xl font-bold">Moto não encontrada</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificado Digital"
        crumbs={[
          { label: "Motos", to: "/motorcycles" },
          { label: motoLabel, to: `/motorcycles/${m.id}` },
          { label: "Certificado Digital" },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <HelpTooltip label="Certificado Digital" text={HELP.passportShare} side="bottom" />
            <Button variant="outline" asChild>
              <Link to="/motorcycles/$id" params={{ id: m.id }}>
                <ArrowLeft className="h-4 w-4" /> Voltar à moto
              </Link>
            </Button>
          </div>
        }
      />

      {/* Estado A: nenhum certificado ainda */}
      {!cert && (
        <div className="surface-elevated rounded-2xl p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <BadgeCheck className="h-7 w-7" />
          </div>
          <h2 className="mt-4 font-display text-2xl font-bold">Ainda sem Certificado Digital</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            O Certificado Digital transforma o histórico da <strong>{motoLabel}</strong> em um link
            público de confiança — ideal para compartilhar com compradores, oficinas e seguradoras.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <CertificateSettingsDialog
              motorcycleId={m.id}
              trigger={
                <Button className="btn-glow" onClick={checkCertLimit}>
                  <Sparkles className="h-4 w-4" /> Gerar Certificado Digital
                </Button>
              }
            />
          </div>
          <ul className="mx-auto mt-6 max-w-md space-y-1 text-left text-xs text-muted-foreground">
            <li>• Você escolhe exatamente quais seções ficam visíveis.</li>
            <li>• Pode revogar a qualquer momento.</li>
            <li>• Cada acesso ao link fica registrado apenas para você.</li>
          </ul>
        </div>
      )}

      {/* Estado B/C/D: certificado existente */}
      {cert && eff && (
        <>
          <div className="surface-elevated rounded-2xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  {motoLabel}
                </div>
                <h1 className="font-display text-2xl font-bold">Certificado Digital</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={STATUS_TONE[eff]}>
                    {eff === "active" ? <Globe2 className="mr-1 h-3 w-3" /> :
                      eff === "private" ? <Lock className="mr-1 h-3 w-3" /> :
                      <ShieldOff className="mr-1 h-3 w-3" />}
                    {STATUS_LABEL[eff]}
                  </Badge>
                  {cert.expires_at && (
                    <span className="text-xs text-muted-foreground">
                      Expira em {new Date(cert.expires_at).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Ações principais por estado */}
            <div className="mt-5 grid gap-4 md:grid-cols-[220px_1fr]">
              <div className="flex items-center justify-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR Code do Certificado Digital"
                    className="h-[200px] w-[200px] rounded-xl border border-border bg-white p-2"
                  />
                ) : (
                  <div className="grid h-[200px] w-[200px] place-items-center rounded-xl border border-dashed border-border text-muted-foreground">
                    <QrCode className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {publicUrl && (
                  <code className="block truncate rounded-md bg-elevated px-2 py-1.5 text-[11px]">
                    {publicUrl}
                  </code>
                )}

                {eff === "active" && (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild className="btn-glow">
                      <a href={publicUrl ?? "#"} target="_blank" rel="noreferrer">
                        <Eye className="h-4 w-4" /> Visualizar
                      </a>
                    </Button>
                    <Button variant="outline" onClick={shareLink}>
                      <Share2 className="h-4 w-4" /> Compartilhar
                    </Button>
                    <Button variant="outline" onClick={copyLink}>
                      <Copy className="h-4 w-4" /> Copiar link
                    </Button>
                    <Button variant="outline" onClick={downloadQr} disabled={!qrDataUrl}>
                      <QrCode className="h-4 w-4" /> Baixar QR
                    </Button>
                  </div>
                )}

                {eff === "private" && (
                  <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
                    O certificado está <strong>privado</strong>. O link existe mas não abre para o público.
                    Ajuste em <em>Configurar</em> para torná-lo ativo novamente.
                  </div>
                )}

                {eff === "expired" && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300">
                    Este certificado <strong>expirou</strong>. Atualize a data de expiração em <em>Configurar</em>
                    ou gere um novo certificado.
                  </div>
                )}

                {eff === "revoked" && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                    Certificado <strong>revogado</strong>. O link público não abre mais.
                    Você pode reativar ou gerar um novo.
                  </div>
                )}

                {/* Ações secundárias / contextuais */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <CertificateSettingsDialog
                    motorcycleId={m.id}
                    existing={cert as any}
                    trigger={
                      <Button variant="outline" size="sm">
                        <Settings2 className="h-4 w-4" /> Configurar
                      </Button>
                    }
                  />
                  <CertificateAccessLogDialog
                    certificateId={cert.id}
                    trigger={
                      <Button variant="outline" size="sm">
                        <Activity className="h-4 w-4" /> Log de acessos
                      </Button>
                    }
                  />
                  {eff === "revoked" ? (
                    <Button variant="outline" size="sm" onClick={reactivateCert}>
                      <RefreshCcw className="h-4 w-4" /> Reativar
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setRevokeOpen(true)}>
                      <ShieldOff className="h-4 w-4" /> Revogar
                    </Button>
                  )}
                  <CertificateSettingsDialog
                    motorcycleId={m.id}
                    trigger={
                      <Button variant="ghost" size="sm" onClick={checkCertLimit}>
                        <Sparkles className="h-4 w-4" /> Gerar novo
                      </Button>
                    }
                  />
                  {publicUrl && eff === "active" && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={publicUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" /> Abrir em nova aba
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          {cert && (
            <RevokeCertificateDialog
              open={revokeOpen}
              onOpenChange={setRevokeOpen}
              certificateId={cert.id}
              motorcycleId={m.id}
            />
          )}
        </>
      )}
    </div>
  );
}