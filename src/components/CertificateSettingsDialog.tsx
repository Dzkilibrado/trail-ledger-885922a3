import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, Globe2, Lock, ShieldAlert, Copy, ExternalLink } from "lucide-react";
import { CERT_SECTIONS, DEFAULT_SECTIONS, type CertSectionKey, type CertStatus, STATUS_LABEL, STATUS_TONE, effectiveStatus } from "@/lib/cert-sections";

type CertRow = {
  id: string;
  public_token: string;
  status: string | null;
  expires_at: string | null;
  allowed_sections: unknown;
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = Array.isArray(existing?.allowed_sections) ? (existing!.allowed_sections as CertSectionKey[]) : DEFAULT_SECTIONS;
    setSections(new Set(next));
    setStatus((existing?.status as CertStatus) || "active");
    setExpires(existing?.expires_at ? existing.expires_at.slice(0, 10) : "");
  }, [open, existing]);

  function toggle(k: CertSectionKey) {
    setSections((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }

  async function save() {
    setSaving(true);
    const payload = {
      motorcycle_id: motorcycleId,
      allowed_sections: Array.from(sections),
      status,
      expires_at: expires ? new Date(expires).toISOString() : null,
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
  const publicUrl = existing && typeof window !== "undefined" ? `${window.location.origin}/c/${existing.public_token}` : null;
  const sensitiveOn = CERT_SECTIONS.filter((s) => s.sensitive && sections.has(s.key));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Globe2 className="h-5 w-5 text-primary" /> Configurar certificado público</DialogTitle>
          <DialogDescription>
            Escolha exatamente quais informações ficarão visíveis no link público. Qualquer pessoa com o link
            poderá ver o que estiver marcado abaixo.
          </DialogDescription>
        </DialogHeader>

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
          <ul className="divide-y divide-border rounded-xl border border-border">
            {CERT_SECTIONS.map((sec) => (
              <li key={sec.key} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {sec.label}
                    {sec.sensitive ? <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-400">sensível</Badge> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">{sec.description}</div>
                </div>
                <Switch checked={sections.has(sec.key)} onCheckedChange={() => toggle(sec.key)} />
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
            <Badge variant="outline" className={STATUS_TONE[eff]}>{STATUS_LABEL[eff]}</Badge>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {sections.size === 0 ? "Nenhuma seção marcada — o certificado ficará praticamente vazio." :
              `${sections.size} de ${CERT_SECTIONS.length} seções serão exibidas.`}
          </div>
          {publicUrl ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="truncate rounded-md bg-elevated px-2 py-1 text-[11px]">{publicUrl}</code>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado"); }}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
              <a href={publicUrl} target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><ExternalLink className="h-3.5 w-3.5" /> Pré-visualizar</Button></a>
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-muted-foreground">O link será gerado ao salvar.</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : existing ? "Salvar alterações" : "Criar certificado"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}