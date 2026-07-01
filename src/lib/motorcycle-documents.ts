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
