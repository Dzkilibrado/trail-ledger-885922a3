// ============================================================
// Testes: assistant-module-map — module-awareness do Assistente
// ============================================================
import { describe, it, expect } from "vitest";
import {
  isModuleEligible,
  getArticleModuleStatus,
  ARTICLE_MODULE_MAP,
  ELIGIBLE_STATUSES,
} from "./assistant-module-map";
import type { ModuleStatus } from "@/lib/modules";

// ── Fixtures ──────────────────────────────────────────────────

function statuses(overrides: Record<string, ModuleStatus> = {}): Record<string, ModuleStatus> {
  return {
    "motorcycles":   "active",
    "maintenance":   "active",
    "passport":      "active",
    "certificates":  "active",
    "tickets":       "active",
    "agenda":        "active",
    "dashboard":     "active",
    "moto-control":  "active",   // default: active
    "checkups":      "active",
    ...overrides,
  };
}

// ── Testes isModuleEligible ───────────────────────────────────

describe("isModuleEligible", () => {
  it("A. módulo active → elegível", () => {
    expect(isModuleEligible("fiscal", statuses({ "moto-control": "active" }))).toBe(true);
  });

  it("A. módulo beta → elegível", () => {
    expect(isModuleEligible("fiscal", statuses({ "moto-control": "beta" }))).toBe(true);
  });

  it("B. módulo disabled → inelegível", () => {
    expect(isModuleEligible("fiscal", statuses({ "moto-control": "disabled" }))).toBe(false);
  });

  it("C. módulo maintenance → inelegível", () => {
    expect(isModuleEligible("fiscal", statuses({ "moto-control": "maintenance" }))).toBe(false);
  });

  it("module_key sem gate (maintenance) → sempre elegível", () => {
    // maintenance não tem platform_module único — sub-ações sempre ativas
    expect(isModuleEligible("maintenance", statuses())).toBe(true);
  });

  it("module_key null → sempre elegível", () => {
    expect(isModuleEligible(null, statuses())).toBe(true);
  });

  it("module_key desconhecido → elegível (não bloquear silenciosamente)", () => {
    expect(isModuleEligible("unknown-module", statuses())).toBe(true);
  });

  it("profile → sem gate → sempre elegível", () => {
    expect(isModuleEligible("profile", statuses())).toBe(true);
  });

  it("passport active → elegível", () => {
    expect(isModuleEligible("passport", statuses({ passport: "active" }))).toBe(true);
  });

  it("passport disabled → inelegível", () => {
    expect(isModuleEligible("passport", statuses({ passport: "disabled" }))).toBe(false);
  });

  it("health/checkups disabled → inelegível", () => {
    expect(isModuleEligible("health", statuses({ checkups: "disabled" }))).toBe(false);
  });

  it("J. reativar módulo → volta a ser elegível", () => {
    const disabled = statuses({ "moto-control": "disabled" });
    const reactivated = { ...disabled, "moto-control": "active" as ModuleStatus };
    expect(isModuleEligible("fiscal", disabled)).toBe(false);
    expect(isModuleEligible("fiscal", reactivated)).toBe(true);
  });
});

// ── Testes getArticleModuleStatus ─────────────────────────────

describe("getArticleModuleStatus", () => {
  it("fiscal → retorna status de moto-control", () => {
    expect(getArticleModuleStatus("fiscal", statuses({ "moto-control": "disabled" }))).toBe("disabled");
  });

  it("profile → retorna null (sem gate)", () => {
    expect(getArticleModuleStatus("profile", statuses())).toBeNull();
  });

  it("maintenance → retorna null (sem gate único)", () => {
    expect(getArticleModuleStatus("maintenance", statuses())).toBeNull();
  });

  it("fiscal maintenance → retorna maintenance", () => {
    expect(getArticleModuleStatus("fiscal", statuses({ "moto-control": "maintenance" }))).toBe("maintenance");
  });
});

// ── Testes de configuração do mapa ───────────────────────────

describe("ARTICLE_MODULE_MAP", () => {
  it("fiscal mapeia para moto-control", () => {
    expect(ARTICLE_MODULE_MAP["fiscal"]).toBe("moto-control");
  });

  it("health mapeia para checkups", () => {
    expect(ARTICLE_MODULE_MAP["health"]).toBe("checkups");
  });

  it("passport mapeia para passport", () => {
    expect(ARTICLE_MODULE_MAP["passport"]).toBe("passport");
  });

  it("ELIGIBLE_STATUSES contém active e beta", () => {
    expect(ELIGIBLE_STATUSES).toContain("active");
    expect(ELIGIBLE_STATUSES).toContain("beta");
    expect(ELIGIBLE_STATUSES).not.toContain("disabled");
    expect(ELIGIBLE_STATUSES).not.toContain("maintenance");
  });
});

// ── Testes de Home filtering ──────────────────────────────────

import type { HelpArticle } from "@/lib/assistant-search";

function art(slug: string, module_key: string): HelpArticle {
  return { id: slug, slug, title: slug, summary: slug, body_md: null,
    module_key, route_template: null, cta_label: null, context_tags: [],
    needs_motorcycle: false, status: "published", sort_order: 0,
    created_at: "", updated_at: "", updated_by: null };
}

const HOME_CANDIDATES = [
  art("cadastrar-moto", "motorcycle"),
  art("registrar-manutencao", "maintenance"),
  art("plano-manutencao", "maintenance"),
  art("passaporte-digital", "passport"),
  art("health-avaliacao", "health"),
  art("modo-fiscalizacao", "fiscal"),   // ← o que queremos testar
  art("selos-qualidade", "certificate"),
  art("meus-itens", "maintenance"),
  art("abrir-chamado", "support"),
];

describe("Filtro da Home", () => {
  it("D. modo-fiscalizacao excluído quando moto-control disabled", () => {
    const st = statuses({ "moto-control": "disabled" });
    const eligible = HOME_CANDIDATES.filter((a) => isModuleEligible(a.module_key, st));
    expect(eligible.map((a) => a.slug)).not.toContain("modo-fiscalizacao");
  });

  it("K. home não fica vazio: candidatos de fallback assumem", () => {
    const st = statuses({ "moto-control": "disabled" });
    const eligible = HOME_CANDIDATES.filter((a) => isModuleEligible(a.module_key, st));
    const home = eligible.slice(0, 6);
    expect(home.length).toBeGreaterThan(0);
    // Deve ter pelo menos cadastrar-moto, registrar, plano, passaporte
    expect(home.map((a) => a.slug)).toContain("cadastrar-moto");
    expect(home.map((a) => a.slug)).toContain("registrar-manutencao");
  });

  it("E. related não inclui módulo disabled", () => {
    const st = statuses({ "moto-control": "disabled" });
    const topResult = art("health-avaliacao", "health"); // health = checkups = active
    const candidates = [art("modo-fiscalizacao", "fiscal"), art("selos-qualidade", "certificate")];
    const related = candidates.filter(
      (a) => a.id !== topResult.id && isModuleEligible(a.module_key, st)
    );
    expect(related.map((a) => a.slug)).not.toContain("modo-fiscalizacao");
  });

  it("tópico fiscal some quando moto-control disabled", () => {
    const st = statuses({ "moto-control": "disabled" });
    const TOPIC_CONFIG = [
      { key: "motorcycle" }, { key: "maintenance" }, { key: "fiscal" }, { key: "passport" }
    ];
    const groups = TOPIC_CONFIG.map((cfg) => ({
      key: cfg.key,
      articles: HOME_CANDIDATES.filter(
        (a) => a.module_key === cfg.key && isModuleEligible(a.module_key, st)
      ),
    })).filter((g) => g.articles.length > 0);
    expect(groups.map((g) => g.key)).not.toContain("fiscal");
  });
});
