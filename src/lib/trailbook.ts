import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Motorcycle = Database["public"]["Tables"]["motorcycles"]["Row"];
export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type EventType = Database["public"]["Enums"]["event_type"];
export type MaintenanceCategory = Database["public"]["Enums"]["maintenance_category"];

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  usage: "Uso",
  maintenance: "Manutenção",
  revision: "Revisão",
  accessory: "Acessório",
  photo: "Foto",
  video: "Vídeo",
  document: "Documento",
  purchase: "Compra",
  sale: "Venda",
  ownership_transfer: "Troca de proprietário",
  recall: "Recall",
  warranty: "Garantia",
  note: "Observação",
  incident: "Sinistro / Ocorrência",
  declaration: "Declaração do proprietário",
};

/**
 * Tipos exibidos no seletor de "Registrar atividade".
 * Excluímos `document`, `photo`, `video` — a partir da v1.0.2 esses conteúdos
 * têm módulos próprios (Documentação da moto e Galeria de fotos).
 * Os enums permanecem no banco para preservar eventos históricos.
 */
export const ACTIVITY_EVENT_TYPES: EventType[] = [
  "usage",
  "maintenance",
  "revision",
  "incident",
  "accessory",
  "warranty",
  "recall",
  "purchase",
  "sale",
  "note",
];

export const MAINT_CATEGORY_LABEL: Record<MaintenanceCategory, string> = {
  engine: "Motor",
  suspension: "Suspensão",
  brakes: "Freios",
  transmission: "Transmissão",
  wheels: "Rodas",
  electrical: "Elétrica",
  cooling: "Arrefecimento",
  other: "Outros",
};

export const BRANDS = [
  "Honda", "Yamaha", "KTM", "GasGas", "Husqvarna",
  "Beta", "Sherco", "Kawasaki", "Suzuki", "Outra",
];

export async function signedUrl(bucket: string, path: string, expires = 3600) {
  if (!path) return null;
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expires);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export function brl(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export async function uploadFile(bucket: string, file: File, userId: string) {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw error;
  return { path, bucket };
}