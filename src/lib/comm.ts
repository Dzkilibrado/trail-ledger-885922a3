export const MESSAGE_TYPES = [
  { value: "system_notice", label: "Aviso do sistema" },
  { value: "support", label: "Suporte" },
  { value: "access", label: "Problema de acesso" },
  { value: "documentation", label: "Documentação" },
  { value: "certificate", label: "Certificado" },
  { value: "maintenance", label: "Manutenção" },
  { value: "financial", label: "Financeiro" },
  { value: "homologation", label: "Homologação" },
  { value: "security", label: "Segurança" },
  { value: "system_update", label: "Atualização do sistema" },
  { value: "other", label: "Outro" },
] as const;

export const MESSAGE_SUBJECTS = [
  { value: "signup_confirmation", label: "Confirmação de cadastro" },
  { value: "password_recovery", label: "Recuperação de acesso" },
  { value: "cpf_duplicate", label: "CPF já cadastrado" },
  { value: "email_not_confirmed", label: "E-mail não confirmado" },
  { value: "account_blocked", label: "Conta bloqueada" },
  { value: "profile_update", label: "Atualização cadastral" },
  { value: "document_pending", label: "Documento pendente" },
  { value: "certificate", label: "Certificado" },
  { value: "ticket", label: "Chamado" },
  { value: "homologation", label: "Homologação" },
  { value: "important_notice", label: "Aviso importante" },
  { value: "other", label: "Outro" },
] as const;

export const MESSAGE_PRIORITIES = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
] as const;

export const MESSAGE_AUDIENCES = [
  { value: "single_user", label: "Usuário específico" },
  { value: "by_status", label: "Usuários por status" },
  { value: "by_role", label: "Usuários por perfil" },
  { value: "homologation_users", label: "Usuários de homologação" },
  { value: "open_tickets", label: "Usuários com chamado aberto" },
  { value: "email_unconfirmed", label: "Usuários com e-mail não confirmado" },
  { value: "blocked_users", label: "Usuários bloqueados" },
  { value: "all_users", label: "Todos os usuários" },
] as const;

export const RECIPIENT_STATUS_LABEL: Record<string, string> = {
  sent: "Não lida",
  read: "Lida",
  replied: "Respondida",
  archived: "Arquivada",
};

// Compat: mantido export para uso já existente nas telas de mensagens.
// A paleta agora vive em `@/lib/ui/status-styles` (Sprint v1.6 — Bloco C).
export { PRIORITY_TONE } from "@/lib/tickets";

export function labelOf<T extends { value: string; label: string }>(list: readonly T[], v?: string | null): string {
  if (!v) return "—";
  return list.find((x) => x.value === v)?.label ?? v;
}