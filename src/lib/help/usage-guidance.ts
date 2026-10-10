import type { Database } from "@/integrations/supabase/types";
export const USAGE_GUIDANCE: Database["public"]["Tables"]["help_articles"]["Row"] = {
  id: "trailbook-registrar-uso", slug: "registrar-uso", title: "Como registrar o uso da moto?",
  summary: "No Início, toque em Registrar Uso e informe as horas utilizadas ou quilômetros percorridos na moto ativa, a data e, se desejar, o local.",
  body_md: "Informe somente o uso adicional: uma moto com 10 horas recebe mais 1,5 hora e passa a 11,5 horas. O resumo mostra o total atual e o total previsto. A unidade vem do cadastro da moto e o local é opcional. Valores zero, negativos e datas futuras são recusados. Uma data retroativa deve ser igual ou posterior à última atividade com uso registrado, preservando o histórico. Se o cadastro tiver duas unidades ou nenhuma, defina uma única unidade antes de usar este atalho. Após salvar, histórico, totais, manutenções e alertas são atualizados. Os campos de leitura acumulada dos outros registros continuam funcionando como antes. Você pode remover ou reorganizar Registrar Uso em Personalizar; sua escolha será mantida nas próximas sessões.",
  context_tags: ["home","cockpit"], cta_label: "Ir ao Início", route_template: "/dashboard", module_key: null,
  needs_motorcycle: false, sort_order: 0, status: "published", created_at: "2026-10-10T04:10:00Z", updated_at: "2026-10-10T04:10:00Z", updated_by: null,
};
export function withUsageGuidance<T extends { slug?: string }>(articles: T[]): (T | typeof USAGE_GUIDANCE)[] {
  return [USAGE_GUIDANCE, ...articles.filter(article => article.slug !== USAGE_GUIDANCE.slug)];
}