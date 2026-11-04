import { shareUrl } from "@/lib/external-links";
import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Copy, Eye, FileDown, Link2, Loader2, QrCode, ShieldAlert, ShieldOff, Timer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TBBottomSheet, TBButton, TBCard, TBEmptyState } from "@/design-system";
import { Button } from "@/components/ui/button";
import {
  FISCAL_DEFAULT_MINUTES,
  FISCAL_EXPIRY_OPTIONS,
  FISCAL_PRIVACY_NOTICE,
  NEVER_SHARED,
  PRESET_DESCRIPTION,
  PRESET_LABEL,
  PRESET_SECTIONS,
} from "@/lib/health-reports/sections";
import { SECTION_LABEL, type ReportSection, type ReportStatus } from "@/lib/health-reports/types";
import { formatDate } from "@/lib/trailbook";
import { trackHealth } from "@/lib/health-reports/telemetry";
import { useModule } from "@/hooks/useModules";

type Preset = "buyer" | "workshop" | "custom";
type ShareMode = "laudo" | "fiscal";

const ALL_SECTIONS = Object.keys(SECTION_LABEL) as ReportSection[];

/** Resumo não invasivo do acesso: apenas tipo de aparelho e navegador. */
function deviceSummary(ua: string | null): string {
  if (!ua) return "Dispositivo não identificado";
  const mobile = /iphone|ipad|android|mobile/i.test(ua);
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /chrome|crios/i.test(ua)
      ? "Chrome"
      : /firefox|fxios/i.test(ua)
        ? "Firefox"
        : /safari/i.test(ua)
          ? "Safari"
          : "Outro navegador";
  return `${mobile ? "Celular" : "Computador"} · ${browser}`;
}

function newToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

type FiscalShare = {
  id: string;
  public_token: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type ReportShare = {
  id: string;
  public_token: string;
  preset: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type AccessLog = {
  accessed_at: string;
  result: string;
  user_agent: string | null;
};

/** Compartilhamento público controlado do laudo — laudo e fiscalização num único ponto de entrada. */
export function SharePanel({
  reportId,
  reportCode,
  reportStatus,
  canManage,
}: {
  reportId: string;
  reportCode?: string;
  reportStatus?: ReportStatus | string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ShareMode>("laudo");

  // — Modo laudo —
  const [preset, setPreset] = useState<Preset>("buyer");
  const [sections, setSections] = useState<ReportSection[]>(PRESET_SECTIONS.buyer);
  const [days, setDays] = useState(30);
  const [qr, setQr] = useState<Record<string, string>>({});

  // — Modo fiscal —
  const { status: _fiscalRawStatus } = useModule("fiscalizacao");
  const fiscalModuleStatus = _fiscalRawStatus as "active" | "maintenance" | "disabled" | "beta";
  const fiscalEnabled = fiscalModuleStatus === "active" || fiscalModuleStatus === "beta";
  const [fiscalMinutes, setFiscalMinutes] = useState(FISCAL_DEFAULT_MINUTES);
  const [fiscalQrMap, setFiscalQrMap] = useState<Record<string, string>>({});

  // — Queries —
  const shares = useQuery<ReportShare[]>({
    queryKey: ["health-report-shares", reportId],
    queryFn: async () => {
      const { data } = await supabase
        .from("health_report_shares")
        .select("id, public_token, preset, expires_at, revoked_at, created_at")
        .eq("report_id", reportId)
        .order("created_at", { ascending: false });
      return (data ?? []) as ReportShare[];
    },
  });

  const logs = useQuery<AccessLog[]>({
    queryKey: ["health-report-logs", reportId],
    queryFn: async () => {
      const { data } = await supabase
        .from("health_report_access_logs")
        .select("accessed_at, result, user_agent")
        .eq("report_id", reportId)
        .order("accessed_at", { ascending: false })
        .limit(20);
      return (data ?? []) as AccessLog[];
    },
    enabled: canManage,
  });

  const fiscalShares = useQuery<FiscalShare[]>({
    queryKey: ["fiscal-shares", reportId],
    queryFn: async () => {
      const { data } = await supabase
        .from("health_report_shares")
        .select("id, public_token, expires_at, revoked_at, created_at")
        .eq("report_id", reportId)
        .eq("preset", "fiscal" as never)
        .order("created_at", { ascending: false })
        .limit(10);
      return (data ?? []) as FiscalShare[];
    },
    enabled: open && mode === "fiscal",
  });

  // — Mutações laudo —
  const create = useMutation({
    mutationFn: async () => {
      const token = newToken();
      const { error } = await supabase.from("health_report_shares").insert({
        report_id: reportId,
        created_by: (await supabase.auth.getSession()).data.session?.user.id ?? "",
        preset,
        allowed_sections: sections as never,
        public_token: token,
        expires_at: days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["health-report-shares", reportId] });
      setOpen(false);
      toast.success("Link de compartilhamento criado.");
      trackHealth("compartilhamento_criado", { reportId, preset, dias: days, secoes: sections.length });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("health_report_shares")
        .update({ revoked_at: new Date().toISOString(), revoked_reason: "Revogado pelo proprietário" })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["health-report-shares", reportId] });
      toast.success("Link revogado. Ele deixou de funcionar imediatamente.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // — Mutações fiscal —
  const fiscalCreate = useMutation({
    mutationFn: async () => {
      const session = await supabase.auth.getSession();
      const uid = session.data.session?.user.id ?? "";
      const token = newToken();
      const { error } = await supabase.from("health_report_shares").insert({
        report_id: reportId,
        created_by: uid,
        preset: "fiscal" as never,
        allowed_sections: ["identification", "summary"] as never,
        public_token: token,
        expires_at: minutesToIso(fiscalMinutes),
      });
      if (error) throw error;
      return token;
    },
    onSuccess: (token) => {
      qc.invalidateQueries({ queryKey: ["fiscal-shares", reportId] });
      toast.success("Acesso para fiscalização criado.");
      generateFiscalQr(token);
    },
    onError: (e: unknown) => toast.error((e as Error).message ?? "Erro ao criar acesso."),
  });

  const fiscalRevoke = useMutation({
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

  // — Helpers laudo —
  const urlOf = (token: string) => shareUrl(`/l/${token}`);

  const showQr = async (token: string) => {
    if (qr[token]) return;
    const dataUrl = await QRCode.toDataURL(urlOf(token), { width: 320, margin: 1 });
    setQr((prev) => ({ ...prev, [token]: dataUrl }));
  };

  const copy = async (token: string) => {
    await navigator.clipboard.writeText(urlOf(token));
    toast.success("Link copiado.");
  };

  // — Helpers fiscal —
  const generateFiscalQr = useCallback(async (token: string) => {
    if (fiscalQrMap[token]) return;
    try {
      const dataUrl = await QRCode.toDataURL(shareUrl("/l/" + token), { width: 280, margin: 1 });
      setFiscalQrMap((m) => ({ ...m, [token]: dataUrl }));
    } catch { /* opcional */ }
  }, [fiscalQrMap]);

  const copyFiscalLink = (token: string) => {
    navigator.clipboard.writeText(shareUrl("/l/" + token));
    toast.success("Link copiado.");
  };

  const shareFiscalLink = async (token: string) => {
    const url = shareUrl("/l/" + token);
    if (navigator.share) {
      try { await navigator.share({ title: `Laudo ${reportCode ?? ""} — Fiscalização`, url }); }
      catch { /* cancelado */ }
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
    }
  };

  const downloadFiscalPdf = useCallback(async (token: string) => {
    try {
      const { getPublicHealthReport } = await import("@/lib/health-reports.functions");
      const { buildFiscalPdf } = await import("@/lib/health-reports/fiscal-pdf");
      const res = await getPublicHealthReport({ data: { token } });
      if (!res.ok) { toast.error("Não foi possível gerar o PDF."); return; }
      const blob = await buildFiscalPdf({
        snapshot: res.snapshot,
        code: res.code,
        issuedAt: res.issuedAt,
        status: res.status,
        fiscal: res.fiscal,
        docImageDataUrl: null,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "fiscalizacao-" + res.code + ".pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Erro ao gerar PDF."); }
  }, []);

  const active = (shares.data ?? []).filter((s) => !s.revoked_at);
  const activeFiscalShares = (fiscalShares.data ?? []).filter(
    (s) => !s.revoked_at && s.expires_at && new Date(s.expires_at) > new Date(),
  );

  return (
    <div className="space-y-3">
      {canManage && (
        <TBButton onClick={() => setOpen(true)} variant="outline" className="w-full">
          <Link2 className="h-4 w-4" aria-hidden /> Compartilhar laudo
        </TBButton>
      )}

      {active.length === 0 ? (
        canManage && (
          <TBEmptyState
            title="Nenhum link ativo"
            description="Crie um link para mostrar este laudo a um comprador ou oficina. Você pode revogar quando quiser."
          />
        )
      ) : (
        <div className="space-y-2">
          {active.map((s) => (
            <TBCard key={s.id} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold">
                  {PRESET_LABEL[s.preset as Preset] ?? s.preset}
                </span>
                <span className="text-xs text-muted-foreground">
                  {s.expires_at ? `Expira em ${formatDate(s.expires_at)}` : "Sem data de expiração"}
                </span>
              </div>
              <p className="break-all text-xs text-muted-foreground">{urlOf(s.public_token)}</p>
              {qr[s.public_token] && (
                <img
                  src={qr[s.public_token]}
                  alt="QR Code do laudo"
                  className="h-40 w-40 rounded-xl bg-white p-2"
                />
              )}
              <div className="flex flex-wrap gap-2">
                <TBButton size="sm" variant="outline" onClick={() => copy(s.public_token)}>
                  <Copy className="h-4 w-4" aria-hidden /> Copiar
                </TBButton>
                <TBButton size="sm" variant="outline" onClick={() => showQr(s.public_token)}>
                  QR Code
                </TBButton>
                {canManage && (
                  <TBButton size="sm" variant="ghost" onClick={() => revoke.mutate(s.id)}>
                    <ShieldOff className="h-4 w-4" aria-hidden /> Revogar
                  </TBButton>
                )}
              </div>
            </TBCard>
          ))}
        </div>
      )}

      {canManage && (logs.data?.length ?? 0) > 0 && (
        <TBCard className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Eye className="h-4 w-4" aria-hidden /> Quem acessou
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {logs.data!.map((l, i) => (
              <li key={i}>
                {formatDate(l.accessed_at)} · {deviceSummary(l.user_agent)} —{" "}
                {l.result === "ok" ? "acesso concluído" : "acesso negado"}
              </li>
            ))}
          </ul>
        </TBCard>
      )}

      <TBBottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Compartilhar laudo"
        description={
          mode === "laudo"
            ? "Escolha o que a outra pessoa poderá ver."
            : "Acesso temporário com dados essenciais para apresentação durante uma fiscalização."
        }
      >
        <div className="space-y-4">

          {/* Seletor de modo: Laudo / Fiscalização */}
          {fiscalEnabled && (
            <div className="flex rounded-xl border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setMode("laudo")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  mode === "laudo"
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-muted/50"
                }`}
              >
                Laudo
              </button>
              <button
                type="button"
                onClick={() => setMode("fiscal")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
                  mode === "fiscal"
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                Fiscalização
              </button>
            </div>
          )}

          {/* ── Modo Laudo ── */}
          {mode === "laudo" && (
            <>
              <div className="space-y-2">
                {(Object.keys(PRESET_LABEL) as Preset[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPreset(p);
                      setSections(PRESET_SECTIONS[p]);
                    }}
                    className={`w-full rounded-xl border p-3 text-left text-sm ${
                      preset === p ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <span className="block font-bold">{PRESET_LABEL[p]}</span>
                    <span className="block text-muted-foreground">{PRESET_DESCRIPTION[p]}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-bold">Seções incluídas</div>
                {ALL_SECTIONS.map((sec) => (
                  <label key={sec} className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={sections.includes(sec)}
                      onChange={(e) => {
                        setPreset("custom");
                        setSections((prev) =>
                          e.target.checked ? [...prev, sec] : prev.filter((x) => x !== sec),
                        );
                      }}
                    />
                    {SECTION_LABEL[sec]}
                  </label>
                ))}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-bold">Validade do link</div>
                <div className="flex flex-wrap gap-2">
                  {[7, 30, 90, 0].map((d) => (
                    <TBButton
                      key={d}
                      size="sm"
                      variant={days === d ? "default" : "outline"}
                      onClick={() => setDays(d)}
                    >
                      {d === 0 ? "Sem expiração" : `${d} dias`}
                    </TBButton>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                <div className="mb-1 font-bold text-foreground">Nunca é compartilhado</div>
                <ul className="list-disc space-y-0.5 pl-4">
                  {NEVER_SHARED.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>

              <TBButton
                className="w-full"
                disabled={sections.length === 0 || create.isPending}
                onClick={() => create.mutate()}
              >
                Criar link
              </TBButton>
            </>
          )}

          {/* ── Modo Fiscalização ── */}
          {mode === "fiscal" && fiscalEnabled && (
            <>
              {(fiscalModuleStatus as string) === "maintenance" && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
                  Está temporariamente em manutenção.
                </div>
              )}

              {!canShareForFiscal(reportStatus ?? "") && (fiscalModuleStatus as string) !== "maintenance" && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  Este laudo está {reportStatus === "revoked" ? "revogado" : "desatualizado"} e não pode
                  ser compartilhado para fiscalização. Emita um novo Check-up para gerar um laudo válido.
                </div>
              )}

              {canShareForFiscal(reportStatus ?? "") && (fiscalModuleStatus as string) !== "maintenance" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">{FISCAL_PRIVACY_NOTICE}</p>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                      Validade do acesso
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {FISCAL_EXPIRY_OPTIONS.map((opt) => (
                        <button
                          key={opt.minutes}
                          type="button"
                          onClick={() => setFiscalMinutes(opt.minutes)}
                          className={
                            "rounded-xl border px-3 py-2 text-sm font-medium transition " +
                            (fiscalMinutes === opt.minutes
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card text-muted-foreground hover:border-primary/40")
                          }
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    className="w-full btn-glow"
                    onClick={() => fiscalCreate.mutate()}
                    disabled={fiscalCreate.isPending}
                  >
                    {fiscalCreate.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando…</>
                    ) : (
                      <><QrCode className="mr-2 h-4 w-4" /> Gerar acesso</>
                    )}
                  </Button>
                </div>
              )}

              {activeFiscalShares.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Acessos ativos
                  </p>
                  {activeFiscalShares.map((s) => {
                    const qrImg = fiscalQrMap[s.public_token];
                    if (!qrImg) generateFiscalQr(s.public_token);
                    return (
                      <div key={s.id} className="rounded-xl border border-border bg-card p-4 space-y-4">
                        {qrImg
                          ? <img src={qrImg} alt="QR do acesso fiscal" className="mx-auto rounded-xl w-52 h-52" />
                          : <div className="mx-auto w-52 h-52 rounded-xl bg-muted animate-pulse" />}

                        <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                          <Timer className="h-4 w-4 shrink-0" />
                          <span>Expira em <strong>{s.expires_at ? formatExpiry(s.expires_at) : "?"}</strong></span>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button variant="outline" className="w-full" onClick={() => copyFiscalLink(s.public_token)}>
                            <Copy className="mr-2 h-4 w-4" /> Copiar link
                          </Button>
                          <Button variant="outline" className="w-full" onClick={() => shareFiscalLink(s.public_token)}>
                            Compartilhar
                          </Button>
                          <Button variant="outline" className="w-full" onClick={() => downloadFiscalPdf(s.public_token)}>
                            <FileDown className="mr-2 h-4 w-4" /> Baixar PDF
                          </Button>
                        </div>

                        <div className="border-t border-border pt-3">
                          <Button
                            variant="outline"
                            className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => fiscalRevoke.mutate(s.id)}
                            disabled={fiscalRevoke.isPending}
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
                Este acesso foi compartilhado voluntariamente pelo proprietário e possui validade temporária.
                Não substitui documento oficial governamental.
              </p>
            </>
          )}
        </div>
      </TBBottomSheet>
    </div>
  );
}
