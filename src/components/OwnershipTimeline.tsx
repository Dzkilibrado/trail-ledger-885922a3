import { Crown, ArrowRightLeft, Download } from "lucide-react";
import { formatDate } from "@/lib/trailbook";

type Entry = {
  id: string;
  started_at: string;
  ended_at: string | null;
  method: "creation" | "transfer" | "import";
  owner_name?: string | null;
};

const ICON = { creation: Crown, transfer: ArrowRightLeft, import: Download } as const;
const LABEL = { creation: "Proprietário inicial", transfer: "Transferido", import: "Importado" } as const;

export function OwnershipTimeline({ entries, anonymize = false }: { entries: Entry[]; anonymize?: boolean }) {
  if (entries.length === 0) {
    return <div className="surface-elevated rounded-2xl p-6 text-center text-sm text-muted-foreground">Sem histórico de proprietários.</div>;
  }
  return (
    <ol className="relative space-y-3 border-l border-border pl-6">
      {entries.map((e, i) => {
        const Icon = ICON[e.method] ?? Crown;
        const current = !e.ended_at;
        return (
          <li key={e.id} className="relative">
            <span className={`absolute -left-[34px] top-2 grid h-6 w-6 place-items-center rounded-full ring-4 ring-background ${current ? "bg-primary text-primary-foreground" : "bg-elevated text-muted-foreground"}`}>
              <Icon className="h-3 w-3" />
            </span>
            <div className="surface-elevated rounded-2xl p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-semibold">
                  {anonymize ? `Proprietário #${i + 1}` : (e.owner_name || "Proprietário")}
                  {current && <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-400">Atual</span>}
                </div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{LABEL[e.method]}</div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatDate(e.started_at)} — {e.ended_at ? formatDate(e.ended_at) : "presente"}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}