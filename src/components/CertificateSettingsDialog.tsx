import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, Globe2, Lock, ShieldAlert, Copy, ExternalLink, QrCode, Users } from "lucide-react";
import QRCode from "qrcode";
import {
  CERT_SECTIONS, DEFAULT_SECTIONS, type CertSectionKey, type CertStatus,
  STATUS_LABEL, STATUS_TONE, effectiveStatus,
  AUDIENCE_PRESETS, AUDIENCE_LABEL, AUDIENCE_DESCRIPTION, type CertAudience,
} from "@/lib/cert-sections";

type CertRow = {
  id: string;
  public_token: string;
  status: string | null;
  expires_at: string | null;
  allowed_sections: unknown;
  audience?: string | null;
};

type Props = {
  motorcycleId: string;
  existing?: CertRow | null;
  trigger: React.ReactNode;
  onSaved?: (cert: CertRow) => void;
};

export function CertificateSettingsDialog({ motorcycleId, existing, trigger, onSaved }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const initial = (Array.isArray(existing?.allowed_sections) ? (existing!.allowed_sections as CertSectionKey[]) : DEFAULT_SECTIONS);
  const [sections, setSections] = useState<Set<CertSectionKey>>(new Set(initial));
  const [status, setStatus] = useState<CertStatus>((existing?.status as CertStatus) || "active");
  const [expires, setExpires] = useState<string>(existing?.expires_at ? existing.expires_at.slice(0, 10) : "");
  const [audience, setAudience] = useState<CertAudience>((existing?.audience as CertAudience) || "custom");
  const [saving, setSaving] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const next = Array.isArray(existing?.allowed_sections) ? (existing!.allowed_sections as CertSectionKey[]) : DEFAULT_SECTIONS;
    setSections(new Set(next));
    setStatus((existing?.status as CertStatus) || "active");
    setExpires(existing?.expires_at ? existing.expires_at.slice(0, 10) : "");
    setAudience((existing?.audience as CertAudience) || "custom");
  }, [open, existing]);

  function toggle(k: CertSectionKey) {
    setSections((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
    setAudience("custom");
  }

  function applyAudience(a: CertAudience) {
    setAudience(a);
    if (a !== "custom") setSections(new Set(AUDIENCE_PRESETS[a]));
  }

  async function save() {
    setSaving(true);
    const payload = {
      motorcycle_id: motorcycleId,
      allowed_sections: Array.from(sections),
      status,
      expires_at: expires ? new Date(expires).toISOString() : null,
      audience,
    };
    const q = existing
      ? supabase.from("certificates").update(payload).eq("id", existing.id).select("*").single()
      : supabase.from("certificates").insert(payload).select("*").single();
    const { data, error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Certificado atualizado" : "Certificado criado");
    qc.invalidateQueries({ queryKey: ["certificates"] });
    onSaved?.(data as CertRow);
    setOpen(false);
  }

  const eff = effectiveStatus({ status, expires_at: expires ? new Date(expires).toISOString() : null });
  const publicUrl = existing ? shareUrl(`/c/${existing.public_token}`) : null;
  const sensitiveOn = CERT_SECTIONS.filter((s) => s.sensitive && sections.has(s.key));

  useEffect(() => {
    if (!publicUrl) { setQrDataUrl(null); return; }
    let active = true;
    QRCode.toDataURL(publicUrl, { margin: 1, width: 220, color: { dark: "#111113", light: "#FFFFFF" } })
      .then((u) => { if (active) setQrDataUrl(u); })
      .catch(() => { if (active) setQrDataUrl(null); });
    return () => { active = false; };
  }, [publicUrl]);

  function downloadQr() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `trailbook-qr-${existing?.public_token ?? "cert"}.png`;
    a.click();
  }
  function printQr() {
    if (!qrDataUrl || !publicUrl) return;
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) return;
    w.document.write(`<html><head><title>QR Code · TrailBook</title><style>body{font-family:system-ui;text-align:center;padding:32px}img{width:320px;height:320px}code{display:block;margin-top:16px;font-size:12px;word-break:break-all;color:#444}</style></head><body><h2>Passaporte Digital — TrailBook</h2><img src="${qrDataUrl}"/><code>${publicUrl}</code><script>window.onload=()=>setTimeout(()=>window.print(),200)</script></body></html>`);
    w.document.close();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[92dvh] w-[min(100vw-1rem,42rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-4 py-3 sm:px-6">
          <DialogTitle className="flex items-center gap-2"><Globe2 className="h-5 w-5 text-primary" /> Configurar certificado público</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Escolha exatamente quais informações ficarão visíveis no link público. Qualquer pessoa com o link
            poderá ver o que estiver marcado abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <strong className="font-semibold">Link público.</strong> Qualquer pessoa com o link/QR Code consegue abrir o certificado —
              não exige login. Mantenha desligadas as seções sensíveis (custos, notas fiscais, documentos)
              se você não quiser compartilhá-las.
            </div>
          </div>
        </div>

        {/* Audience presets */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Compartilhar como…
          </Label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(AUDIENCE_LABEL) as CertAudience[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => applyAudience(a)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  audience === a ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {AUDIENCE_LABEL[a]}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{AUDIENCE_DESCRIPTION[audience]}</p>
        </div>

        {/* Status + expiração */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
            <div className="flex flex-wrap gap-2">
              {(["active","private"] as CertStatus[]).map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${status === s ? STATUS_TONE[s] : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {s === "active" ? <Globe2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {status === "active" ? "Visível para qualquer pessoa com o link." : "Link existe mas não abre — pré-visualização interna apenas."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expires" className="text-xs uppercase tracking-wide text-muted-foreground">Expira em (opcional)</Label>
            <Input id="expires" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Deixe em branco para nunca expirar.</p>
          </div>
        </div>

        {/* Seções */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Seções visíveis</Label>
            <div className="flex gap-2 text-xs">
              <button type="button" className="text-primary hover:underline" onClick={() => setSections(new Set(DEFAULT_SECTIONS))}>Restaurar padrão</button>
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setSections(new Set(CERT_SECTIONS.map((s) => s.key)))}>Tudo</button>
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setSections(new Set())}>Nada</button>
            </div>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {CERT_SECTIONS.map((sec) => (
              <li key={sec.key} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{sec.label}</span>
                    {sec.sensitive ? <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-400">sensível</Badge> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">{sec.description}</div>
                </div>
                <Switch className="shrink-0" checked={sections.has(sec.key)} onCheckedChange={() => toggle(sec.key)} />
              </li>
            ))}
          </ul>
          {sensitiveOn.length > 0 ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-300">
              Você habilitou: {sensitiveOn.map((s) => s.label).join(", ")}. Essas informações serão expostas publicamente.
            </div>
          ) : null}
        </div>

        {/* Preview/status block */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold"><Eye className="h-4 w-4" /> Pré-visualização</div>
            {existing ? (
              <Badge variant="outline" className={STATUS_TONE[eff]}>{STATUS_LABEL[eff]}</Badge>
            ) : (
              <Badge variant="outline" className="border-primary/40 text-primary">
                Rascunho — será gerado ao salvar
              </Badge>
            )}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {sections.size === 0 ? "Nenhuma seção marcada — o certificado ficará praticamente vazio." :
              `${sections.size} de ${CERT_SECTIONS.length} seções serão exibidas.`}
          </div>
          {publicUrl ? (
            <div className="mt-3 flex flex-col items-stretch gap-3 sm:grid sm:grid-cols-[120px_minmax(0,1fr)]">
              <div className="flex justify-center sm:block">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code do certificado" className="h-[120px] w-[120px] rounded-lg border border-border bg-white p-1" />
                ) : (
                  <div className="grid h-[120px] w-[120px] place-items-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                    <QrCode className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="min-w-0 space-y-2">
                <code className="block w-full truncate rounded-md bg-elevated px-2 py-1 text-[11px]">{publicUrl}</code>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado"); }}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
                  <a href={publicUrl} target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><ExternalLink className="h-3.5 w-3.5" /> Abrir</Button></a>
                  <Button size="sm" variant="outline" onClick={downloadQr} disabled={!qrDataUrl}><QrCode className="h-3.5 w-3.5" /> Baixar QR</Button>
                  <Button size="sm" variant="outline" onClick={printQr} disabled={!qrDataUrl}>Imprimir</Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-muted-foreground">O link será gerado ao salvar.</p>
          )}
        </div>
        </div>

        <DialogFooter className="sticky bottom-0 flex-col-reverse gap-2 border-t border-border bg-background/95 px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur sm:flex-row sm:px-6">
          <Button variant="ghost" onClick={() => setOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
          <Button onClick={save} disabled={saving} className="w-full sm:w-auto">{saving ? "Salvando…" : existing ? "Salvar alterações" : "Criar certificado"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}