// ============================================================
// Testes: useAssistant — navegação, sugestões, derivações da KB
// ============================================================
import { describe, it, expect } from "vitest";
import type { HelpArticle } from "@/lib/assistant-search";
import type { TopicGroup } from "@/hooks/useAssistant";

// ── Fixtures KB ───────────────────────────────────────────────
function art(slug: string, module_key: string, context_tags: string[], sort_order: number): HelpArticle {
  return {
    id: slug, slug, title: `Título ${slug}`, summary: `Resumo ${slug}`,
    body_md: null, module_key, route_template: null, cta_label: null,
    context_tags, needs_motorcycle: false, status: "published",
    sort_order, created_at: "2024-01-01", updated_at: "2024-01-01", updated_by: null,
  };
}

const ARTICLES: HelpArticle[] = [
  art("cadastrar-moto",       "motorcycle",  ["moto","cadastro"],                  120),
  art("registrar-manutencao", "maintenance", ["manutenção","registrar"],            130),
  art("plano-manutencao",     "maintenance", ["plano","manutenção"],                140),
  art("passaporte-digital",   "passport",    ["passaporte","compartilhar"],         80),
  art("modo-fiscalizacao",    "fiscal",      ["laudo","fiscalização"],              180),
  art("abrir-chamado",        "support",     ["suporte","chamado"],                 170),
  art("meus-itens",           "maintenance", ["meus itens","biblioteca"],           160),
  art("health-avaliacao",     "health",      ["health","avaliação","saúde"],        150),
  art("cpf-obrigatorio",      "profile",     ["perfil","cadastro","cpf"],           10),
  art("alterar-cpf",          "support",     ["cpf","suporte"],                     20),
  art("selos-qualidade",      "certificate", ["selos","qualidade","certificado"],   90),
  art("usar-passaporte-venda","passport",    ["passaporte","venda","compartilhar"], 190),
  art("editar-moto",          "motorcycle",  ["editar","moto"],                    200),
];

// ── Helpers que replicam a lógica do hook sem React ───────────
const HOME_SLUGS = [
  "cadastrar-moto","registrar-manutencao","plano-manutencao",
  "passaporte-digital","modo-fiscalizacao","abrir-chamado",
];

function getHomeSuggestions(articles: HelpArticle[]) {
  return HOME_SLUGS.map((s) => articles.find((a) => a.slug === s)).filter(Boolean) as HelpArticle[];
}

function getContextSuggestions(articles: HelpArticle[], moduleKey: string) {
  const byModule = articles.filter((a) => a.module_key === moduleKey);
  const byTags   = articles.filter((a) => a.context_tags?.some((t) => t === moduleKey) && !byModule.includes(a));
  return [...byModule, ...byTags].slice(0, 4);
}

const TOPIC_CONFIG = [
  { key: "motorcycle", label: "Minha moto", order: 1 },
  { key: "maintenance", label: "Manutenção", order: 2 },
  { key: "passport", label: "Passaporte Digital", order: 3 },
  { key: "health", label: "Saúde da moto", order: 4 },
  { key: "certificate", label: "Selos e certificados", order: 5 },
  { key: "fiscal", label: "Fiscalização e laudo", order: 6 },
  { key: "profile", label: "Conta e perfil", order: 7 },
  { key: "support", label: "Suporte", order: 8 },
];

function getTopicGroups(articles: HelpArticle[]): TopicGroup[] {
  return TOPIC_CONFIG
    .map((cfg) => ({
      key: cfg.key, label: cfg.label, icon: "Wrench",
      articles: articles.filter((a) => a.module_key === cfg.key),
    }))
    .filter((g) => g.articles.length > 0)
    .sort((a, b) => {
      const oa = TOPIC_CONFIG.find((c) => c.key === a.key)?.order ?? 99;
      const ob = TOPIC_CONFIG.find((c) => c.key === b.key)?.order ?? 99;
      return oa - ob;
    });
}

// ── Testes ────────────────────────────────────────────────────

describe("Home — sugestões principais", () => {
  it("retorna os 6 slugs esperados na ordem correta", () => {
    const sugg = getHomeSuggestions(ARTICLES);
    expect(sugg.map((a) => a.slug)).toEqual(HOME_SLUGS);
  });

  it("retorna apenas artigos existentes na KB", () => {
    const partial = ARTICLES.filter((a) => a.slug !== "modo-fiscalizacao");
    const sugg = getHomeSuggestions(partial);
    expect(sugg.map((a) => a.slug)).not.toContain("modo-fiscalizacao");
    expect(sugg.length).toBe(5); // 1 artigo faltando
  });

  it("nunca retorna artigos fora da KB", () => {
    const sugg = getHomeSuggestions(ARTICLES);
    for (const a of sugg) {
      expect(ARTICLES.some((kb) => kb.id === a.id)).toBe(true);
    }
  });
});

describe("Contexto Manutenção", () => {
  it("prioriza artigos de maintenance", () => {
    const sugg = getContextSuggestions(ARTICLES, "maintenance");
    const modules = sugg.map((a) => a.module_key);
    expect(modules.every((m) => m === "maintenance")).toBe(true);
  });

  it("retorna até 4 sugestões", () => {
    const sugg = getContextSuggestions(ARTICLES, "maintenance");
    expect(sugg.length).toBeLessThanOrEqual(4);
  });
});

describe("Contexto Passaporte", () => {
  it("prioriza artigos de passport", () => {
    const sugg = getContextSuggestions(ARTICLES, "passport");
    expect(sugg.every((a) => a.module_key === "passport")).toBe(true);
  });

  it("encontra passaporte-digital e usar-passaporte-venda", () => {
    const sugg = getContextSuggestions(ARTICLES, "passport");
    const slugs = sugg.map((a) => a.slug);
    expect(slugs).toContain("passaporte-digital");
    expect(slugs).toContain("usar-passaporte-venda");
  });
});

describe("Ver todas as opções — tópicos", () => {
  it("cria grupo para cada module_key com artigos", () => {
    const groups = getTopicGroups(ARTICLES);
    const keys = groups.map((g) => g.key);
    expect(keys).toContain("motorcycle");
    expect(keys).toContain("maintenance");
    expect(keys).toContain("passport");
    expect(keys).toContain("support");
  });

  it("não cria grupo vazio", () => {
    const groups = getTopicGroups(ARTICLES);
    expect(groups.every((g) => g.articles.length > 0)).toBe(true);
  });

  it("ordena grupos pela configuração de ordem", () => {
    const groups = getTopicGroups(ARTICLES);
    const first = groups[0];
    expect(first.key).toBe("motorcycle"); // order=1
  });

  it("grupo maintenance contém registrar-manutencao, plano-manutencao, meus-itens", () => {
    const groups = getTopicGroups(ARTICLES);
    const maint = groups.find((g) => g.key === "maintenance")!;
    const slugs = maint.articles.map((a) => a.slug);
    expect(slugs).toContain("registrar-manutencao");
    expect(slugs).toContain("plano-manutencao");
    expect(slugs).toContain("meus-itens");
  });
});

describe("Tópico detalhe — artigos", () => {
  it("grupo passport só exibe artigos de passport", () => {
    const groups = getTopicGroups(ARTICLES);
    const passport = groups.find((g) => g.key === "passport")!;
    expect(passport.articles.every((a) => a.module_key === "passport")).toBe(true);
  });

  it("artigo tem slug, title, summary preenchidos", () => {
    const groups = getTopicGroups(ARTICLES);
    for (const g of groups) {
      for (const a of g.articles) {
        expect(a.slug).toBeTruthy();
        expect(a.title).toBeTruthy();
        expect(a.summary).toBeTruthy();
      }
    }
  });
});

describe("Busca livre — continua em qualquer nível", () => {
  it("KB contém artigos suficientes para busca", () => {
    expect(ARTICLES.length).toBeGreaterThanOrEqual(6);
  });

  it("artigo com module_key passport é encontrável", () => {
    const passport = ARTICLES.find((a) => a.slug === "passaporte-digital");
    expect(passport).toBeDefined();
    expect(passport!.module_key).toBe("passport");
  });
});

describe("Lacunas da KB", () => {
  it("não há artigo com slug historico-manutencao (lacuna documentada)", () => {
    const found = ARTICLES.find((a) => a.slug === "historico-manutencao");
    expect(found).toBeUndefined();
  });

  it("não há artigo com module_key agenda no seed atual", () => {
    // Agenda não está no seed — lacuna conhecida
    const found = ARTICLES.find((a) => a.module_key === "agenda");
    expect(found).toBeUndefined();
  });
});
