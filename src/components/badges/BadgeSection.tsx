import { Award, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { BadgeChip } from "./BadgeChip";
import { BadgeGrid } from "./BadgeGrid";
import { useMotorcycleBadges } from "@/hooks/useMotorcycleBadges";
import { cn } from "@/lib/utils";
import { HelpTooltip } from "@/components/HelpTooltip";
import { HELP } from "@/lib/help/texts";
import { SectionBoundary } from "@/components/SectionBoundary";

/**
 * Bloco reutilizável "Selos de Qualidade do Histórico".
 * Modo compacto (default): mostra chips ganhos + "ver todos" que expande a grade.
 * Modo full: sempre exibe a grade completa (usado no Passaporte).
 */
export function BadgeSection({
  motorcycleId,
  variant = "compact",
  className,
}: {
  motorcycleId: string;
  variant?: "compact" | "full";
  className?: string;
}) {
  return (
    <SectionBoundary title="Não foi possível carregar os selos">
      <BadgeSectionContent
        motorcycleId={motorcycleId}
        variant={variant}
        className={className}
      />
    </SectionBoundary>
  );
}

function BadgeSectionContent({
  motorcycleId,
  variant = "compact",
  className,
}: {
  motorcycleId: string;
  variant?: "compact" | "full";
  className?: string;
}) {
  const { summary, isLoading } = useMotorcycleBadges(motorcycleId);

  if (isLoading || !summary) {
    return (
      <section className={cn("surface-elevated rounded-2xl p-4", className)}>
        <div className="h-6 w-40 animate-pulse rounded-md bg-muted" />
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 w-24 animate-pulse rounded-full bg-muted" />
          ))}
        </div>
      </section>
    );
  }

  const isFull = variant === "full";

  const earnedCount = summary.earned.length;
  const totalCount = summary.all.length;
  const progressPct = totalCount === 0 ? 0 : Math.round((earnedCount / totalCount) * 100);

  return (
    <section className={cn("surface-elevated rounded-2xl p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <Award className="h-4 w-4 shrink-0 text-primary" />
        <h3 className="font-display text-sm font-bold uppercase tracking-widest">
          Selos de Qualidade
        </h3>
        <HelpTooltip label="Selos de Qualidade" text={HELP.badges} />
      </div>

      {variant === "compact" && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span aria-hidden>🏅</span>
            <span className="font-semibold">
              <span className="text-primary">{earnedCount}</span>
              <span className="text-muted-foreground"> de {totalCount}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              {earnedCount === 1 ? "selo conquistado" : "selos conquistados"}
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={earnedCount}
            aria-valuemin={0}
            aria-valuemax={totalCount}
            aria-label={`${earnedCount} de ${totalCount} selos conquistados`}
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {isFull ? (
        <BadgeGrid evaluations={summary.all} />
      ) : (
        <>
          {earnedCount === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum selo conquistado ainda. Complete a documentação e a manutenção para começar.
            </p>
          ) : (
            <div className="mb-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Selos conquistados
              </div>
              <div className="flex flex-wrap gap-1.5">
                {summary.earned.map((ev) => (
                  <BadgeChip key={ev.definition.id} evaluation={ev} label="full" />
                ))}
              </div>
            </div>
          )}
          <Link
            to="/motorcycles/$id/passport"
            params={{ id: motorcycleId }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-accent/40 active:bg-accent/60"
          >
            Ver todos os selos
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </>
      )}

      <p className="mt-3 text-[10px] text-muted-foreground">
        Selos são conquistados automaticamente conforme evidências reais do sistema — nunca por ação manual.
      </p>
    </section>
  );
}

/**
 * Utilitário: renderiza apenas um chip específico pelo ID (para casos como
 * "mostrar apenas o selo Origem Comprovada no header da Central de Documentos").
 */
export function SingleBadgeChip({
  motorcycleId,
  badgeId,
  size = "md",
}: {
  motorcycleId: string;
  badgeId: string;
  size?: "sm" | "md";
}) {
  const { summary } = useMotorcycleBadges(motorcycleId);
  if (!summary) return null;
  const ev = summary.all.find((e) => e.definition.id === badgeId);
  if (!ev || ev.state !== "earned") return null;
  return <BadgeChip evaluation={ev} size={size} />;
}