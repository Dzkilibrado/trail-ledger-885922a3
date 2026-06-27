import type { ConservationResult } from "@/lib/conservation";
import { TrendingUp, TrendingDown } from "lucide-react";

export function ConservationCard({ result }: { result: ConservationResult }) {
  const ring =
    result.grade === "A" ? "ring-emerald-400/40 text-emerald-400" :
    result.grade === "B" ? "ring-primary/40 text-primary" :
    result.grade === "C" ? "ring-amber-400/40 text-amber-400" :
    "ring-destructive/40 text-destructive";
  return (
    <div className="surface-elevated rounded-2xl p-5">
      <div className="flex items-center gap-5">
        <div className={`grid h-20 w-20 place-items-center rounded-full bg-background ring-4 ${ring}`}>
          <div className="text-center">
            <div className="font-display text-2xl font-bold leading-none">{result.score}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Nota {result.grade}</div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-bold">Índice de conservação</div>
          <p className="text-xs text-muted-foreground">Atualizado a partir do histórico, manutenções e documentação.</p>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5">
        {result.factors.map((f) => (
          <li key={f.key} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              {f.delta >= 0
                ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
              <span>{f.label}</span>
              {f.detail && <span className="text-xs text-muted-foreground">· {f.detail}</span>}
            </div>
            <span className={f.delta >= 0 ? "text-emerald-400" : "text-destructive"}>
              {f.delta >= 0 ? `+${f.delta}` : f.delta}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}