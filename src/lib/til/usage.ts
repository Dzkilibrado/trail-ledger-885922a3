import type { EventRow, Moto, QuickStats } from "./types";

export function computeStats(moto: Pick<Moto, "hours_total" | "km_total">, events: EventRow[]): QuickStats {
  const sorted = [...events].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );
  const last = sorted[0] ?? null;
  const totalCost = events.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  return {
    hoursTotal: Number(moto.hours_total) || 0,
    kmTotal: Number(moto.km_total) || 0,
    lastActivityAt: last?.occurred_at ?? null,
    lastActivityTitle: last?.title ?? null,
    totalCost,
  };
}