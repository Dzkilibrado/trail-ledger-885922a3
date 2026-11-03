import {
  Award,
  ClipboardList,
  FileSignature,
  FolderOpen,
  Heart,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  Stethoscope,
  Wrench,
  Wallet,
  CalendarDays,
  QrCode,
  Gauge,
  LayoutDashboard,
  Package,
  Bike,
  MapPin,
  LifeBuoy,
  CreditCard,
  FileText,
  Activity,
  Zap,
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
  // Moto — ações rápidas
  | "registrar-uso"
  | "registrar-atividade"
  | "registrar-manutencao"
  // Moto — navegação
  | "cockpit"
  | "painel-moto"
  | "central-moto"
  | "central-revisao"
  | "historico-manutencao"
  | "checkups"
  | "saude"
  | "manutencoes"
  | "passaporte"
  | "passaporte-qr"
  | "selos"
  | "documentos"
  | "recibo"
  | "pecas"
  // Global
  | "financeiro"
  | "agenda"
  | "oficinas"
  | "certificados"
  | "suporte"
  | "assinatura";

export interface HomeShortcutDef {
  key: HomeShortcutKey;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Categoria para agrupamento no gestor. */
  group: "acao" | "moto" | "global";
  to: string;
  /** Parâmetros de busca opcionais — ex: abrir um formulário direto na tela de destino. */
  search?: Record<string, string>;
  /** false = seção global, não depende de uma moto específica. Padrão: true. */
  needsMoto?: boolean;
}

export const HOME_SHORTCUT_CATALOG: HomeShortcutDef[] = [
  // ── Ações rápidas ──────────────────────────────────────────
  {
    key: "registrar-uso",
    label: "Registrar Uso",
    description: "Leitura acumulada do horímetro ou da quilometragem",
    icon: Gauge,
    group: "acao",
    to: "/dashboard",
  },
  {
    key: "registrar-atividade",
    label: "Registrar Atividade",
    description: "Sinistro, acessório, garantia, nota e outros eventos",
    icon: Plus,
    group: "acao",
    to: "/motorcycles/$id/control",
    search: { action: "registrar" },
  },
  {
    key: "registrar-manutencao",
    label: "Registrar Manutenção",
    description: "Novo fluxo: busca, catálogo, mapa visual e leitura de NF",
    icon: Wrench,
    group: "acao",
    to: "/motorcycles/$id/registrar-manutencao",
  },

  // ── Moto ───────────────────────────────────────────────────
  {
    key: "painel-moto",
    label: "Painel de Manutenção",
    description: "Saúde, próximas revisões e índice de conservação",
    icon: LayoutDashboard,
    group: "moto",
    to: "/motorcycles/$id/control",
    search: { tab: "geral" },
  },
  {
    key: "cockpit",
    label: "Cockpit",
    description: "Visão geral completa da moto ativa",
    icon: Bike,
    group: "moto",
    to: "/motorcycles/$id",
  },
  {
    key: "central-revisao",
    label: "Lançamentos",
    description: "Editar ou excluir lançamentos: uso, manutenção, sinistro e mais",
    icon: ClipboardList,
    group: "moto",
    to: "/motorcycles/$id/control",
    search: { tab: "atividade" },
  },
  {
    key: "historico-manutencao",
    label: "Histórico",
    description: "Consultar, editar e excluir manutenções registradas",
    icon: Search,
    group: "moto",
    to: "/motorcycles/$id/historico-manutencao",
  },
  {
    key: "checkups",
    label: "Check-up",
    description: "Histórico de check-ups e laudos emitidos",
    icon: Stethoscope,
    group: "moto",
    to: "/motorcycles/$id/checkups",
  },
  {
    key: "saude",
    label: "Saúde",
    description: "Estado geral de conservação da moto",
    icon: Heart,
    group: "moto",
    to: "/motorcycles/$id/health",
  },
  {
    key: "manutencoes",
    label: "Manutenções",
    description: "Plano de manutenção e próximas revisões programadas",
    icon: Activity,
    group: "moto",
    to: "/motorcycles/$id/plan",
  },
  {
    key: "pecas",
    label: "Peças",
    description: "Componentes instalados e histórico de substituição",
    icon: Package,
    group: "moto",
    to: "/motorcycles/$id/components",
  },
  {
    key: "passaporte",
    label: "Passaporte",
    description: "Compartilhar histórico verificável com terceiros",
    icon: Share2,
    group: "moto",
    to: "/motorcycles/$id/passport",
  },
  {
    key: "passaporte-qr",
    label: "QR Passaporte",
    description: "Exibir QR Code do passaporte para leitura imediata",
    icon: QrCode,
    group: "moto",
    to: "/motorcycles/$id/passport",
    search: { view: "qr" },
  },
  {
    key: "selos",
    label: "Selos",
    description: "Selos e conquistas da moto",
    icon: Award,
    group: "moto",
    to: "/motorcycles/$id/passport",
  },
  {
    key: "documentos",
    label: "Documentos",
    description: "Cofre de documentos: CRLV, laudos e arquivos",
    icon: ShieldCheck,
    group: "moto",
    to: "/motorcycles/$id/control",
    search: { tab: "documentos" },
  },
  {
    key: "recibo",
    label: "Recibo",
    description: "Emitir recibo de compra e venda",
    icon: FileSignature,
    group: "moto",
    to: "/motorcycles/$id/control",
    search: { tab: "documentos" },
  },
  {
    key: "central-moto",
    label: "Central da Moto",
    description: "Documentos, recibos e ações administrativas da moto",
    icon: FolderOpen,
    group: "moto",
    to: "/motorcycles/$id/control",
  },

  // ── Global (não depende de moto) ───────────────────────────
  {
    key: "financeiro",
    label: "Financeiro",
    description: "Custos e gastos de todas as motos",
    icon: Wallet,
    group: "global",
    to: "/financial",
    needsMoto: false,
  },
  {
    key: "agenda",
    label: "Agenda",
    description: "Compromissos, vistorias e lembretes",
    icon: CalendarDays,
    group: "global",
    to: "/agenda",
    needsMoto: false,
  },
  {
    key: "oficinas",
    label: "Oficinas",
    description: "Oficinas parceiras e credenciadas no mapa",
    icon: MapPin,
    group: "global",
    to: "/workshops",
    needsMoto: false,
  },
  {
    key: "certificados",
    label: "Certificados",
    description: "Certificados digitais emitidos",
    icon: FileText,
    group: "global",
    to: "/certificates",
    needsMoto: false,
  },
  {
    key: "suporte",
    label: "Suporte",
    description: "Abrir chamado ou consultar central de ajuda",
    icon: LifeBuoy,
    group: "global",
    to: "/tickets",
    needsMoto: false,
  },
  {
    key: "assinatura",
    label: "Minha Assinatura",
    description: "Seu plano e histórico de pagamentos",
    icon: CreditCard,
    group: "global",
    to: "/assinatura",
    needsMoto: false,
  },
];

export const HOME_SHORTCUT_BY_KEY: Record<string, HomeShortcutDef> = Object.fromEntries(
  HOME_SHORTCUT_CATALOG.map((s) => [s.key, s]),
);

/** Quantidades válidas de atalhos — múltiplos de 3 entre 3 e 15. */
export const SHORTCUT_COUNT_OPTIONS = [3, 6, 9, 12, 15] as const;
export type ShortcutCountOption = (typeof SHORTCUT_COUNT_OPTIONS)[number];

/** Quantidade máxima absoluta de atalhos. */
export const MAX_HOME_SHORTCUTS: ShortcutCountOption = 15;

/** Conjunto padrão para quem nunca personalizou (mantém o comportamento atual). */
export const DEFAULT_HOME_SHORTCUTS: HomeShortcutKey[] = [
  "registrar-uso",
  "painel-moto",
  "checkups",
  "pecas",
  "central-revisao",
  "documentos",
];

/**
 * Chaves fixas do sistema — sempre nas posições 0 e 1, independente do que o banco retornar.
 * Duplicado aqui para que a tela inicial (useHomeShortcuts) também os enforçe sem precisar
 * importar a constante de perfil.atalhos.tsx.
 */
export const SYSTEM_FIXED_SHORTCUTS: HomeShortcutKey[] = ["registrar-uso", "painel-moto"];

/**
 * Garante que os atalhos fixos do sistema estejam sempre nas primeiras posições.
 * Remove duplicatas e reinjeta os fixos no início, preservando o restante na ordem original.
 */
export function enforceSystemFixedShortcuts(keys: HomeShortcutKey[]): HomeShortcutKey[] {
  const rest = keys.filter((k) => !SYSTEM_FIXED_SHORTCUTS.includes(k));
  return [...SYSTEM_FIXED_SHORTCUTS, ...rest];
}

/** Resolve as chaves salvas do usuário para definições válidas, ignorando chaves desconhecidas.
 *  Sempre garante os atalhos fixos do sistema nas primeiras posições. */
export function resolveHomeShortcuts(keys: string[] | null | undefined): HomeShortcutDef[] {
  const raw = (keys ?? DEFAULT_HOME_SHORTCUTS) as HomeShortcutKey[];
  const source = enforceSystemFixedShortcuts(raw.filter((k) => !!HOME_SHORTCUT_BY_KEY[k]));
  return source.map((k) => HOME_SHORTCUT_BY_KEY[k]).filter((s): s is HomeShortcutDef => !!s);
}

/** Rótulos dos grupos para exibição no gestor. */
export const GROUP_LABELS: Record<HomeShortcutDef["group"], string> = {
  acao: "⚡ Ações Rápidas",
  moto: "🏍️ Minha Moto",
  global: "🌐 Global",
};
