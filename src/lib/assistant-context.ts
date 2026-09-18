// ============================================================
// Assistant Context — contexto de navegação para o Assistente
// Ponto único de parsing de pathname. Não espalhar em componentes.
// ============================================================

import { useRouterState } from "@tanstack/react-router";

export interface AssistantContext {
  pathname: string;
  motorcycleId: string | null;
  moduleKey: string;
}

// UUID v4 pattern — não aceita slugs genéricos
const UUID_RE = /\/motorcycles\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i;

export function inferModuleKey(path: string): string {
  if (path.includes("/registrar-manutencao")) return "maintenance";
  if (path.includes("/plan"))                 return "maintenance";
  if (path.includes("/historico"))            return "maintenance";
  if (path.includes("/passport"))             return "passport";
  if (path.includes("/health"))               return "health";
  if (path.includes("/certificate"))          return "certificate";
  if (path.includes("/control"))              return "fiscal";
  if (path.includes("/financial"))            return "financial";
  if (path.includes("/agenda"))               return "agenda";
  if (path.includes("/workshops"))            return "workshops";
  if (path.includes("/tickets"))              return "support";
  if (path.includes("/dashboard"))            return "dashboard";
  if (path.includes("/motorcycles"))          return "motorcycle";
  if (path.includes("/perfil"))               return "profile";
  if (path.includes("/faq"))                  return "general";
  return "general";
}

export function useAssistantContext(): AssistantContext {
  const { location } = useRouterState();
  const pathname = location.pathname;
  const match = UUID_RE.exec(pathname);
  const motorcycleId = match?.[1] ?? null;
  return { pathname, motorcycleId, moduleKey: inferModuleKey(pathname) };
}
