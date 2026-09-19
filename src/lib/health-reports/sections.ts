import type { ReportSection } from "./types";

// Preset fiscal: mínimo necessário para fiscalização de trânsito.
// Princípio do menor privilégio — apenas identificação e status geral.
// identification: placa (mascarada), chassi (mascarado), marca/modelo/ano
// summary: status geral (ok/atenção/necessita ação), validade, próxima manutenção
// Excluído deliberadamente: components, action_plan, history, indices, reservations,
// dados financeiros, fotos, documentos, histórico detalhado, dados pessoais.
export type SharePreset = "buyer" | "workshop" | "custom" | "fiscal";

export const PRESET_SECTIONS: Record<SharePreset, ReportSection[]> = {
  buyer: ["identification", "summary", "components", "history", "indices", "action_plan", "reservations"],
  workshop: ["identification", "summary", "components", "action_plan", "history", "reservations"],
  custom: ["identification", "summary"],
  fiscal: ["identification", "summary"],
};

export const PRESET_LABEL: Record<SharePreset, string> = {
  buyer: "Comprador",
  workshop: "Oficina",
  custom: "Personalizado",
  fiscal: "Fiscalização",
};

export const PRESET_DESCRIPTION: Record<SharePreset, string> = {
  buyer: "Visão de avaliação: estado geral, componentes, histórico resumido e ressalvas.",
  workshop: "Visão técnica: diagnóstico, motivos, Plano de Ação e histórico de manutenção.",
  custom: "Você escolhe exatamente quais seções serão exibidas.",
  fiscal: "Identificação da moto e situação geral — acesso temporário para fiscalização.",
};

// Expiração padrão e opções do preset fiscal (em minutos)
export const FISCAL_EXPIRY_OPTIONS: Array<{ label: string; minutes: number }> = [
  { label: "30 minutos", minutes: 30 },
  { label: "1 hora",     minutes: 60 },
  { label: "6 horas",    minutes: 360 },
  { label: "24 horas",   minutes: 1440 },
];
export const FISCAL_DEFAULT_MINUTES = 60; // 1 hora

/** Dados que nunca são compartilhados, independentemente do preset. */
export const NEVER_SHARED = [
  "CPF e documentos pessoais",
  "Endereço, telefone e e-mail",
  "Valores financeiros detalhados",
  "Notas fiscais e documentos privados",
  "Regras técnicas internas do algoritmo",
  "Dados de outros proprietários",
];