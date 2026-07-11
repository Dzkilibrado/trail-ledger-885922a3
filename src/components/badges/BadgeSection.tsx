import { Award, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { BadgeChip } from "./BadgeChip";
import { BadgeGrid } from "./BadgeGrid";
import { useMotorcycleBadges } from "@/hooks/useMotorcycleBadges";
import { cn } from "@/lib/utils";

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

  return (
    <section className={cn("surface-elevated rounded-2xl p-4", className)}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-bold uppercase tracking-widest">
            Selos de Qualidade
          </h3>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            {summary.earned.length} de {summary.all.length}
          </span>
        </div>
        {variant === "compact" && (
          <Link
            to="/motorcycles/$id/passport"
            params={{ id: motorcycleId }}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
          >
            Ver todos os selos
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {isFull ? (
        <BadgeGrid evaluations={summary.all} />
      ) : summary.earned.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum selo conquistado ainda. Complete a documentação e a manutenção para começar.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {summary.earned.map((ev) => (
            <BadgeChip key={ev.definition.id} evaluation={ev} />
          ))}
        </div>
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