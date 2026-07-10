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

export const PRIORITY_TONE: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  high: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

export const STATUS_TONE: Record<string, string> = {
  open: "bg-primary/15 text-primary border-primary/30",
  in_analysis: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  awaiting_user: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  in_progress: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  resolved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  closed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-muted text-muted-foreground border-border",
};