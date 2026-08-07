import {
  Award,
  FileSignature,
  FolderOpen,
  Heart,
  Plus,
  Share2,
  ShieldCheck,
  Stethoscope,
  Wrench,
  Wallet,
  CalendarDays,
  QrCode,
  type LucideIcon,
} from "lucide-react";

/**
 * Catálogo de atalhos que o usuário pode escolher para a tela inicial.
 *
 * Por padrão `to` é relativo à moto ativa (usa params={{ id }} na Link).
 * Atalhos que apontam para uma seção global (não depende de moto) marcam
 * `needsMoto: false` — o Dashboard não injeta o parâmetro de moto nesses.
 */
export type HomeShortcutKey =
  | "passaporte"
  | "documentos"
  | "recibo"
  | "selos"
  | "saude"
  | "manutencoes"
  | "cockpit"
  | "checkups"
  | "central-moto"
  | "registrar-atividade"
  | "financeiro"
  | "agenda"
  | "oficinas"
  | "certificados";

export interface HomeShortcutDef {
  key: HomeShortcutKey;
  label: string;
  description: string;
  icon: LucideIcon;
  to: string;
  /** Parâmetros de busca opcionais — ex: abrir um formulário direto na tela de destino. */
  search?: Record<string, string>;
  /** false = seção global, não depende de uma moto específica. Padrão: true. */
  needsMoto?: boolean;
}

export const HOME_SHORTCUT_CATALOG: HomeShortcutDef[] = [
  {
    key: "cockpit",
    label: "Cockpit",
    description: "Visão geral da moto",
    icon: FolderOpen,
    to: "/motorcycles/$id",
  },
  {
    key: "central-moto",
    label: "Central da moto",
    description: "Documentos, recibos e ações da moto",
    icon: ShieldCheck,
    to: "/motorcycles/$id/control",
  },
  {
    key: "registrar-atividade",
    label: "Registrar atividade",
    description: "Manutenção, sinistro, acessório e outros eventos",
    icon: Plus,
    to: "/motorcycles/$id/control",
    search: { action: "registrar" },
  },
  {
    key: "checkups",
    label: "Check-ups e Laudos",
    description: "Histórico de check-ups e laudos emitidos",
    icon: Stethoscope,
    to: "/motorcycles/$id/checkups",
  },
  {
    key: "saude",
    label: "Saúde",
    description: "Estado geral de conservação",
    icon: Heart,
    to: "/motorcycles/$id/health",
  },
  {
    key: "manutencoes",
    label: "Manutenções",
    description: "Plano de manutenção da moto",
    icon: Wrench,
    to: "/motorcycles/$id/plan",
  },
  {
    key: "passaporte",
    label: "Passaporte",
    description: "Compartilhar histórico com terceiros",
    icon: Share2,
    to: "/motorcycles/$id/passport",
  },
  {
    key: "selos",
    label: "Selos",
    description: "Selos e conquistas da moto",
    icon: Award,
    to: "/motorcycles/$id/passport",
  },
  {
    key: "documentos",
    label: "Documentos",
    description: "Documentação da motocicleta",
    icon: ShieldCheck,
    to: "/motorcycles/$id/control",
    search: { tab: "documentos" },
  },
  {
    key: "recibo",
    label: "Recibo",
    description: "Emitir recibo/comprovante",
    icon: FileSignature,
    to: "/motorcycles/$id/control",
    search: { tab: "documentos" },
  },
  {
    key: "financeiro",
    label: "Financeiro",
    description: "Custos e gastos de todas as motos",
    icon: Wallet,
    to: "/financial",
    needsMoto: false,
  },
  {
    key: "agenda",
    label: "Agenda",
    description: "Compromissos e lembretes",
    icon: CalendarDays,
    to: "/agenda",
    needsMoto: false,
  },
  {
    key: "oficinas",
    label: "Oficinas",
    description: "Oficinas parceiras e de confiança",
    icon: Wrench,
    to: "/workshops",
    needsMoto: false,
  },
  {
    key: "certificados",
    label: "Certificados",
    description: "Certificados digitais emitidos",
    icon: QrCode,
    to: "/certificates",
    needsMoto: false,
  },
];

export const HOME_SHORTCUT_BY_KEY: Record<string, HomeShortcutDef> = Object.fromEntries(
  HOME_SHORTCUT_CATALOG.map((s) => [s.key, s]),
);

/** Conjunto padrão para quem nunca personalizou (mantém o comportamento atual). */
export const DEFAULT_HOME_SHORTCUTS: HomeShortcutKey[] = [
  "passaporte",
  "documentos",
  "recibo",
  "selos",
  "saude",
  "manutencoes",
  "cockpit",
];

// 9 preenche perfeitamente 3 linhas completas no grid de 3 colunas (mobile),
// evitando um espaço vago sobrando na última linha (ex: com 8, sobra 1 vazio).
export const MAX_HOME_SHORTCUTS = 9;

/** Resolve as chaves salvas do usuário para definições válidas, ignorando chaves desconhecidas. */
export function resolveHomeShortcuts(keys: string[] | null | undefined): HomeShortcutDef[] {
  const source = keys && keys.length > 0 ? keys : DEFAULT_HOME_SHORTCUTS;
  return source.map((k) => HOME_SHORTCUT_BY_KEY[k]).filter((s): s is HomeShortcutDef => !!s);
}
