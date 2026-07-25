/**
 * Catálogo oficial de motivos de encerramento de processos de Compra e Venda.
 * Códigos são estáveis (persistidos no banco) — labels ficam no cliente.
 */

export type CloseRole = "seller" | "buyer" | "admin";
export type ClosureType = "seller_cancelled" | "buyer_declined" | "admin_cancelled";

export interface CloseReason {
  code: string;
  label: string;
}

export const SELLER_REASONS: CloseReason[] = [
  { code: "seller_changed_mind",    label: "Desisti da venda" },
  { code: "buyer_changed_mind",     label: "Comprador desistiu" },
  { code: "buyer_no_response",      label: "Comprador não respondeu" },
  { code: "no_agreement",           label: "Não houve acordo entre as partes" },
  { code: "conditions_changed",     label: "Valor ou condições foram alterados" },
  { code: "incorrect_buyer_data",   label: "Dados do comprador estão incorretos" },
  { code: "incorrect_document",     label: "Documento emitido com informações incorretas" },
  { code: "motorcycle_unavailable", label: "Motocicleta não está mais disponível" },
  { code: "completed_elsewhere",    label: "Venda realizada por outro meio" },
  { code: "created_by_mistake",     label: "Processo criado por engano" },
  { code: "suspected_fraud",        label: "Suspeita de fraude ou irregularidade" },
  { code: "other",                  label: "Outro motivo" },
];

export const BUYER_REASONS: CloseReason[] = [
  { code: "buyer_changed_mind",       label: "Desisti da compra" },
  { code: "conditions_changed",       label: "Não concordo com o valor ou condições" },
  { code: "unrecognized_transaction", label: "Não reconheço esta negociação" },
  { code: "incorrect_motorcycle_data",label: "Dados da motocicleta estão incorretos" },
  { code: "incorrect_seller_data",    label: "Dados do vendedor estão incorretos" },
  { code: "incorrect_document",       label: "Documento contém informações incorretas" },
  { code: "seller_no_response",       label: "Vendedor não respondeu" },
  { code: "completed_elsewhere",      label: "Negociação realizada por outro meio" },
  { code: "created_by_mistake",       label: "Processo recebido por engano" },
  { code: "suspected_fraud",          label: "Suspeita de fraude ou irregularidade" },
  { code: "other",                    label: "Outro motivo" },
];

export const ADMIN_REASONS: CloseReason[] = [
  { code: "administrative_request", label: "Solicitação das partes" },
  { code: "duplicate_process",      label: "Processo duplicado" },
  { code: "created_by_mistake",     label: "Processo criado incorretamente" },
  { code: "inconsistent_data",      label: "Dados inconsistentes" },
  { code: "suspected_fraud",        label: "Suspeita de fraude" },
  { code: "security_violation",     label: "Violação de segurança" },
  { code: "document_irregularity",  label: "Irregularidade documental" },
  { code: "support_request",        label: "Determinação de suporte" },
  { code: "legal_or_admin_order",   label: "Determinação jurídica ou administrativa" },
  { code: "other",                  label: "Outro motivo" },
];

export function reasonsForRole(role: CloseRole): CloseReason[] {
  switch (role) {
    case "seller": return SELLER_REASONS;
    case "buyer":  return BUYER_REASONS;
    case "admin":  return ADMIN_REASONS;
  }
}

export function reasonLabel(role: CloseRole, code: string | null | undefined): string {
  if (!code) return "—";
  const found = reasonsForRole(role).find((r) => r.code === code);
  return found?.label ?? code;
}

/** Label do motivo, tentando descobrir a lista correta a partir do closure_type. */
export function reasonLabelFromClosure(
  closureType: ClosureType | null | undefined,
  code: string | null | undefined,
): string {
  if (!code) return "—";
  const role: CloseRole =
    closureType === "buyer_declined" ? "buyer" :
    closureType === "admin_cancelled" ? "admin" : "seller";
  return reasonLabel(role, code);
}

/** Título curto exibido nos cards / tarja / notificação. */
export function closureTitle(closureType: ClosureType | null | undefined): string {
  switch (closureType) {
    case "seller_cancelled": return "Cancelado pelo vendedor";
    case "buyer_declined":   return "Compra recusada";
    case "admin_cancelled":  return "Cancelado administrativamente";
    default:                 return "Cancelado";
  }
}

/** Texto grande da tarja no visualizador. */
export function closureBannerText(closureType: ClosureType | null | undefined, status?: string | null): string {
  if (status === "revoked")   return "PROCESSO REVOGADO";
  if (status === "superseded") return "PROCESSO SUBSTITUÍDO";
  switch (closureType) {
    case "seller_cancelled": return "PROCESSO CANCELADO";
    case "buyer_declined":   return "COMPRA RECUSADA";
    case "admin_cancelled":  return "CANCELADO ADMINISTRATIVAMENTE";
    default:                 return "PROCESSO ENCERRADO";
  }
}

/** Origem legível para exibição em detalhes. */
export function originLabel(origin: string | null | undefined): string {
  switch (origin) {
    case "central":      return "Central de Transferências";
    case "receipt_view": return "Visualizador do Recibo";
    case "moto_control": return "Centro da Moto";
    case "admin_panel":  return "Administração";
    case "legacy":       return "Fluxo anterior";
    default:             return origin ?? "—";
  }
}

/** Rótulo da ação exposto ao usuário conforme o papel. */
export function closeActionLabel(role: CloseRole): string {
  switch (role) {
    case "seller": return "Cancelar processo";
    case "buyer":  return "Recusar compra";
    case "admin":  return "Cancelar administrativamente";
  }
}