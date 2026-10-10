import type { Database } from "@/integrations/supabase/types";
export const USAGE_GUIDANCE: Database["public"]["Tables"]["help_articles"]["Row"] = {
  id: "trailbook-registrar-uso", slug: "registrar-uso", title: "Como registrar o uso da moto?",
  summary: "No Início, toque em Registrar Uso e informe a leitura total acumulada do horímetro ou da quilometragem da moto ativa, a data e, se desejar, o local.",
  body_md: "Informe a leitura total acumulada, não apenas o uso do dia: de 10 para 13 horas, a nova leitura será 13 horas. A unidade vem do cadastro da moto. O local é opcional. Datas futuras e leituras iguais ou menores são recusadas. Uma data retroativa deve ser igual ou posterior à última atividade com uso registrado, preservando o histórico. Se o cadastro tiver duas unidades ou nenhuma, defina uma única unidade antes de usar este atalho. Após salvar, o histórico, as leituras e o acompanhamento das manutenções são atualizados. Você pode remover, reorganizar ou adicionar novamente Registrar Uso em Personalizar; sua escolha será mantida nas próximas sessões.",
  context_tags: ["home","cockpit"], cta_label: "Ir ao Início", route_template: "/dashboard", module_key: null,
  needs_motorcycle: false, sort_order: 0, status: "published", created_at: "2026-10-10T04:10:00Z", updated_at: "2026-10-10T04:10:00Z", updated_by: null,
};
export function withUsageGuidance<T extends { slug?: string }>(articles: T[]): (T | typeof USAGE_GUIDANCE)[] {
  return [USAGE_GUIDANCE, ...articles.filter(article => article.slug !== USAGE_GUIDANCE.slug)];
}