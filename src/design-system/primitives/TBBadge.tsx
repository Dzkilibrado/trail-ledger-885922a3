import { cn } from "@/lib/utils";

export type TBSeverity =
  | "excelente"
  | "boa"
  | "atencao"
  | "critica"
  | "info"
  | "neutro";

const SEVERITY_LABEL: Record<TBSeverity, string> = {
  excelente: "Excelente",
  boa: "Boa",
  atencao: "Atenção",
  critica: "Crítica",
  info: "Info",
  neutro: "—",
};

const SEVERITY_CLASSES: Record<TBSeverity, string> = {
  excelente:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  boa: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/25",
  atencao:
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  critica: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-primary/10 text-primary border-primary/25",
  neutro: "bg-muted text-muted-foreground border-border",
};

export function TBBadge({
  severity,
  children,
  className,
}: {
  severity: TBSeverity;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        SEVERITY_CLASSES[severity],
        className,
      )}
    >
      {children ?? SEVERITY_LABEL[severity]}
    </span>
  );
}