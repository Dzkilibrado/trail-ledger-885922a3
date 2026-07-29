import { ChevronRight, Pin } from "lucide-react";
import type { ComponentView, ComponentTone } from "@/lib/til/components";
import { ComponentIcon } from "./componentIcon";
import { TBStatusDot } from "@/design-system/primitives/TBStatusPill";
import { HEALTH_STATUS_TEXT } from "@/lib/til/status";

const TONE_STYLES: Record<ComponentTone, { text: string; ring: string }> = {
  critical:       { text: "text-destructive",     ring: "ring-destructive/30" },
  attention:      { text: "text-amber-400",       ring: "ring-amber-400/30" },
  ok:             { text: "text-emerald-500",     ring: "ring-emerald-500/20" },
  no_info:        { text: "text-muted-foreground",ring: "ring-border" },
  not_applicable: { text: "text-muted-foreground",ring: "ring-border" },
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
          {component.isCustom && (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
              Personalizado
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs">
          <TBStatusDot status={component.diagnosis.status} className="h-1.5 w-1.5" />
          <span className={HEALTH_STATUS_TEXT[component.diagnosis.status]}>
            {component.diagnosis.statusLabel}
          </span>
          <span className="truncate text-muted-foreground">· {component.statusLabel}</span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}