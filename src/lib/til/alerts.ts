import type { ScheduleStatus } from "@/lib/maintenance-engine";
import type { AlertSnapshot } from "./types";

/** Próximo alerta relevante — usado no rodapé enxuto do Cockpit. */
export function computeNextAlert(statuses: ScheduleStatus[]): AlertSnapshot | null {
  const overdue = statuses.find((s) => s.status === "overdue");
  if (overdue) return { label: `${overdue.label} vencida`, tone: "bad" };
  const due = statuses.find((s) => s.status === "due" || s.status === "soon");
  if (due) return { label: `${due.label} próxima`, tone: "warn" };
  return null;
}