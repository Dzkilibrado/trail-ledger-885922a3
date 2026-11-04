import { useState, useEffect, useRef } from "react";
import { AlertTriangle, ChevronDown, ShieldCheck } from "lucide-react";
import { TBCard, TBStatusPill } from "@/design-system";
import {
  SECTION_LABEL,
  type HealthReportSnapshot,
  type ReportPurpose,
  type ReportSection,
} from "@/lib/health-reports/types";
import type { HealthStatus } from "@/lib/til/status";
import { formatDate } from "@/lib/trailbook";
import { cn } from "@/lib/utils";
import { EvaluationPill } from "@/components/health/EvaluationPill";
import { stateFromScore } from "@/lib/ui/evaluation";
import type { PublicHealthReportSnapshot, PublicComponent } from "@/lib/health-reports/public-types";

const asStatus = (v: string): HealthStatus => (["ok", "attention", "action", "unknown"].includes(v) ? (v as HealthStatus) : "unknown");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-black uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-semibold">{value}</span>
    </div>
  );
}

function ComponentRow({ c }: { c: PublicComponent }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 text-left"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{c.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{c.categoryLabel}</span>
        </span>
        <span className="flex items-center gap-2">
          <TBStatusPill status={asStatus(c.status)} label={c.statusLabel} size="sm" />
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-border px-3 py-3 text-sm">
          {c.conclusion && <p className="leading-relaxed">{c.conclusion}</p>}
          {c.reasons?.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {c.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          {c.nextAction && <p className="text-muted-foreground">Próxima ação: {c.nextAction}</p>}
          {c.dueEstimateLabel && <p className="text-muted-foreground">Previsão: {c.dueEstimateLabel}</p>}
          <p className="text-xs text-muted-foreground">Confiabilidade: {c.confidenceLabel}</p>
          {c.missingData?.length > 0 && (
            <p className="text-xs text-muted-foreground">Faltam dados: {c.missingData.join("; ")}</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * QR Code do cofre de documentos — renderizado via canvas (qrcode).
 * Exibido apenas no layout Comercial quando snapshot.docsQrUrl existe.
 */
function DocsQrBlock({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    import("qrcode").then((QRCode) => {
      QRCode.toCanvas(canvasRef.current!, url, {
        width: 128,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      }, (err: Error | null) => {
        if (err) setError(true);
      });
    }).catch(() => setError(true));
  }, [url]);

  if (error) return null;

  return (
    <TBCard className="flex flex-col items-center gap-3 py-4 text-center sm:flex-row sm:text-left">
      <canvas ref={canvasRef} className="shrink-0 rounded-lg" aria-label="QR Code do cofre de documentos" />
      <div className="space-y-1">
        <p className="text-sm font-bold">Cofre de documentos</p>
        <p className="text-xs text-muted-foreground leading-snug">
          Escaneie o QR Code para acessar os documentos desta moto: Nota Fiscal,
          Recibo de Compra e Venda e demais anexos registrados pelo proprietário.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block break-all text-[11px] text-primary hover:underline"
        >
          {url}
        </a>
      </div>
    </TBCard>
  );
}

/**
 * Renderização oficial do Laudo — SEMPRE a partir do snapshot emitido.
 * Nunca recalcula nada e nunca busca dados atuais.
 *
 * `purpose` controla quais seções são exibidas e em que ordem:
 *  - comercial: histórico + conservação + componentes (sem "posso rodar", sem pendências urgentes)
 *  - oficina:   "posso rodar" em destaque + pendências + próximas manutenções + componentes (sem índices)
 *  - pessoal:   visão completa (padrão)
 */
export function ReportSnapshotView({
  snapshot: s,
  sections,
  purpose,
  code,
  sha256,
  statusLabel,
  className,
}: {
  snapshot: PublicHealthReportSnapshot | Partial<HealthReportSnapshot>;
  sections?: ReportSection[];
  /** Finalidade do laudo — altera layout e seções exibidas. */
  purpose?: ReportPurpose;
  code?: string;
  sha256?: string;
  statusLabel?: string;
  className?: string;
}) {
  // Finalidade efetiva: lê do snapshot se não vier como prop (tela do laudo já emitido)
  const snapshotPurpose = ("purpose" in s ? (s as Partial<HealthReportSnapshot>).purpose : undefined);
  const effectivePurpose: ReportPurpose = purpose ?? snapshotPurpose ?? "pessoal";

  const show = (sec: ReportSection) => (sections ? sections.includes(sec) : true);

  // ── Bloco "Posso rodar?" — destaque para oficina ──────────────
  const RideAnswerBlock = () => {
    if (!s.rideAnswer) return null;
    const isUrgent = ["action"].includes((s.rideAnswer as { status: string }).status ?? "");
    return (
      <div className={cn(
        "rounded-xl p-4 space-y-1",
        isUrgent ? "bg-destructive/10 border border-destructive/30" : "bg-muted/50",
      )}>
        {isUrgent && <AlertTriangle className="h-4 w-4 text-destructive mb-1" aria-hidden />}
        <div className={cn("text-sm font-bold", isUrgent ? "text-destructive" : "")}>
          Posso rodar hoje? {s.rideAnswer.title}
        </div>
        <p className="text-sm text-muted-foreground">{s.rideAnswer.message}</p>
        {s.rideAnswer.rationale && (
          <p className="text-xs text-muted-foreground">{s.rideAnswer.rationale}</p>
        )}
      </div>
    );
  };

  // ── Bloco de pendências / itens que precisam ação — para oficina ─
  const PendingItemsBlock = () => {
    if (!s.recommendations) return null;
    const urgent = s.recommendations.filter(
      (r) => r.status === "overdue" || r.status === "action" || r.isSafetyItem,
    );
    const upcoming = s.recommendations.filter(
      (r) => r.status === "due_soon" && !r.isSafetyItem,
    );
    if (urgent.length === 0 && upcoming.length === 0) return null;
    return (
      <Section title="Itens para atenção">
        <div className="space-y-2">
          {urgent.length > 0 && (
            <TBCard className="space-y-2 border-destructive/30 bg-destructive/5">
              <p className="text-xs font-bold uppercase tracking-wide text-destructive">
                {urgent.length} {urgent.length === 1 ? "item vencido / crítico" : "itens vencidos / críticos"}
              </p>
              <ul className="space-y-2">
                {urgent.map((r) => (
                  <li key={r.title} className="text-sm">
                    <span className="font-semibold">{r.title}</span>
                    <span className="block text-muted-foreground">{r.recommendation}</span>
                    {r.dueEstimateLabel && (
                      <span className="block text-xs text-destructive">{r.dueEstimateLabel}</span>
                    )}
                  </li>
                ))}
              </ul>
            </TBCard>
          )}
          {upcoming.length > 0 && (
            <TBCard className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Próximas intervenções
              </p>
              <ul className="space-y-2">
                {upcoming.map((r) => (
                  <li key={r.title} className="text-sm">
                    <span className="font-semibold">{r.title}</span>
                    <span className="block text-muted-foreground">{r.recommendation}</span>
                    {r.dueEstimateLabel && (
                      <span className="block text-xs text-muted-foreground">{r.dueEstimateLabel}</span>
                    )}
                  </li>
                ))}
              </ul>
            </TBCard>
          )}
        </div>
      </Section>
    );
  };

  // ── Layout por finalidade ─────────────────────────────────────
  if (effectivePurpose === "oficina") {
    return (
      <div className={cn("space-y-6", className)}>
        {/* Identificação resumida — foco em horas/km */}
        {show("identification") && s.motorcycle && (
          <Section title="Identificação da moto">
            <TBCard>
              <div className="mb-2 text-lg font-black">
                {s.motorcycle.brand} {s.motorcycle.model}
              </div>
              <Row label="Horas registradas" value={`${s.motorcycle.hoursTotal} h`} />
              <Row label="Quilometragem" value={`${s.motorcycle.kmTotal} km`} />
              <Row label="Placa" value={s.motorcycle.plate} />
              {"nickname" in s.motorcycle && <Row label="Apelido" value={s.motorcycle.nickname} />}
              <Row label="Chassi" value={s.motorcycle.chassisMasked} />
              <Row label="ID TrailBook" value={s.motorcycle.trailbookId} />
            </TBCard>
          </Section>
        )}

        {/* "Posso rodar?" — destaque máximo */}
        {show("summary") && s.rideAnswer && (
          <Section title="Avaliação de uso">
            <RideAnswerBlock />
          </Section>
        )}

        {/* Pendências e próximas intervenções */}
        {show("action_plan") && <PendingItemsBlock />}

        {/* Componentes */}
        {show("components") && s.components && s.components.length > 0 && (
          <Section title={SECTION_LABEL.components}>
            <div className="space-y-2">
              {s.components.map((c) => (
                <ComponentRow key={`${c.name}-${c.category}`} c={c} />
              ))}
            </div>
          </Section>
        )}

        {/* Ressalvas */}
        {show("reservations") && (s.reservations?.length || s.conflicts?.length || s.missingData?.length) ? (
          <Section title={SECTION_LABEL.reservations}>
            <TBCard className="space-y-3">
              {s.reservations && s.reservations.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm">{s.reservations.map((r, i) => <li key={i}>{r}</li>)}</ul>
              )}
              {s.conflicts && s.conflicts.length > 0 && (
                <div>
                  <div className="text-sm font-bold">Conflitos</div>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{s.conflicts.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </div>
              )}
            </TBCard>
          </Section>
        ) : null}

        <Section title="Validade e integridade">
          <TBCard className="space-y-2 text-sm">
            {statusLabel && <Row label="Situação" value={statusLabel} />}
            {s.validity && <Row label="Validade" value={s.validity.label} />}
            {code && <Row label="Código" value={code} />}
            {s.issuedAt && <Row label="Emitido em" value={formatDate(s.issuedAt)} />}
          </TBCard>
        </Section>
      </div>
    );
  }

  if (effectivePurpose === "comercial") {
    return (
      <div className={cn("space-y-6", className)}>
        {/* Identificação completa */}
        {show("identification") && s.motorcycle && (
          <Section title={SECTION_LABEL.identification}>
            <TBCard>
              <div className="mb-2 text-lg font-black">
                {s.motorcycle.brand} {s.motorcycle.model}
              </div>
              {"nickname" in s.motorcycle && <Row label="Apelido" value={s.motorcycle.nickname} />}
              <Row
                label="Ano"
                value={
                  s.motorcycle.yearMake || s.motorcycle.yearModel
                    ? `${s.motorcycle.yearMake ?? "—"}/${s.motorcycle.yearModel ?? "—"}`
                    : null
                }
              />
              <Row label="Placa" value={s.motorcycle.plate} />
              <Row label="Chassi" value={s.motorcycle.chassisMasked} />
              <Row label="Horas" value={`${s.motorcycle.hoursTotal} h`} />
              <Row label="Quilometragem" value={`${s.motorcycle.kmTotal} km`} />
              <Row label="ID TrailBook" value={s.motorcycle.trailbookId} />
            </TBCard>
          </Section>
        )}

        {/* QR Code do cofre de documentos */}
        {"docsQrUrl" in s && (s as Partial<HealthReportSnapshot>).docsQrUrl && (
          <Section title="Documentos da moto">
            <DocsQrBlock url={(s as Partial<HealthReportSnapshot>).docsQrUrl!} />
          </Section>
        )}

        {/* Estado geral — sem "posso rodar" */}
        {show("summary") && s.overall && (
          <Section title="Estado geral da moto">
            <TBCard className="space-y-3">
              <TBStatusPill status={asStatus(s.overall.status)} label={s.overall.statusLabel} />
              <p className="text-sm leading-relaxed">{s.overall.headline}</p>
            </TBCard>
          </Section>
        )}

        {/* Índice de conservação */}
        {show("indices") && s.indices && (
          <Section title={SECTION_LABEL.indices}>
            <TBCard className="space-y-2">
              <EvaluationPill state={stateFromScore(s.indices.conservation)} />
              <p className="text-sm text-muted-foreground">{s.indices.conservationExplanation}</p>
              <p className="text-sm">
                Confiabilidade da avaliação: <strong>{s.indices.confidenceLabel}</strong>
              </p>
            </TBCard>
          </Section>
        )}

        {/* Histórico */}
        {show("history") && s.history && (
          <Section title={SECTION_LABEL.history}>
            <TBCard className="space-y-3">
              {s.history.lastMaintenances?.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {s.history.lastMaintenances.map((m, i) => (
                    <li key={i} className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{formatDate(m.date)}</span> — {"title" in m ? `${m.title} (${m.type})` : m.type}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma manutenção registrada até a emissão.</p>
              )}
              {s.history.incidents?.length > 0 && (
                <div>
                  <div className="text-sm font-bold">Ocorrências</div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {s.history.incidents.map((i, idx) => (
                      <li key={idx}>{formatDate(i.date)} — {"title" in i ? i.title : "Ocorrência registrada"}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Registros na linha do tempo: {s.history.totalEvents}</p>
            </TBCard>
          </Section>
        )}

        {/* Componentes */}
        {show("components") && s.components && s.components.length > 0 && (
          <Section title={SECTION_LABEL.components}>
            <div className="space-y-2">
              {s.components.map((c) => (
                <ComponentRow key={`${c.name}-${c.category}`} c={c} />
              ))}
            </div>
          </Section>
        )}

        {/* Ressalvas */}
        {show("reservations") && (s.reservations?.length || s.conflicts?.length || s.missingData?.length) ? (
          <Section title={SECTION_LABEL.reservations}>
            <TBCard className="space-y-3">
              {s.reservations && s.reservations.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm">{s.reservations.map((r, i) => <li key={i}>{r}</li>)}</ul>
              )}
              {s.missingData && s.missingData.length > 0 && (
                <div>
                  <div className="text-sm font-bold">Dados ausentes</div>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{s.missingData.slice(0, 20).map((c, i) => <li key={i}>{c}</li>)}</ul>
                </div>
              )}
            </TBCard>
          </Section>
        ) : null}

        <Section title="Validade e integridade">
          <TBCard className="space-y-2 text-sm">
            {statusLabel && <Row label="Situação" value={statusLabel} />}
            {s.validity && <Row label="Validade" value={s.validity.label} />}
            {s.validity?.reason && <p className="text-xs text-muted-foreground">{s.validity.reason}</p>}
            {code && <Row label="Código" value={code} />}
            {s.issuedAt && <Row label="Emitido em" value={formatDate(s.issuedAt)} />}
            {sha256 && (
              <p className="flex items-start gap-2 break-all pt-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                SHA-256: {sha256}
              </p>
            )}
          </TBCard>
        </Section>

        {s.disclaimer && (
          <p className="rounded-2xl bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">{s.disclaimer}</p>
        )}
      </div>
    );
  }

  // ── pessoal (padrão) — visão completa ──────────────────────────
  return (
    <div className={cn("space-y-6", className)}>
      {show("identification") && s.motorcycle && (
        <Section title={SECTION_LABEL.identification}>
          <TBCard>
            <div className="mb-2 text-lg font-black">
              {s.motorcycle.brand} {s.motorcycle.model}
            </div>
            {"nickname" in s.motorcycle && <Row label="Apelido" value={s.motorcycle.nickname} />}
            <Row
              label="Ano"
              value={
                s.motorcycle.yearMake || s.motorcycle.yearModel
                  ? `${s.motorcycle.yearMake ?? "—"}/${s.motorcycle.yearModel ?? "—"}`
                  : null
              }
            />
            <Row label="Placa" value={s.motorcycle.plate} />
            <Row label="Chassi" value={s.motorcycle.chassisMasked} />
            <Row label="Horas" value={`${s.motorcycle.hoursTotal} h`} />
            <Row label="Quilometragem" value={`${s.motorcycle.kmTotal} km`} />
            <Row label="ID TrailBook" value={s.motorcycle.trailbookId} />
          </TBCard>
        </Section>
      )}

      {show("summary") && s.overall && (
        <Section title={SECTION_LABEL.summary}>
          <TBCard className="space-y-3">
            <TBStatusPill status={asStatus(s.overall.status)} label={s.overall.statusLabel} />
            <p className="text-sm leading-relaxed">{s.overall.headline}</p>
            {s.rideAnswer && (
              <div className="rounded-xl bg-muted/50 p-3">
                <div className="text-sm font-bold">Posso rodar hoje? {s.rideAnswer.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{s.rideAnswer.message}</p>
                {s.rideAnswer.rationale && (
                  <p className="mt-1 text-xs text-muted-foreground">{s.rideAnswer.rationale}</p>
                )}
              </div>
            )}
            {s.nextMaintenance && (
              <p className="text-sm text-muted-foreground">
                Próxima manutenção: <strong>{s.nextMaintenance.name}</strong> — {s.nextMaintenance.remainingLabel}
              </p>
            )}
          </TBCard>
        </Section>
      )}

      {show("components") && s.components && s.components.length > 0 && (
        <Section title={SECTION_LABEL.components}>
          <div className="space-y-2">
            {s.components.map((c) => (
              <ComponentRow key={`${c.name}-${c.category}`} c={c} />
            ))}
          </div>
        </Section>
      )}

      {show("action_plan") && s.recommendations && s.recommendations.length > 0 && (
        <Section title={SECTION_LABEL.action_plan}>
          <div className="space-y-3">
            {Array.from(new Set(s.recommendations.map((r) => r.groupLabel))).map((group) => (
              <TBCard key={group} className="space-y-2">
                <div className="text-sm font-bold">{group}</div>
                <ul className="space-y-2">
                  {s.recommendations?.filter((r) => r.groupLabel === group)
                    .map((r) => (
                      <li key={r.title} className="text-sm">
                        <span className="font-semibold">{r.title}</span>
                        <span className="block text-muted-foreground">{r.recommendation}</span>
                      </li>
                    ))}
                </ul>
              </TBCard>
            ))}
          </div>
        </Section>
      )}

      {show("history") && s.history && (
        <Section title={SECTION_LABEL.history}>
          <TBCard className="space-y-3">
            {s.history.lastMaintenances?.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {s.history.lastMaintenances?.map((m, i) => (
                  <li key={i} className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatDate(m.date)}</span> — {"title" in m ? `${m.title} (${m.type})` : m.type}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma manutenção registrada até a emissão.</p>
            )}
            {s.history.incidents?.length > 0 && (
              <div>
                <div className="text-sm font-bold">Ocorrências</div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {s.history.incidents?.map((i, idx) => (
                    <li key={idx}>
                      {formatDate(i.date)} — {"title" in i ? i.title : "Ocorrência registrada"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Registros na linha do tempo: {s.history.totalEvents}</p>
          </TBCard>
        </Section>
      )}

      {show("indices") && s.indices && (
        <Section title={SECTION_LABEL.indices}>
          <TBCard className="space-y-2">
            <EvaluationPill state={stateFromScore(s.indices.conservation)} />
            <p className="text-sm text-muted-foreground">{s.indices.conservationExplanation}</p>
            <p className="text-sm">
              Confiabilidade da avaliação: <strong>{s.indices.confidenceLabel}</strong>
            </p>
            <p className="text-sm text-muted-foreground">{s.indices.confidenceExplanation}</p>
          </TBCard>
        </Section>
      )}

      {show("reservations") && (s.reservations?.length || s.conflicts?.length || s.missingData?.length) ? (
        <Section title={SECTION_LABEL.reservations}>
          <TBCard className="space-y-3">
            {s.reservations && s.reservations.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {s.reservations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
            {s.conflicts && s.conflicts.length > 0 && (
              <div>
                <div className="text-sm font-bold">Conflitos</div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {s.conflicts.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            {s.missingData && s.missingData.length > 0 && (
              <div>
                <div className="text-sm font-bold">Dados ausentes</div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {s.missingData.slice(0, 20).map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </TBCard>
        </Section>
      ) : null}

      <Section title="Validade e integridade">
        <TBCard className="space-y-2 text-sm">
          {statusLabel && <Row label="Situação" value={statusLabel} />}
          {s.validity && <Row label="Validade" value={s.validity.label} />}
          {s.validity?.reason && <p className="text-xs text-muted-foreground">{s.validity.reason}</p>}
          {code && <Row label="Código" value={code} />}
          {s.issuedAt && <Row label="Emitido em" value={formatDate(s.issuedAt)} />}
          <Row
            label="Versões"
            value={"tilVersion" in s ? `${s.formatVersion ?? "—"} · ${s.tilVersion ?? "—"} · ${s.ruleVersion ?? "—"}` : s.formatVersion ?? "—"}
          />
          {sha256 && (
            <p className="flex items-start gap-2 break-all pt-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              SHA-256: {sha256}
            </p>
          )}
        </TBCard>
      </Section>

      {s.disclaimer && (
        <p className="rounded-2xl bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">{s.disclaimer}</p>
      )}
    </div>
  );
}