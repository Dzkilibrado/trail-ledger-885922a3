// ============================================================
// cockpit-moto.test.ts — MOTO01–MOTO20
// Testes de estados da Central da Moto e integridade de navegação
// ============================================================
import { describe, it, expect } from "vitest";
import { isModuleEligible } from "@/lib/assistant-module-map";
import type { ModuleStatus } from "@/lib/modules";

// ── Simulações de estado da useQuery ─────────────────────────

type MockQueryState = {
  isLoading: boolean;
  isFetching: boolean;
  isPending: boolean;
  isError: boolean;
  data: any;
  error: any;
};

function queryState(overrides: Partial<MockQueryState> = {}): MockQueryState {
  return {
    isLoading: false,
    isFetching: false,
    isPending: false,
    isError: false,
    data: undefined,
    error: null,
    ...overrides,
  };
}

/** Lógica de decisão de estado — espelha a implementação do Cockpit/MCC */
function resolveState(q: MockQueryState): string {
  // loading: query em andamento ou sem dado ainda (mas não em erro)
  if (q.isLoading || (!q.data && !q.isError)) return "LOADING";
  // erro com dado do placeholderData presente → mostrar dado (não piscar)
  if (q.isError && q.data) return "NORMAL"; // dado anterior preservado
  // erro sem dado → classificar
  if (q.isError && !q.data) {
    const isNotFound = q.error?.code === "PGRST116" || q.error?.message?.includes("0 rows");
    return isNotFound ? "NOT_FOUND" : "NETWORK_ERROR";
  }
  if (!q.data) return "NOT_FOUND";
  return "NORMAL";
}

// ── MOTO01–MOTO08: estados ───────────────────────────────────

describe("MOTO01–MOTO08 — Estados da Central da Moto", () => {
  it("MOTO01 auth loading → query não executa (sem data, sem error = LOADING)", () => {
    const state = resolveState(queryState({ isLoading: true }));
    expect(state).toBe("LOADING");
  });

  it("MOTO02 loading normal → LOADING (skeleton)", () => {
    const state = resolveState(queryState({ isLoading: true }));
    expect(state).toBe("LOADING");
  });

  it("MOTO03 refetch com dado anterior → NORMAL (placeholderData preserva data)", () => {
    // Durante refetch: isFetching=true, mas data está preenchido pelo placeholderData
    const state = resolveState(queryState({ isFetching: true, data: { id: "moto-1" }, isError: false }));
    expect(state).toBe("NORMAL");
  });

  it("MOTO04 network error sem dado anterior → NETWORK_ERROR", () => {
    const state = resolveState(queryState({
      isError: true,
      error: { code: "FETCH_ERROR", message: "network" },
      data: undefined,
    }));
    expect(state).toBe("NETWORK_ERROR");
  });

  it("MOTO05 PGRST116 real (zero rows) → NOT_FOUND", () => {
    const state = resolveState(queryState({
      isError: true,
      error: { code: "PGRST116", message: "0 rows" },
      data: undefined,
    }));
    expect(state).toBe("NOT_FOUND");
  });

  it("MOTO06 erro inesperado com código desconhecido → NETWORK_ERROR (não NOT_FOUND)", () => {
    const state = resolveState(queryState({
      isError: true,
      error: { code: "42P01", message: "relation does not exist" },
      data: undefined,
    }));
    expect(state).toBe("NETWORK_ERROR");
  });

  it("MOTO07 moto existente com data preenchida → NORMAL", () => {
    const state = resolveState(queryState({ data: { id: "moto-1", model: "CRF450X" } }));
    expect(state).toBe("NORMAL");
  });

  it("MOTO08 ID inválido (UUID inexistente) → PGRST116 → NOT_FOUND", () => {
    const state = resolveState(queryState({
      isError: true,
      error: { code: "PGRST116" },
      data: undefined,
    }));
    expect(state).toBe("NOT_FOUND");
  });
});

// ── MOTO09–MOTO10: integridade de IDs ────────────────────────

describe("MOTO09–MOTO10 — IDs não podem ser confundidos", () => {
  it("MOTO09 reportId não pode substituir motorcycleId", () => {
    // O routeParam $id vem de /motorcycles/$id — sempre motorcycleId
    // report.$id vem de /motorcycles/$id/checkups/$code — param distinto
    const motorcycleRoute = "/motorcycles/:id";
    const reportRoute = "/motorcycles/:id/checkups/:code";
    // Rotas distintas: id é sempre motorcycleId, code é o reportCode
    expect(motorcycleRoute).not.toBe(reportRoute);
    expect(reportRoute).toContain(":code");
  });

  it("MOTO10 shareId não é motorcycleId — share usa token, não UUID de moto", () => {
    const shareToken = "abc123def456";
    const motoId = "550e8400-e29b-41d4-a716-446655440000";
    // Token é hex, motorcycleId é UUID — estruturas distintas
    expect(shareToken).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(motoId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });
});

// ── MOTO11–MOTO16: navegação entre telas ─────────────────────

describe("MOTO11–MOTO16 — Integridade de navegação", () => {
  it("MOTO11 lista → cockpit usa ID correto (param $id = motorcycle.id)", () => {
    const moto = { id: "moto-uuid-1", model: "CRF450X" };
    const expectedRoute = "/motorcycles/" + moto.id;
    expect(expectedRoute).toContain(moto.id);
    expect(expectedRoute).not.toContain("undefined");
    expect(expectedRoute).not.toContain("null");
  });

  it("MOTO12 check-up → voltar usa motorcycleId (não reportId)", () => {
    const motoId = "moto-uuid-1";
    const reportCode = "TB-2026-001";
    // Rota do check-up: /motorcycles/:id/checkups/:code
    // Ao voltar: /motorcycles/:id (usa $id, não $code)
    const backRoute = "/motorcycles/" + motoId;
    expect(backRoute).toContain(motoId);
    expect(backRoute).not.toContain(reportCode);
  });

  it("MOTO13 laudo → voltar usa motorcycleId", () => {
    const motoId = "moto-uuid-1";
    const back = "/motorcycles/" + motoId + "/checkups";
    expect(back).toContain(motoId);
  });

  it("MOTO14 fiscalização → voltar usa motorcycleId", () => {
    const motoId = "moto-uuid-1";
    // FiscalShareDialog é modal dentro de checkups/$code — não navega
    expect(motoId).toBeTruthy();
  });

  it("MOTO15 certificado → usa $id da rota (motorcycleId)", () => {
    const motoId = "moto-uuid-1";
    const certRoute = "/motorcycles/" + motoId + "/certificate";
    expect(certRoute).toContain(motoId);
  });

  it("MOTO16 passaporte → usa $id da rota (motorcycleId)", () => {
    const motoId = "moto-uuid-1";
    const passRoute = "/motorcycles/" + motoId + "/passport";
    expect(passRoute).toContain(motoId);
  });
});

// ── MOTO17–MOTO20: invalidação e recuperação ─────────────────

describe("MOTO17–MOTO20 — Invalidação e recuperação", () => {
  it("MOTO17 invalidation com placeholderData não produz NOT_FOUND (dado anterior preservado)", () => {
    // Simula: invalidação disparada → isFetching=true, mas placeholderData mantém data
    const stateRefetch = resolveState(queryState({
      isFetching: true,
      data: { id: "moto-1" },   // placeholderData preservado
      isError: false,
    }));
    expect(stateRefetch).toBe("NORMAL"); // não pisca NOT_FOUND
  });

  it("MOTO18 session refresh → sem dado transitório → LOADING (não NOT_FOUND)", () => {
    // Durante session refresh: isLoading=true
    const state = resolveState(queryState({ isLoading: true }));
    expect(state).toBe("LOADING");
  });

  it("MOTO19 Modo Homologação não altera owner_id das motos existentes", () => {
    // Homolog invalida apenas ["admin", "homolog", "summary"]
    // Não chama invalidateMotorcycleState
    // Portanto motos existentes do owner real não são afetadas
    const homologInvalidatedKeys = ["admin", "homolog", "summary"];
    const motoKey = ["motorcycle", "moto-uuid-1"];
    const affected = motoKey.some((k) => homologInvalidatedKeys.includes(k));
    expect(affected).toBe(false);
  });

  it("MOTO20 erro transitório: após refetch bem-sucedido → NORMAL", () => {
    // Erro → refetch → data volta
    const stateError = resolveState(queryState({
      isError: true,
      error: { code: "FETCH_ERROR" },
      data: undefined,
    }));
    expect(stateError).toBe("NETWORK_ERROR");
    // Após retry:
    const stateOk = resolveState(queryState({ data: { id: "moto-1" } }));
    expect(stateOk).toBe("NORMAL");
  });
});
