import { shareUrl } from "@/lib/external-links";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Copy, Eye, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TBBottomSheet, TBButton, TBCard, TBEmptyState } from "@/design-system";
import { Link2 } from "lucide-react";
import {
  NEVER_SHARED,
  PRESET_DESCRIPTION,
  PRESET_LABEL,
  PRESET_SECTIONS,
} from "@/lib/health-reports/sections";
import { SECTION_LABEL, type ReportSection } from "@/lib/health-reports/types";
import { formatDate } from "@/lib/trailbook";
import { trackHealth } from "@/lib/health-reports/telemetry";

type Preset = "buyer" | "workshop" | "custom";

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

/** Compartilhamento público controlado do laudo — comprador, oficina ou personalizado. */
export function SharePanel({
  reportId,
  canManage,
  purpose,
}: {
  reportId: string;
  canManage: boolean;
  /** Finalidade do laudo — define o preset padrão e simplifica a UI quando for "oficina". */
  purpose?: "comercial" | "oficina" | "pessoal";
}) {
  const isOficina = purpose === "oficina";
  const defaultPreset: Preset = isOficina ? "workshop" : "buyer";

  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<Preset>(defaultPreset);
  const [sections, setSections] = useState<ReportSection[]>(PRESET_SECTIONS[defaultPreset]);
  const [days, setDays] = useState(30);
  const [qr, setQr] = useState<Record<string, string>>({});

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

  const active = (shares.data ?? []).filter((s) => !s.revoked_at);

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
        title={isOficina ? "Compartilhar com a oficina" : "Compartilhar laudo"}
        description={
          isOficina
            ? "Gere um link para o mecânico ver o diagnóstico e baixar o checklist."
            : "Escolha o que a outra pessoa poderá ver."
        }
      >
        <div className="space-y-5">
          {/* ── MODO OFICINA ── layout compacto e direto */}
          {isOficina ? (
            <>
              {/* O que o mecânico verá — chips discretos */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  O mecânico verá
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["Diagnóstico por componente", "Plano de Ação", "Histórico de manutenção", "Download do checklist PDF"].map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Validade — segmentado horizontal */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Validade do link
                </p>
                <div className="grid grid-cols-4 gap-1.5 rounded-xl border border-border p-1">
                  {[{ label: "7 dias", val: 7 }, { label: "30 dias", val: 30 }, { label: "90 dias", val: 90 }, { label: "Sem prazo", val: 0 }].map(({ label, val }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setDays(val)}
                      className={`rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                        days === val
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Botão compacto, não full-width brutal */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-xs text-muted-foreground">
                  CPF, telefone e dados pessoais nunca são compartilhados.
                </p>
                <TBButton
                  size="sm"
                  disabled={create.isPending}
                  onClick={() => create.mutate()}
                  className="shrink-0"
                >
                  {create.isPending ? "Gerando…" : "Gerar link"}
                </TBButton>
              </div>
            </>
          ) : (
            <>
              {/* ── MODO PADRÃO (buyer / custom / fiscal) ── */}
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
        </div>
      </TBBottomSheet>
    </div>
  );
}
