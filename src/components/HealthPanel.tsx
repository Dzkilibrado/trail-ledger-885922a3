import type { CategoryHealth } from "@/lib/conservation";
import { cn } from "@/lib/utils";
import { Cog, Disc, Gauge, Settings, Zap, Snowflake, FileText, Clock, CircleDot } from "lucide-react";

const ICONS: Record<string, any> = {
  engine: Cog,
  suspension: Gauge,
  brakes: Disc,
  transmission: Settings,
  wheels: CircleDot,
  electrical: Zap,
  cooling: Snowflake,
  documentation: FileText,
  history: Clock,
};

export function HealthPanel({ items }: { items: CategoryHealth[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => {
        const Icon = ICONS[it.category] ?? Cog;
        const color =
          it.status === "good" ? "text-emerald-400 bg-emerald-400/10" :
          it.status === "warn" ? "text-amber-400 bg-amber-400/10" :
          "text-destructive bg-destructive/10";
        return (
          <div key={it.category} className="surface-elevated rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className={cn("grid h-9 w-9 place-items-center rounded-xl", color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="font-display text-xl font-bold">{it.score}</div>
            </div>
            <div className="mt-3 text-sm font-semibold">{it.label}</div>
            <div className="text-xs text-muted-foreground">{it.reason}</div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full transition-all", it.status === "good" ? "bg-emerald-400" : it.status === "warn" ? "bg-amber-400" : "bg-destructive")}
                style={{ width: `${it.score}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}