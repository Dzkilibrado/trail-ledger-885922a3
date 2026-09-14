import type { MaintenanceCategory } from "@/lib/trailbook";

export type ItemKind = "technical" | "labor" | "expense";

export interface MaintenanceItem {
  localId: string;
  scheduleId?: string;
  templateItemId?: string;
  category: MaintenanceCategory;
  service: string;
  itemKind: ItemKind;
  product?: string;
  brand?: string;
  qty?: number;
  unitValue?: number;
  /** Valor total da linha — preenchido quando o documento informa explicitamente.
   *  Nunca calculado automaticamente a partir de qty × unitValue. */
  totalValue?: number;
}
