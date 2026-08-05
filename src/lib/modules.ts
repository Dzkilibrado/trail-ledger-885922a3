export type ModuleStatus = "active" | "maintenance" | "disabled" | "beta";

export interface PlatformModule {
  id: string;
  key: string;
  label: string;
  description: string | null;
  status: ModuleStatus;
  maintenance_message: string | null;
  maintenance_until: string | null;
  maintenance_reason: string | null;
  hide_when_disabled: boolean;
  sort_order: number;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export const STATUS_META: Record<ModuleStatus, { label: string; emoji: string; tone: string }> = {
  active: {
    label: "Ativo",
    emoji: "🟢",
    tone: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  maintenance: {
    label: "Em manutenção",
    emoji: "🚧",
    tone: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  disabled: {
    label: "Desabilitado",
    emoji: "🔒",
    tone: "bg-muted text-muted-foreground border-border",
  },
  beta: { label: "Beta", emoji: "🧪", tone: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
};

/**
 * Mapeamento de rotas para módulos, usado para o controle de acesso
 * (ModuleGate) e para decidir quais itens do menu lateral aparecem.
 *
 * Regras específicas (sub-áreas dentro de /motorcycles/$id/...) são
 * verificadas antes do fallback genérico por prefixo — assim dá pra
 * desabilitar só "Check-ups e Laudos", por exemplo, sem desligar a
 * gestão de motos inteira.
 */
export interface RouteModuleRule {
  moduleKey: string;
  /** true se a rota atual pertence a este módulo. */
  test: (pathname: string) => boolean;
}

export const ROUTE_MODULE_RULES: RouteModuleRule[] = [
  { moduleKey: "checkups", test: (p) => /^\/motorcycles\/[^/]+\/checkups(\/|$)/.test(p) },
  { moduleKey: "passport", test: (p) => /^\/motorcycles\/[^/]+\/passport(\/|$)/.test(p) },
  { moduleKey: "moto-control", test: (p) => /^\/motorcycles\/[^/]+\/control(\/|$)/.test(p) },
  { moduleKey: "dashboard", test: (p) => p === "/dashboard" || p.startsWith("/dashboard/") },
  { moduleKey: "motorcycles", test: (p) => p === "/motorcycles" || p.startsWith("/motorcycles/") },
  { moduleKey: "agenda", test: (p) => p === "/agenda" || p.startsWith("/agenda/") },
  { moduleKey: "workshops", test: (p) => p === "/workshops" || p.startsWith("/workshops/") },
  { moduleKey: "financial", test: (p) => p === "/financial" || p.startsWith("/financial/") },
  {
    moduleKey: "certificates",
    test: (p) => p === "/certificates" || p.startsWith("/certificates/"),
  },
  { moduleKey: "transfers", test: (p) => p === "/transfers" || p.startsWith("/transfers/") },
  { moduleKey: "tickets", test: (p) => p === "/tickets" || p.startsWith("/tickets/") },
  { moduleKey: "plans", test: (p) => p === "/plans" || p.startsWith("/plans/") },
];

/** Resolve o módulo responsável por uma rota, ou undefined se nenhuma regra bater (ex: hubs como /central, /comunicacao, /perfil). */
export function resolveRouteModule(pathname: string): string | undefined {
  return ROUTE_MODULE_RULES.find((r) => r.test(pathname))?.moduleKey;
}

/** Chaves de módulo que hoje controlam alguma rota de verdade — usado para avisar no painel admin quando um módulo não está ligado a nada. */
export const LINKED_MODULE_KEYS = new Set(ROUTE_MODULE_RULES.map((r) => r.moduleKey));

/** Mantido para o menu lateral, que usa apenas os itens de nível principal. */
export const ROUTE_TO_MODULE: Record<string, string> = {
  "/dashboard": "dashboard",
  "/motorcycles": "motorcycles",
  "/agenda": "agenda",
  "/workshops": "workshops",
  "/financial": "financial",
  "/certificates": "certificates",
  "/transfers": "transfers",
  "/tickets": "tickets",
  "/plans": "plans",
};

/** Hub routes that group multiple modules — não são de um módulo só, então ficam de fora do gate. */
export const HUB_ROUTES = new Set<string>(["/central", "/comunicacao", "/perfil"]);
