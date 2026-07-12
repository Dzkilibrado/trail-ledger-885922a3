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

// Cache leve em memória para URLs assinadas.
// Motivo (Sprint v1.6 — Bloco B): a mesma foto de moto aparece em várias telas
// (Início, lista de motos, cockpit, saúde, plano). Sem cache, cada montagem
// refazia a chamada de storage e produzia flicker + placeholder cinza. O cache
// deduplica requisições em vôo e reaproveita a URL enquanto ainda é válida.
// Nunca guarda mais tempo do que o próprio TTL do signed URL, com margem de
// segurança de 5 minutos para evitar expiração no meio de uma navegação.
type SignedEntry = { url: string; expiresAt: number };
const signedCache = new Map<string, SignedEntry>();
const signedInflight = new Map<string, Promise<string | null>>();

export function getCachedSignedUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null;
  const hit = signedCache.get(`${bucket}::${path}`);
  if (hit && hit.expiresAt > Date.now()) return hit.url;
  return null;
}

export async function signedUrl(bucket: string, path: string, expires = 3600) {
  if (!path) return null;
  const key = `${bucket}::${path}`;
  const cached = signedCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const inflight = signedInflight.get(key);
  if (inflight) return inflight;
  const p = (async () => {
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expires);
      if (error) return null;
      const url = data?.signedUrl ?? null;
      if (url) {
        // Margem de 5 min antes do vencimento real do token.
        const ttlMs = Math.max(60, expires - 300) * 1000;
        signedCache.set(key, { url, expiresAt: Date.now() + ttlMs });
      }
      return url;
    } catch {
      return null;
    } finally {
      signedInflight.delete(key);
    }
  })();
  signedInflight.set(key, p);
  return p;
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