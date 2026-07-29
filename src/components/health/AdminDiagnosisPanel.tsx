import { useState } from "react";
import { Wrench } from "lucide-react";
import { TBStatusPill } from "@/design-system/primitives/TBStatusPill";
import { TBFilterBar } from "@/design-system/filters/TBFilterBar";
import { TBFilterChip } from "@/design-system/filters/TBFilterChip";
import type { ComponentView } from "@/lib/til/components";
import { CONFIDENCE_SHORT, type ConfidenceLevel } from "@/lib/til/confidence";
import { DIAGNOSIS_RULE_VERSION } from "@/lib/til/messages";

type Filter = "all" | "action" | "attention" | "unknown" | "low_confidence" | "conflict";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "action", label: "Vermelhos" },
  { key: "attention", label: "Amarelos" },
  { key: "unknown", label: "Sem dados" },
  { key: "low_confidence", label: "Baixa confiabilidade" },
  { key: "conflict", label: "Inconsistentes" },
];

/**
 * Painel técnico de validação — SOMENTE Admin.
 * Leitura pura da TIL: entradas, regras acionadas, pontuação interna e versão.
 * Não permite alteração manual do resultado.
 */
export function AdminDiagnosisPanel({ components }: { components: ComponentView[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const rows = components.filter((c) => {
    const d = c.diagnosis;
    switch (filter) {
      case "action": return d.status === "action";
      case "attention": return d.status === "attention";
      case "unknown": return d.status === "unknown";
      case "low_confidence": return d.confidence.level === "low" || d.confidence.level === "not_evaluable";
      case "conflict": return d.hasConflict;
      default: return true;
    }
  });

  return (
    <section aria-label="Validação técnica do diagnóstico" className="rounded-2xl border border-dashed border-border bg-card/60 p-4">
      <header className="flex items-center gap-2">
        <Wrench className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold">Validação técnica (Admin)</h2>
        <span className="ml-auto text-[11px] text-muted-foreground">Regra {DIAGNOSIS_RULE_VERSION}</span>
      </header>
      <p className="mt-1 text-xs text-muted-foreground">
        Visualização somente leitura. Nenhuma alteração manual do resultado é permitida aqui.
      </p>

      <TBFilterBar className="mt-3">
        {FILTERS.map((f) => (
          <TBFilterChip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </TBFilterChip>
        ))}
      </TBFilterBar>

      <div className="mt-3 space-y-2">
        {rows.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Nenhum componente neste filtro.
          </p>
        )}
        {rows.map((c) => {
          const d = c.diagnosis;
          return (
            <details key={c.scheduleId} className="rounded-xl border border-border bg-card p-3">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{c.name}</span>
                <TBStatusPill status={d.status} label={d.statusTitle} size="sm" />
                <span className="text-xs text-muted-foreground">
                  interno: {d.internalScore ?? "—"} · conf.: {CONFIDENCE_SHORT[d.confidence.level as ConfidenceLevel]}
                </span>
              </summary>
              <dl className="mt-2 space-y-1 text-xs">
                <Row label="Categoria" value={c.categoryLabel} />
                <Row label="Severidade" value={c.severity} />
                <Row label="Status bruto" value={c.rawStatus} />
                <Row label="Regras acionadas" value={d.rulesFired.join(", ") || "—"} />
                <Row label="Motivos" value={d.reasons.join(" | ")} />
                <Row label="Prioridade" value={d.isSafetyItem ? "Segurança" : "Padrão"} />
                <Row label="Divergências" value={d.hasConflict ? "Dados conflitantes" : "Nenhuma"} />
                <Row label="Entradas" value={d.facts.map((f) => `${f.key}=${f.value ?? "null"}`).join(", ")} />
                <Row label="Versão da regra" value={d.ruleVersion} />
                <Row label="Último processamento" value={new Date(d.computedAt).toLocaleString("pt-BR")} />
              </dl>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
