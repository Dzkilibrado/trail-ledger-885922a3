/**
 * Catálogo de tipos de documentos permanentes da motocicleta.
 * "invoice" (Nota Fiscal) é obrigatório na v1.0; os demais preparam a
 * arquitetura para novos tipos sem refatoração.
 */
export const DOC_TYPES = [
  { value: "invoice", label: "Nota Fiscal de Compra", icon: "🧾" },
  { value: "manual", label: "Manual do Proprietário", icon: "📘" },
  { value: "warranty", label: "Certificado de Garantia", icon: "🛡️" },
  { value: "import", label: "Documento de Importação", icon: "🌍" },
  { value: "contract", label: "Contrato", icon: "📝" },
  { value: "other", label: "Outro documento", icon: "📄" },
] as const;

export type DocType = (typeof DOC_TYPES)[number]["value"];

export const DOC_TYPE_LABEL: Record<DocType, string> = Object.fromEntries(
  DOC_TYPES.map((d) => [d.value, d.label]),
) as Record<DocType, string>;

export const DOC_TYPE_ICON: Record<DocType, string> = Object.fromEntries(
  DOC_TYPES.map((d) => [d.value, d.icon]),
) as Record<DocType, string>;

/** Tamanho máximo permitido por arquivo (25 MB). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Tipos MIME aceitos no upload. */
export const ACCEPTED_MIME = [
  "application/pdf",
  "image/png", "image/jpeg", "image/webp", "image/heic",
];

/** Documentos "recomendados" para compor o índice de completude. */
export const RECOMMENDED_DOC_TYPES: DocType[] = ["invoice", "manual", "warranty", "import"];

export function formatBytes(n?: number | null) {
  if (!n || n <= 0) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

export async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
