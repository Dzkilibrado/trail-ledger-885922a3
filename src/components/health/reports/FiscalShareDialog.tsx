// ============================================================
// FiscalShareDialog — Compartilhar Laudo para Fiscalizacao
// Gera share com preset="fiscal", expires_at obrigatorio
// UX mobile-first. Reutiliza health_report_shares.
// ============================================================

import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Copy, QrCode, ShieldOff, Timer, Loader2, AlertTriangle, FileDown } from "lucide-react";
import { shareUrl } from "@/lib/external-links";
import { Button } from "@/components/ui/button";
import { TBBottomSheet } from "@/design-system/overlays/TBBottomSheet";
import { FISCAL_DEFAULT_MINUTES, FISCAL_EXPIRY_OPTIONS } from "@/lib/health-reports/sections";
import { useModule } from "@/hooks/useModules";
import type { ReportStatus } from "@/lib/health-reports/types";

function newToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function minutesToIso(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function canShareForFiscal(status: string): boolean {
  return status === "valid" || status === "expiring";
}

interface Props {
  reportId: string;
  reportStatus: ReportStatus | string;
  reportCode: string;
  open: boolean;
  onClose: () => void;
}

type FiscalShare = {
  id: string;
  public_token: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export function FiscalShareDialog({ reportId, reportStatus, reportCode, open, onClose }: Props) {
  const qc = useQueryClient();
  const [selectedMinutes, setSelectedMinutes] = useState(FISCAL_DEFAULT_MINUTES);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const { status: moduleStatus } = useModule("fiscalizacao");

  const shares = useQuery({
    queryKey: ["fiscal-shares", reportId],
    queryFn: async () => {
      const { data } = await supabase
        .from("health_report_shares")
        .select("id, public_token, expires_at, revoked_at, created_at")
        .eq("report_id", reportId)
        .eq("preset", "fiscal" as any)
        .order("created_at", { ascending: false })
        .limit(10);
      return (data ?? []) as FiscalShare[];
    },
    enabled: open,
  });

  const activeFiscalShares = (shares.data ?? []).filter(
    (s) => !s.revoked_at && s.expires_at && new Date(s.expires_at) > new Date(),
  );

  const create = useMutation({
    mutationFn: async () => {
      const session = await supabase.auth.getSession();
      const uid = session.data.session?.user.id ?? "";
      const token = newToken();
      const { error } = await supabase.from("health_report_shares").insert({
        report_id:        reportId,
        created_by:       uid,
        preset:           "fiscal" as any,
        allowed_sections: ["identification", "summary"] as any,
        public_token:     token,
        expires_at:       minutesToIso(selectedMinutes),
      });
      if (error) throw error;
      return token;
    },
    onSuccess: (token) => {
      qc.invalidateQueries({ queryKey: ["fiscal-shares", reportId] });
      toast.success("Acesso para fiscalização criado.");
      generateQr(token);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar acesso."),
  });

  const revoke = useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase
        .from("health_report_shares")
        .update({ revoked_at: new Date().toISOString(), revoked_reason: "Revogado pelo proprietário" })
        .eq("id", shareId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fiscal-shares", reportId] });
      toast.success("Acesso revogado.");
    },
  });

  const downloadFiscalPdf = useCallback(async (token: string) => {
    try {
      const { getPublicHealthReport } = await import("@/lib/health-reports.functions");
      const { buildFiscalPdf } = await import("@/lib/health-reports/fiscal-pdf");
      const res = await getPublicHealthReport({ data: { token } });
      if (!res.ok) { toast.error("Nao foi possivel gerar o PDF."); return; }
      const blob = await buildFiscalPdf({
        snapshot: (res as any).snapshot ?? {},
        code: res.code,
        issuedAt: res.issuedAt,
        status: res.status,
        fiscal: (res as any).fiscal ?? null,
        docImageDataUrl: null, // proprietario autenticado pode buscar — pendencia de homologacao
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "fiscalizacao-" + res.code + ".pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (_) { toast.error("Erro ao gerar PDF."); }
  }, []);

  const generateQr = useCallback(async (token: string) => {
    if (qrMap[token]) return;
    try {
      const url = shareUrl("/l/" + token);
      const dataUrl = await QRCode.toDataURL(url, { width: 280, margin: 1 });
      setQrMap((m) => ({ ...m, [token]: dataUrl }));
    } catch (_) {}
  }, [qrMap]);

  function copyLink(token: string) {
    navigator.clipboard.writeText(shareUrl("/l/" + token));
    toast.success("Link copiado.");
  }

  async function doShare(token: string) {
    const url = shareUrl("/l/" + token);
    if (navigator.share) {
      try { await navigator.share({ title: "Laudo " + reportCode + " - Fiscalizacao", url }); }
      catch (_) {}
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
    }
  }

  if (moduleStatus === "disabled") return null;

  return (
    <TBBottomSheet open={open} onOpenChange={(v) => { if (!v) onClose(); }} title="Compartilhar para Fiscalização">
      <div className="space-y-4 pb-6">

        {moduleStatus === "maintenance" && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
            Está temporariamente em manutenção.
          </div>
        )}

        {!canShareForFiscal(reportStatus) && moduleStatus !== "maintenance" && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Este laudo esta {reportStatus === "revoked" ? "revogado" : "desatualizado"} e nao pode
              ser compartilhado para fiscalizacao. Emita um novo Check-up para gerar um laudo valido.
            </span>
          </div>
        )}

        {canShareForFiscal(reportStatus) && moduleStatus !== "maintenance" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Crie um acesso temporario com as informacoes essenciais da moto e do Laudo para
              apresentacao durante uma fiscalizacao. O link expira automaticamente.
            </p>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Validade do acesso
              </p>
              <div className="grid grid-cols-2 gap-2">
                {FISCAL_EXPIRY_OPTIONS.map((opt) => (
                  <button
                    key={opt.minutes}
                    onClick={() => setSelectedMinutes(opt.minutes)}
                    className={
                      "rounded-xl border px-3 py-2 text-sm font-medium transition " +
                      (selectedMinutes === opt.minutes
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40")
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full btn-glow" onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...</>
                : <><QrCode className="mr-2 h-4 w-4" /> Gerar acesso</>}
            </Button>
          </div>
        )}

        {activeFiscalShares.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Acessos ativos
            </p>
            {activeFiscalShares.map((s) => {
              const qr = qrMap[s.public_token];
              if (!qr) generateQr(s.public_token);
              return (
                <div key={s.id} className="rounded-xl border border-border bg-card p-4 space-y-4">
                  {/* QR centralizado */}
                  {qr
                    ? <img src={qr} alt="QR do acesso fiscal" className="mx-auto rounded-xl w-52 h-52" />
                    : <div className="mx-auto w-52 h-52 rounded-xl bg-muted animate-pulse" />}

                  {/* Expiração */}
                  <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                    <Timer className="h-4 w-4 shrink-0" />
                    <span>Expira em <strong>{s.expires_at ? formatExpiry(s.expires_at) : "?"}</strong></span>
                  </div>

                  {/* Ações principais */}
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" className="w-full" onClick={() => copyLink(s.public_token)}>
                      <Copy className="mr-2 h-4 w-4" /> Copiar link
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => doShare(s.public_token)}>
                      Compartilhar
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => downloadFiscalPdf(s.public_token)}>
                      <FileDown className="mr-2 h-4 w-4" /> Baixar PDF
                    </Button>
                  </div>

                  {/* Ação destrutiva separada */}
                  <div className="border-t border-border pt-3">
                    <Button
                      variant="outline"
                      className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => revoke.mutate(s.id)}
                      disabled={revoke.isPending}
                    >
                      <ShieldOff className="mr-2 h-4 w-4" /> Revogar acesso
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center leading-relaxed px-2">
          Este acesso foi compartilhado voluntariamente pelo proprietario e possui validade temporaria.
          Nao substitui documento oficial governamental.
        </p>
      </div>
    </TBBottomSheet>
  );
}
