import type { ReportSection } from "./types";

export const PRESET_SECTIONS: Record<"buyer" | "workshop" | "custom", ReportSection[]> = {
  buyer: ["identification", "summary", "components", "history", "indices", "action_plan", "reservations"],
  workshop: ["identification", "summary", "components", "action_plan", "history", "reservations"],
  custom: ["identification", "summary"],
};

export const PRESET_LABEL: Record<"buyer" | "workshop" | "custom", string> = {
  buyer: "Comprador",
  workshop: "Oficina",
  custom: "Personalizado",
};

export const PRESET_DESCRIPTION: Record<"buyer" | "workshop" | "custom", string> = {
  buyer: "Visão de avaliação: estado geral, componentes, histórico resumido e ressalvas.",
  workshop: "Visão técnica: diagnóstico, motivos, Plano de Ação e histórico de manutenção.",
  custom: "Você escolhe exatamente quais seções serão exibidas.",
};

/** Dados que nunca são compartilhados, independentemente do preset. */
export const NEVER_SHARED = [
  "CPF e documentos pessoais",
  "Endereço, telefone e e-mail",
  "Valores financeiros detalhados",
  "Notas fiscais e documentos privados",
  "Regras técnicas internas do algoritmo",
  "Dados de outros proprietários",
];