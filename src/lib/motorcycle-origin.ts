/**
 * Módulo de Propriedade e Documentação — catálogo da origem da moto.
 * Mantido isolado para reutilização entre wizard, banners e passport.
 */

export type OriginType =
  | "zero_km"
  | "private"
  | "dealer"
  | "trailbook_transfer"
  | "other";

export type ExpectedDocKind =
  | "invoice"
  | "invoice_or_bill_of_sale"
  | "bill_of_sale"
  | "any"
  | "origin_undefined";

export const ORIGIN_OPTIONS: {
  value: OriginType;
  label: string;
  short: string;
  emoji: string;
  description: string;
  expected: ExpectedDocKind;
}[] = [
  {
    value: "zero_km",
    label: "Moto Zero Quilômetro",
    short: "Zero km",
    emoji: "🆕",
    description: "Comprada nova, direto da concessionária. Documento esperado: Nota Fiscal.",
    expected: "invoice",
  },
  {
    value: "private",
    label: "Compra de Pessoa Física",
    short: "Particular",
    emoji: "🤝",
    description: "Comprada de outro proprietário. Documento esperado: Nota Fiscal ou Recibo de Compra e Venda.",
    expected: "invoice_or_bill_of_sale",
  },
  {
    value: "dealer",
    label: "Compra em Loja",
    short: "Loja",
    emoji: "🏬",
    description: "Comprada em loja / revenda. Documento esperado: Nota Fiscal ou Recibo.",
    expected: "invoice_or_bill_of_sale",
  },
  {
    value: "trailbook_transfer",
    label: "Compra entre Usuários TrailBook",
    short: "Transferência TB",
    emoji: "🔁",
    description: "Recebida via transferência dentro do TrailBook. Recibo Inteligente é gerado automaticamente.",
    expected: "bill_of_sale",
  },
  {
    value: "other",
    label: "Outro",
    short: "Outra origem",
    emoji: "📄",
    description: "Herança, doação, permuta ou outro. Descreva nas observações.",
    expected: "any",
  },
];

export const ORIGIN_LABEL: Record<OriginType, string> = Object.fromEntries(
  ORIGIN_OPTIONS.map((o) => [o.value, o.label]),
) as Record<OriginType, string>;

export const EXPECTED_DOC_LABEL: Record<ExpectedDocKind, string> = {
  invoice: "Nota Fiscal",
  invoice_or_bill_of_sale: "Nota Fiscal ou Recibo de Compra e Venda",
  bill_of_sale: "Recibo de Compra e Venda",
  any: "Documento comprobatório",
  origin_undefined: "Origem ainda não informada",
};

export function findOrigin(value?: string | null) {
  if (!value) return null;
  return ORIGIN_OPTIONS.find((o) => o.value === value) ?? null;
}