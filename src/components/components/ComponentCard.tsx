import { ChevronRight, Pin } from "lucide-react";
import type { ComponentView, ComponentTone } from "@/lib/til/components";
import { ComponentIcon } from "./componentIcon";

const TONE_STYLES: Record<ComponentTone, { dot: string; text: string; ring: string }> = {
  critical:       { dot: "bg-destructive",     text: "text-destructive",     ring: "ring-destructive/30" },
  attention:      { dot: "bg-amber-400",       text: "text-amber-400",       ring: "ring-amber-400/30" },
  ok:             { dot: "bg-emerald-500",     text: "text-emerald-500",     ring: "ring-emerald-500/20" },
  no_info:        { dot: "bg-muted-foreground",text: "text-muted-foreground",ring: "ring-border" },
  not_applicable: { dot: "bg-muted",           text: "text-muted-foreground",ring: "ring-border" },
};

export function ComponentCard({
  component,
  onOpen,
}: {
  component: ComponentView;
  onOpen: (id: string) => void;
}) {
  const t = TONE_STYLES[component.tone];
  const dim = component.tone === "not_applicable";
  return (
    <button
      type="button"
      onClick={() => onOpen(component.scheduleId)}
      className={`surface-elevated flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:border-primary/40 active:scale-[0.99] ${dim ? "opacity-60" : ""}`}
    >
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-card ring-1 ${t.ring}`}>
        <ComponentIcon category={component.category} className={`h-5 w-5 ${t.text}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {component.pinned && <Pin className="h-3 w-3 text-primary" aria-label="Fixado" />}
          <div className="truncate font-medium">{component.name}</div>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${t.dot}`} />
          <span className={t.text}>{component.statusLabel}</span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}