// ============================================================
// assistant-module-map.ts
// Mapeamento explícito: article.module_key → platform_module key
//
// Por que existe:
//   Os artigos da KB usam module_key semântico (ex: "fiscal")
//   Os platform_modules usam keys históricos do sistema (ex: "moto-control")
//   Os dois não são iguais — este mapa conecta os dois mundos.
//
// Regra:
//   Se article.module_key está no mapa → verificar status do platform_module
//   Se não está no mapa (null ou não mapeado) → sempre elegível
//   Status elegível: "active" | "beta"
//   Status inelegível: "disabled" | "maintenance"
// ============================================================

import type { ModuleStatus } from "@/lib/modules";

/**
 * Mapeamento artigo.module_key → platform_module.key
 * Apenas inclui os que possuem um gate real na plataforma.
 * module_keys sem gate (profile, maintenance, general) ficam de fora → sempre elegíveis.
 */
export const ARTICLE_MODULE_MAP: Record<string, string> = {
  fiscal:         "fiscalizacao",  // artigo modo-fiscalizacao (archived) — módulo próprio
  fiscalizacao:   "fiscalizacao",  // artigo fiscalizacao-laudo — módulo fiscalizacao
  health:         "checkups",      // Avaliações, Check-ups e Laudos
  passport:       "passport",      // Passaporte Digital
  certificate:    "certificates",  // Selos e Certificados
  motorcycle:     "motorcycles",   // Gestão de motos
  support:        "tickets",       // Chamados de suporte
  agenda:         "agenda",        // Agenda de manutenção → platform_module 'agenda'
  workshop:       "workshops",     // Oficinas → platform_module 'workshops' (active)
  financial:      "financial",     // Financeiro
  // maintenance, profile: sem gate único → sempre elegíveis (não listados aqui)
  // historico-manutencao usa module_key 'maintenance' (sem gate próprio → sempre elegível)
};

/** Statuses que permitem promover o conteúdo como disponível */
export const ELIGIBLE_STATUSES: ModuleStatus[] = ["active", "beta"];

/** Verifica se um article.module_key está elegível dado o mapa de status de módulos */
export function isModuleEligible(
  articleModuleKey: string | null,
  moduleStatuses: Record<string, ModuleStatus>,
): boolean {
  if (!articleModuleKey) return true;  // sem module_key → sempre elegível
  const platformKey = ARTICLE_MODULE_MAP[articleModuleKey];
  if (!platformKey) return true;       // não mapeado → sem gate → elegível
  const status = moduleStatuses[platformKey];
  if (!status) return true;            // módulo não encontrado no banco → não bloquear silenciosamente
  return ELIGIBLE_STATUSES.includes(status);
}

/** Retorna o status do módulo correspondente a um article.module_key, ou null se não há gate */
export function getArticleModuleStatus(
  articleModuleKey: string | null,
  moduleStatuses: Record<string, ModuleStatus>,
): ModuleStatus | null {
  if (!articleModuleKey) return null;
  const platformKey = ARTICLE_MODULE_MAP[articleModuleKey];
  if (!platformKey) return null;
  return moduleStatuses[platformKey] ?? null;
}
