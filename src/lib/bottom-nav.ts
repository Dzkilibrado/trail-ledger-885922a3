import {
  Home,
  Bike,
  FolderOpen,
  MessageCircle,
  User,
  Wallet,
  CalendarDays,
  Wrench,
  ArrowRightLeft,
  LifeBuoy,
  QrCode,
  CreditCard,
  type LucideIcon,
} from "lucide-react";

/**
 * Catálogo de destinos que o usuário pode escolher para a barra de
 * navegação inferior (mobile). Só rotas de nível superior, que não
 * dependem de uma moto específica — diferente do catálogo de atalhos
 * da tela inicial (home-shortcuts.ts).
 */
export type BottomNavKey =
  | "dashboard"
  | "motorcycles"
  | "central"
  | "comunicacao"
  | "perfil"
  | "financial"
  | "agenda"
  | "workshops"
  | "transfers"
  | "tickets"
  | "certificates"
  | "plans";

export interface BottomNavDef {
  key: BottomNavKey;
  label: string;
  description: string;
  icon: LucideIcon;
  to: string;
}

export const BOTTOM_NAV_CATALOG: BottomNavDef[] = [
  {
    key: "dashboard",
    label: "Início",
    description: "Painel principal",
    icon: Home,
    to: "/dashboard",
  },
  {
    key: "motorcycles",
    label: "Minhas Motos",
    description: "Sua garagem",
    icon: Bike,
    to: "/motorcycles",
  },
  {
    key: "central",
    label: "Central",
    description: "Notificações, mensagens e mais",
    icon: FolderOpen,
    to: "/central",
  },
  {
    key: "comunicacao",
    label: "Comunicação",
    description: "Conversas e avisos",
    icon: MessageCircle,
    to: "/comunicacao",
  },
  { key: "perfil", label: "Perfil", description: "Sua conta", icon: User, to: "/perfil" },
  {
    key: "financial",
    label: "Financeiro",
    description: "Custos e gastos das motos",
    icon: Wallet,
    to: "/financial",
  },
  {
    key: "agenda",
    label: "Agenda",
    description: "Compromissos e lembretes",
    icon: CalendarDays,
    to: "/agenda",
  },
  {
    key: "workshops",
    label: "Oficinas",
    description: "Oficinas parceiras",
    icon: Wrench,
    to: "/workshops",
  },
  {
    key: "transfers",
    label: "Transferências",
    description: "Compra, venda e transferência",
    icon: ArrowRightLeft,
    to: "/transfers",
  },
  {
    key: "tickets",
    label: "Chamados",
    description: "Solicitações de suporte",
    icon: LifeBuoy,
    to: "/tickets",
  },
  {
    key: "certificates",
    label: "Certificados",
    description: "Certificados digitais emitidos",
    icon: QrCode,
    to: "/certificates",
  },
  { key: "plans", label: "Planos", description: "Sua assinatura", icon: CreditCard, to: "/plans" },
];

export const BOTTOM_NAV_BY_KEY: Record<BottomNavKey, BottomNavDef> = Object.fromEntries(
  BOTTOM_NAV_CATALOG.map((d) => [d.key, d]),
) as Record<BottomNavKey, BottomNavDef>;

/** Ordem e seleção padrão — igual ao menu ☰ de hoje. */
export const DEFAULT_BOTTOM_NAV: BottomNavKey[] = [
  "dashboard",
  "motorcycles",
  "central",
  "comunicacao",
  "perfil",
];

/** Barra de navegação: espaço físico é limitado, então 3 a 5 itens. */
export const MIN_BOTTOM_NAV_ITEMS = 3;
export const MAX_BOTTOM_NAV_ITEMS = 5;

export function resolveBottomNav(keys: string[] | null | undefined): BottomNavDef[] {
  const source = keys && keys.length > 0 ? keys : DEFAULT_BOTTOM_NAV;
  const resolved = source
    .map((k) => BOTTOM_NAV_BY_KEY[k as BottomNavKey])
    .filter((d): d is BottomNavDef => !!d);
  return resolved.length >= MIN_BOTTOM_NAV_ITEMS
    ? resolved
    : DEFAULT_BOTTOM_NAV.map((k) => BOTTOM_NAV_BY_KEY[k]);
}
