import { Activity, Wrench, Camera, Video, FileText, ShoppingCart, Tag, RefreshCw, AlertTriangle, Shield, StickyNote, Plus, Bike, ShieldAlert, FileCheck2 } from "lucide-react";
import type { EventType } from "@/lib/trailbook";
import { cn } from "@/lib/utils";

const MAP: Record<EventType, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  usage: { icon: Activity, tone: "text-primary bg-primary/15" },
  maintenance: { icon: Wrench, tone: "text-warning bg-warning/15" },
  revision: { icon: RefreshCw, tone: "text-success bg-success/15" },
  accessory: { icon: Plus, tone: "text-chart-3 bg-chart-3/15" },
  photo: { icon: Camera, tone: "text-foreground bg-elevated" },
  video: { icon: Video, tone: "text-foreground bg-elevated" },
  document: { icon: FileText, tone: "text-foreground bg-elevated" },
  purchase: { icon: ShoppingCart, tone: "text-success bg-success/15" },
  sale: { icon: Tag, tone: "text-destructive bg-destructive/15" },
  ownership_transfer: { icon: Bike, tone: "text-foreground bg-elevated" },
  recall: { icon: AlertTriangle, tone: "text-destructive bg-destructive/15" },
  warranty: { icon: Shield, tone: "text-success bg-success/15" },
  note: { icon: StickyNote, tone: "text-muted-foreground bg-elevated" },
  incident: { icon: ShieldAlert, tone: "text-destructive bg-destructive/15" },
  declaration: { icon: FileCheck2, tone: "text-primary bg-primary/15" },
};

export function EventTypeIcon({ type, className }: { type: EventType; className?: string }) {
  const { icon: Icon, tone } = MAP[type];
  return (
    <div className={cn("grid h-10 w-10 place-items-center rounded-xl", tone, className)}>
      <Icon className="h-5 w-5" />
    </div>
  );
}