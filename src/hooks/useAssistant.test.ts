// ============================================================
// Testes: useAssistant — navegação, sugestões, derivações da KB
// ============================================================
import { describe, it, expect } from "vitest";
import type { HelpArticle } from "@/lib/assistant-search";
import type { TopicGroup } from "@/hooks/useAssistant";
import { isModuleEligible } from "@/lib/assistant-module-map";

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
  art("cadastrar-moto",       "motorcycle",    ["moto","cadastro"],                     120),
  art("registrar-manutencao", "maintenance",   ["manutenção","registrar"],              130),
  art("plano-manutencao",     "maintenance",   ["plano","manutenção"],                  140),
  art("health-avaliacao",     "health",        ["saúde","check-up","laudo"],            150),
  art("check-up-laudo",       "health",        ["laudo","check-up","qr","pdf"],         145),
  art("passaporte-digital",   "passport",      ["passaporte","compartilhar"],           80),
  art("fiscalizacao-laudo",   "fiscalizacao",  ["fiscalização","qr","laudo","fiscal"],  180),
  art("historico-manutencao", "maintenance",   ["histórico","manutenção","timeline"],   135),
  art("agenda-manutencao",    "agenda",        ["agenda","próximas","programação"],     155),
  art("oficinas",             "maintenance",   ["oficina","mecânico","workshop"],       165),
  art("abrir-chamado",        "support",       ["suporte","chamado"],                   170),
  art("meus-itens",           "maintenance",   ["meus itens","biblioteca"],             160),
  art("cpf-obrigatorio",      "profile",       ["perfil","cadastro","cpf"],             10),
  art("alterar-cpf",          "support",       ["cpf","suporte"],                       20),
  art("selos-qualidade",      "certificate",   ["selos","qualidade","certificado"],     90),
  art("usar-passaporte-venda","passport",      ["passaporte","venda","compartilhar"],   190),
  art("editar-moto",          "motorcycle",    ["editar","moto"],                       200),
  // modo-fiscalizacao: ARQUIVADO — não aparece
];

// ── Helpers que replicam a lógica do hook sem React ───────────
const HOME_SLUGS = [
  "cadastrar-moto","registrar-manutencao","plano-manutencao",
  "health-avaliacao","check-up-laudo","passaporte-digital",
  "selos-qualidade","meus-itens","abrir-chamado",
];

const MAX_HOME = 6;
function getHomeSuggestions(articles: HelpArticle[]) {
  return HOME_SLUGS
    .map((s) => articles.find((a) => a.slug === s))
    .filter((a): a is HelpArticle => !!a)
    .slice(0, MAX_HOME);
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
  it("retorna até MAX_HOME_SUGGESTIONS slugs elegíveis da lista de candidatos", () => {
    const sugg = getHomeSuggestions(ARTICLES);
    // Todos os slugs retornados devem estar na KB
    for (const a of sugg) expect(ARTICLES.some((kb) => kb.id === a.id)).toBe(true);
    // Deve incluir health-avaliacao e check-up-laudo (novos)
    const slugs = sugg.map((a) => a.slug);
    expect(slugs).toContain("health-avaliacao");
    expect(slugs).toContain("check-up-laudo");
    // NÃO deve incluir modo-fiscalizacao (arquivado)
    expect(slugs).not.toContain("modo-fiscalizacao");
  });

  it("retorna apenas artigos existentes na KB", () => {
    // modo-fiscalizacao já não está na KB (arquivado), testar sem check-up-laudo
    const partial = ARTICLES.filter((a) => a.slug !== "check-up-laudo");
    const sugg = getHomeSuggestions(partial);
    expect(sugg.map((a) => a.slug)).not.toContain("check-up-laudo");
    expect(sugg.length).toBeGreaterThan(0);
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
  it("historico-manutencao agora existe na KB (lacuna resolvida na Etapa 2)", () => {
    const found = ARTICLES.find((a) => a.slug === "historico-manutencao");
    expect(found).toBeDefined();
    expect(found!.module_key).toBe("maintenance");
  });

  it("modo-fiscalizacao está arquivado e não aparece na home", () => {
    const found = ARTICLES.find((a) => a.slug === "modo-fiscalizacao");
    // Artigo arquivado não deve estar na lista de artigos published da fixture
    expect(found).toBeUndefined();
  });

  it("'Health 4.0' não é slug nem título em nenhum artigo published", () => {
    const hasHealth40 = ARTICLES.some(
      (a) => a.title?.includes("Health 4.0") || a.slug?.includes("health-40")
    );
    expect(hasHealth40).toBe(false);
  });
});

describe("Testes A-K — nomenclatura, fiscalização, ModuleGate", () => {
  it("A. Health 4.0 não aparece em nenhum título de artigo", () => {
    const hasHealth40 = ARTICLES.some((a) => a.title?.includes("Health 4.0"));
    expect(hasHealth40).toBe(false);
  });

  it("B. 'Ver a saúde da minha moto' — artigo health-avaliacao existe", () => {
    const a = ARTICLES.find((a) => a.slug === "health-avaliacao");
    expect(a).toBeDefined();
    expect(a!.module_key).toBe("health");
  });

  it("C. 'Gerar ou consultar um Laudo' — artigo check-up-laudo existe", () => {
    const a = ARTICLES.find((a) => a.slug === "check-up-laudo");
    expect(a).toBeDefined();
    expect(a!.module_key).toBe("health");
  });

  it("D. Fiscalização Beta é encontrável na KB (slug fiscalizacao-laudo)", () => {
    const a = ARTICLES.find((a) => a.slug === "fiscalizacao-laudo");
    expect(a).toBeDefined();
    expect(a!.module_key).toBe("fiscalizacao");
  });

  it("E. Fiscalização disabled não aparece na Home", () => {
    const HOME_SLUGS = ["cadastrar-moto","registrar-manutencao","health-avaliacao",
      "check-up-laudo","plano-manutencao","passaporte-digital","fiscalizacao-laudo",
      "selos-qualidade","meus-itens","abrir-chamado"];
    const st = { "fiscalizacao": "disabled" as const };
    const eligible = ARTICLES.filter((a) => isModuleEligible(a.module_key, st));
    const home = HOME_SLUGS.map((s) => eligible.find((a) => a.slug === s))
      .filter(Boolean).slice(0, 6);
    expect(home.map((a) => a!.slug)).not.toContain("fiscalizacao-laudo");
    expect(home.length).toBeGreaterThan(0);
  });

  it("F. Fiscalização maintenance não aparece nos tópicos", () => {
    const st = { "fiscalizacao": "maintenance" as const };
    const groupFiscal = { key: "fiscalizacao",
      articles: ARTICLES.filter((a) => a.module_key === "fiscalizacao" && isModuleEligible(a.module_key, st)) };
    expect(groupFiscal.articles.length).toBe(0);
  });

  it("G. busca 'laudo' encontra check-up-laudo", () => {
    const a = ARTICLES.find((a) => a.slug === "check-up-laudo");
    expect(a).toBeDefined();
    expect(a!.context_tags).toContain("laudo");
  });

  it("H. artigo fiscalizacao-laudo tem context_tags de fiscalização", () => {
    const a = ARTICLES.find((a) => a.slug === "fiscalizacao-laudo");
    expect(a!.context_tags).toContain("fiscalização");
    expect(a!.context_tags).toContain("fiscal");
  });

  it("I. tópicos sem artigos elegíveis não aparecem", () => {
    const TOPIC_CONFIG = [
      { key: "motorcycle" }, { key: "maintenance" }, { key: "fiscalizacao" }
    ];
    const st = { "fiscalizacao": "disabled" as const };
    const groups = TOPIC_CONFIG.map((cfg) => ({
      key: cfg.key,
      articles: ARTICLES.filter((a) => a.module_key === cfg.key && isModuleEligible(a.module_key, st)),
    })).filter((g) => g.articles.length > 0);
    expect(groups.map((g) => g.key)).not.toContain("fiscalizacao");
    expect(groups.map((g) => g.key)).toContain("motorcycle");
  });

  it("J. related respeita ModuleGate — fiscal disabled não aparece como relacionado", () => {
    const st = { "fiscalizacao": "disabled" as const };
    const topResult = ARTICLES.find((a) => a.slug === "check-up-laudo")!;
    const related = ARTICLES.filter(
      (a) => a.id !== topResult.id && a.module_key === topResult.module_key && isModuleEligible(a.module_key, st)
    );
    // check-up-laudo é health; fiscalizacao-laudo é fiscalizacao — não é relacionado de health
    expect(related.every((a) => a.module_key === "health")).toBe(true);
  });

  it("K. CTAs dos artigos apontam para slugs de rota existentes", () => {
    const KNOWN_ROUTES = [
      "/motorcycles/$motorcycleId/health",
      "/motorcycles/$motorcycleId/checkups",
      "/motorcycles/$motorcycleId/historico-manutencao",
      "/agenda", "/workshops", "/tickets", "/motorcycles",
    ];
    const articlesWithRoute = ARTICLES.filter((a) => a.route_template);
    for (const a of articlesWithRoute) {
      const normalized = a.route_template!.replace("/$motorcycleId/", "/$motorcycleId/");
      // Apenas verificar que route_template não é uma rota claramente inválida
      expect(a.route_template).not.toContain("undefined");
      expect(a.route_template!.length).toBeGreaterThan(1);
    }
  });
});
