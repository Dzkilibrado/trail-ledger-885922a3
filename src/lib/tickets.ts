export const TICKET_TYPES = [
  { value: "bug", label: "Erro no sistema" },
  { value: "question", label: "Dúvida" },
  { value: "moto", label: "Problema com moto" },
  { value: "certificate", label: "Problema com certificado" },
  { value: "billing", label: "Pagamento / plano" },
  { value: "suggestion", label: "Sugestão de melhoria" },
  { value: "admin_request", label: "Solicitação administrativa" },
  { value: "cpf_change", label: "Alteração de CPF" },
  { value: "other", label: "Outro" },
] as const;

export const TICKET_MODULES = [
  { value: "dashboard", label: "Dashboard" },
  { value: "motorcycle", label: "Moto" },
  { value: "agenda", label: "Agenda" },
  { value: "maintenance", label: "Manutenção" },
  { value: "financial", label: "Financeiro" },
  { value: "certificate", label: "Certificado" },
  { value: "transfer", label: "Transferência" },
  { value: "documentation", label: "Documentação" },
  { value: "workshop", label: "Oficina" },
  { value: "account", label: "Conta / Acesso" },
  { value: "other", label: "Outro" },
] as const;

export const TICKET_PRIORITIES = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
] as const;

export const TICKET_STATUSES = [
  { value: "open", label: "Aberto" },
  { value: "in_analysis", label: "Em análise" },
  { value: "awaiting_user", label: "Aguardando usuário" },
  { value: "in_progress", label: "Em correção" },
  { value: "resolved", label: "Resolvido" },
  { value: "closed", label: "Encerrado" },
  { value: "cancelled", label: "Cancelado" },
] as const;

export function labelFor<T extends { value: string; label: string }>(list: readonly T[], v: string | null | undefined): string {
  if (!v) return "—";
  return list.find((x) => x.value === v)?.label ?? v;
}

import { TONE } from "@/lib/ui/status-styles";

export const PRIORITY_TONE: Record<string, string> = {
  low: TONE.muted,
  medium: TONE.sky,
  high: TONE.amber,
  critical: TONE.destructive,
};

export const STATUS_TONE: Record<string, string> = {
  open: TONE.primary,
  in_analysis: TONE.sky,
  awaiting_user: TONE.amber,
  in_progress: TONE.indigo,
  resolved: TONE.emerald,
  closed: TONE.muted,
  cancelled: TONE.muted,
};