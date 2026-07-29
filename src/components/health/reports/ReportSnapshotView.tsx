import { useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { TBCard, TBStatusPill } from "@/design-system";
import { SECTION_LABEL, type HealthReportSnapshot, type ReportSection } from "@/lib/health-reports/types";
import type { HealthStatus } from "@/lib/til/status";
import { formatDate } from "@/lib/trailbook";
import { cn } from "@/lib/utils";

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

function ComponentRow({ c }: { c: HealthReportSnapshot["components"][number] }) {
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
 * Renderização oficial do Laudo — SEMPRE a partir do snapshot emitido.
 * Nunca recalcula nada e nunca busca dados atuais.
 */
export function ReportSnapshotView({
  snapshot: s,
  sections,
  code,
  sha256,
  statusLabel,
  className,
}: {
  snapshot: Partial<HealthReportSnapshot>;
  sections?: ReportSection[];
  code?: string;
  sha256?: string;
  statusLabel?: string;
  className?: string;
}) {
  const show = (sec: ReportSection) => (sections ? sections.includes(sec) : true);

  return (
    <div className={cn("space-y-6", className)}>
      {show("identification") && s.motorcycle && (
        <Section title={SECTION_LABEL.identification}>
          <TBCard>
            <div className="mb-2 text-lg font-black">
              {s.motorcycle.brand} {s.motorcycle.model}
            </div>
            <Row label="Apelido" value={s.motorcycle.nickname} />
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
              <ComponentRow key={`${c.name}-${c.scheduleId}`} c={c} />
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
                  {s.recommendations!
                    .filter((r) => r.groupLabel === group)
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
            {s.history.lastMaintenances.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {s.history.lastMaintenances.map((m, i) => (
                  <li key={i} className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatDate(m.date)}</span> — {m.title} ({m.type})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma manutenção registrada até a emissão.</p>
            )}
            {s.history.incidents.length > 0 && (
              <div>
                <div className="text-sm font-bold">Ocorrências</div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {s.history.incidents.map((i, idx) => (
                    <li key={idx}>
                      {formatDate(i.date)} — {i.title}
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
            <div className="text-3xl font-black">{s.indices.conservation}</div>
            <p className="text-sm text-muted-foreground">{s.indices.conservationExplanation}</p>
            <p className="text-sm">
              Confiabilidade: <strong>{s.indices.confidenceLabel}</strong>
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
            value={`${s.formatVersion ?? "—"} · ${s.tilVersion ?? "—"} · ${s.ruleVersion ?? "—"}`}
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