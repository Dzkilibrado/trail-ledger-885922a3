import type { MaintenanceCategory } from "./trailbook";

/**
 * Catálogo extensível de regras de manutenção.
 * Para adicionar novos serviços, basta acrescentar entradas neste array —
 * nenhuma alteração de código de UI é necessária.
 *
 * O motor de regras (maintenance-engine.ts) aplica sempre o "primeiro limite atingido"
 * entre horas, km e dias.
 */
export type Severity = "critical" | "high" | "medium" | "low";

export interface MaintenancePreset {
  key: string;                 // identificador estável
  name: string;                // ex: "Troca de óleo do motor"
  category: MaintenanceCategory;
  severity: Severity;          // impacto no índice de conservação
  interval_hours?: number;
  interval_km?: number;
  interval_days?: number;
  appliesTo?: { brand?: string; family?: "trail4t" | "trail2t" | "any" }; // futuro: filtros
  description?: string;
}

export const MAINTENANCE_PRESETS: MaintenancePreset[] = [
  // Motor
  { key: "oil_engine",      name: "Troca de óleo do motor", category: "engine", severity: "critical", interval_hours: 15,  interval_days: 90,  description: "Óleo + filtro segundo manual da fabricante." },
  { key: "oil_filter",      name: "Troca do filtro de óleo", category: "engine", severity: "high",     interval_hours: 30,  interval_days: 180 },
  { key: "air_filter",      name: "Limpeza/troca do filtro de ar", category: "engine", severity: "high", interval_hours: 5, interval_days: 30 },
  { key: "valve_clearance", name: "Regulagem de válvulas",   category: "engine", severity: "high",     interval_hours: 60,  interval_days: 365 },
  { key: "piston",          name: "Troca de pistão/anéis",   category: "engine", severity: "critical", interval_hours: 120 },
  { key: "spark_plug",      name: "Troca da vela",           category: "engine", severity: "medium",   interval_hours: 30,  interval_days: 180 },

  // Transmissão
  { key: "chain_lube",      name: "Lubrificação da corrente", category: "transmission", severity: "medium",  interval_hours: 3,  interval_days: 14 },
  { key: "chain_kit",       name: "Troca de kit relação",     category: "transmission", severity: "high",    interval_hours: 80, interval_km: 5000 },
  { key: "clutch_oil",      name: "Troca do óleo da embreagem", category: "transmission", severity: "medium", interval_hours: 30, interval_days: 180 },
  { key: "clutch_plates",   name: "Troca dos discos da embreagem", category: "transmission", severity: "high", interval_hours: 100 },

  // Suspensão
  { key: "fork_oil",        name: "Revisão do óleo do garfo dianteiro", category: "suspension", severity: "high", interval_hours: 40, interval_days: 365 },
  { key: "rear_shock",      name: "Revisão do amortecedor traseiro",     category: "suspension", severity: "high", interval_hours: 60, interval_days: 365 },

  // Freios
  { key: "brake_pads_f",    name: "Pastilhas de freio dianteiras", category: "brakes", severity: "critical", interval_hours: 30 },
  { key: "brake_pads_r",    name: "Pastilhas de freio traseiras",  category: "brakes", severity: "critical", interval_hours: 40 },
  { key: "brake_fluid",     name: "Troca do fluido de freio",      category: "brakes", severity: "high",     interval_days: 365 },

  // Rodas
  { key: "tire_front",      name: "Troca do pneu dianteiro", category: "wheels", severity: "high",   interval_hours: 60 },
  { key: "tire_rear",       name: "Troca do pneu traseiro",  category: "wheels", severity: "high",   interval_hours: 40 },
  { key: "wheel_bearings",  name: "Rolamentos de roda",      category: "wheels", severity: "medium", interval_hours: 100 },
  { key: "spokes_tension",  name: "Aperto dos raios",        category: "wheels", severity: "medium", interval_hours: 10, interval_days: 60 },

  // Arrefecimento
  { key: "coolant",         name: "Troca do líquido de arrefecimento", category: "cooling", severity: "high", interval_days: 730 },

  // Elétrica
  { key: "battery_check",   name: "Inspeção da bateria",     category: "electrical", severity: "medium", interval_days: 90 },
];

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function presetsByCategory(category: MaintenanceCategory) {
  return MAINTENANCE_PRESETS.filter((p) => p.category === category);
}