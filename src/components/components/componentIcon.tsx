import type { MaintenanceCategory } from "@/lib/trailbook";
import {
  Cog, Zap, CircleDot, GitCommitVertical, Snowflake, Disc, Waves, Wrench, type LucideIcon,
} from "lucide-react";

const MAP: Record<MaintenanceCategory, LucideIcon> = {
  engine: Cog,
  suspension: Waves,
  brakes: Disc,
  transmission: GitCommitVertical,
  wheels: CircleDot,
  electrical: Zap,
  cooling: Snowflake,
  other: Wrench,
};

export function ComponentIcon({ category, className }: { category: MaintenanceCategory; className?: string }) {
  const Icon = MAP[category] ?? Wrench;
  return <Icon className={className} aria-hidden />;
}