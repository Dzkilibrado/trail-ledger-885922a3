/**
 * Catálogo de marcas, modelos, cilindradas e tipos para o formulário de cadastro.
 * Mantenha "Outros" como última opção em cada lista — quando selecionado, o
 * formulário libera input livre.
 */

export const OTHER = "__other__";

export const MODELS_BY_BRAND: Record<string, string[]> = {
  Honda: [
    "CRF 230F", "CRF 250F", "CRF 250R", "CRF 250RX", "CRF 300L", "CRF 300L Rally",
    "CRF 450R", "CRF 450RX", "CRF 450X", "XR 250 Tornado", "XR 150L", "XR 200R",
  ],
  Yamaha: [
    "WR 250F", "WR 450F", "YZ 125", "YZ 250", "YZ 250F", "YZ 450F",
    "Lander 250", "Tenere 250", "TT-R 230",
  ],
  KTM: [
    "150 EXC", "250 EXC", "300 EXC", "250 EXC-F", "350 EXC-F", "450 EXC-F", "500 EXC-F",
    "250 SX", "350 SX-F", "450 SX-F", "Freeride 250F",
  ],
  GasGas: [
    "EC 250", "EC 300", "EC 250F", "EC 350F", "EC 450F",
    "MC 250F", "MC 350F", "MC 450F",
  ],
  Husqvarna: [
    "TE 150", "TE 250", "TE 300", "FE 250", "FE 350", "FE 450", "FE 501",
    "TX 300", "FX 350", "FX 450",
  ],
  Beta: ["RR 200", "RR 250", "RR 300", "RR 350", "RR 390", "RR 430", "RR 480", "Xtrainer 300"],
  Sherco: ["SE 250", "SE 300", "SEF 250", "SEF 300", "SEF 450"],
  Kawasaki: ["KLX 230", "KLX 300", "KX 250", "KX 450"],
  Suzuki: ["DR 200", "DR-Z 400"],
  Outra: [],
};

export const DISPLACEMENTS = [
  "125", "150", "200", "230", "250", "300", "350", "400", "450", "500", "501",
];

export const MOTO_TYPES = [
  { value: "trail_light", label: "Trilha leve" },
  { value: "enduro", label: "Enduro" },
  { value: "cross", label: "MotoCross" },
  { value: "rally", label: "Rally" },
  { value: "adventure", label: "Adventure" },
  { value: "trail_2t", label: "Trilha 2 tempos" },
] as const;

export const CONTROL_TYPES = [
  { value: "hours", label: "Horímetro" },
  { value: "km", label: "Hodômetro (km)" },
  { value: "both", label: "Ambos" },
] as const;

/** Lista decrescente: do ano vigente +1 até 1990. */
export function yearOptions(): number[] {
  const max = new Date().getFullYear() + 1;
  const out: number[] = [];
  for (let y = max; y >= 1990; y--) out.push(y);
  return out;
}

export const INCIDENT_TYPES = [
  { value: "minor_fall", label: "Queda leve" },
  { value: "major_fall", label: "Queda grave" },
  { value: "crash", label: "Acidente / Batida" },
  { value: "submersion", label: "Submersão" },
  { value: "engine_damage", label: "Danos no motor" },
  { value: "frame_damage", label: "Danos no chassi" },
  { value: "structural", label: "Quebra estrutural" },
  { value: "theft_recovered", label: "Roubo/furto recuperado" },
  { value: "other", label: "Outro" },
] as const;

export const INCIDENT_DECLARATION_TEXT =
  "Declaro que, até onde tenho conhecimento, esta motocicleta não possui histórico de sinistro relevante. " +
  "Estou ciente de que esta informação poderá compor o histórico da moto e impactar sua certificação.";

// ============================================================
// Catálogo Mestre (Fase 1) — hooks que consultam as tabelas
// motorcycle_brands / _types_ref / _models / _model_engines /
// _model_years / _model_defaults. Leitura pública (RLS anon).
// ============================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CatalogBrand = { id: string; name: string; sort_order: number };
export type CatalogType = { code: string; label: string; sort_order: number };
export type CatalogModel = { id: string; brand_id: string; type_code: string; name: string };
export type CatalogControl = "hours" | "km" | "both";

export function useCatalogBrands() {
  return useQuery({
    queryKey: ["catalog", "brands"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorcycle_brands")
        .select("id,name,sort_order")
        .eq("active", true)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as CatalogBrand[];
    },
  });
}

export function useCatalogTypes() {
  return useQuery({
    queryKey: ["catalog", "types"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorcycle_types_ref")
        .select("code,label,sort_order")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as CatalogType[];
    },
  });
}

export function useCatalogModels(brandId: string | null, typeCode: string | null) {
  return useQuery({
    queryKey: ["catalog", "models", brandId, typeCode],
    enabled: !!brandId && !!typeCode,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorcycle_models")
        .select("id,brand_id,type_code,name")
        .eq("brand_id", brandId!)
        .eq("type_code", typeCode!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as CatalogModel[];
    },
  });
}

export function useCatalogEngines(modelId: string | null) {
  return useQuery({
    queryKey: ["catalog", "engines", modelId],
    enabled: !!modelId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorcycle_model_engines")
        .select("displacement")
        .eq("model_id", modelId!)
        .eq("active", true)
        .order("displacement");
      if (error) throw error;
      return (data ?? []).map((r: any) => r.displacement as number);
    },
  });
}

export function useCatalogModelDefaults(modelId: string | null) {
  return useQuery({
    queryKey: ["catalog", "defaults", modelId],
    enabled: !!modelId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorcycle_model_defaults")
        .select("suggested_control_type,notes")
        .eq("model_id", modelId!)
        .maybeSingle();
      if (error) throw error;
      return data as { suggested_control_type: CatalogControl | null; notes: string | null } | null;
    },
  });
}