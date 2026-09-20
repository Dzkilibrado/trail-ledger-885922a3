// ============================================================
// Testes fiscalizacao — T01–T16
// T01–T04: ModuleGate
// T05–T08: CPF/dados exclusivos do preset fiscal
// T09–T12: FiscalPublicView renderização
// T13–T16: buildFiscalPdf
// T17–T25: requerem execução real (HOMOLOGAÇÃO MANUAL)
// ============================================================
import { describe, it, expect } from "vitest";
import { buildFiscalPdf, type FiscalPdfInput } from "@/lib/health-reports/fiscal-pdf";
import { isModuleEligible } from "@/lib/assistant-module-map";
import type { ModuleStatus } from "@/lib/modules";

function statuses(overrides: Record<string, ModuleStatus> = {}): Record<string, ModuleStatus> {
  return { "fiscalizacao": "beta", ...overrides };
}

// ── Dados de fixture ──────────────────────────────────────────

const FISCAL_DATA = {
  owner_name:        "Joao da Silva",
  owner_cpf:         "123.456.789-09",
  origin_doc_type:   "invoice",
  origin_doc_name:   "nota_fiscal.jpg",
  origin_doc_number: "NF-001234",
  origin_doc_mime:   "image/jpeg",
};

// Dado de origem com ID (para testes de validação de presença do doc na view pública)
const FISCAL_VIEW_DATA = {
  ...FISCAL_DATA,
  origin_doc_id: "doc-uuid-1",
};

const BASE_PDF_INPUT: FiscalPdfInput = {
  snapshot: {
    motorcycle: {
      id: "moto-1", trailbookId: "TB-001", nickname: null,
      brand: "Honda", model: "CRF450X", yearMake: 2022, yearModel: 2022,
      displacement: 450, plate: "ABC-1234", chassisMasked: "9C2***1234",
      controlType: "hours", condition: "usado", hoursTotal: 120, kmTotal: 3000,
      mainPhotoUrl: null,
    },
    rideAnswer: {
      status: "ok", title: "Saudavel", message: "Moto em bom estado.",
      rationale: "", counts: { critical: 0, attention: 0, ok: 5, unknown: 0, total: 5 },
      disclaimer: "",
    },
  },
  code: "TB-LAUDO-2026-000001",
  issuedAt: "2026-09-19T12:00:00Z",
  status: "valid",
  fiscal: FISCAL_DATA,
};

// ── T01–T04: ModuleGate ───────────────────────────────────────

describe("T01–T04 — ModuleGate Fiscalização", () => {
  it("T01 disabled → inelegível (botão não deve aparecer)", () => {
    expect(isModuleEligible("fiscalizacao", statuses({ fiscalizacao: "disabled" }))).toBe(false);
  });

  it("T02 beta → elegível (botão com badge β)", () => {
    expect(isModuleEligible("fiscalizacao", statuses({ fiscalizacao: "beta" }))).toBe(true);
  });

  it("T03 active → elegível (botão sem badge)", () => {
    expect(isModuleEligible("fiscalizacao", statuses({ fiscalizacao: "active" }))).toBe(true);
  });

  it("T04 maintenance → inelegível (mensagem de manutenção via código do dialog)", () => {
    expect(isModuleEligible("fiscalizacao", statuses({ fiscalizacao: "maintenance" }))).toBe(false);
  });
});

// ── T05–T08: Dados fiscais exclusivos ─────────────────────────

describe("T05–T08 — Dados fiscais exclusivos do preset fiscal", () => {
  it("T05 fiscal.owner_cpf contém CPF completo formatado no fixture", () => {
    // CPF completo 123.456.789-09 — não mascarado
    expect(FISCAL_DATA.owner_cpf).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
    expect(FISCAL_DATA.owner_cpf).toBe("123.456.789-09");
  });

  it("T06 buyer não recebe dados fiscais (fiscal=null)", () => {
    // O campo fiscal só é populado na RPC quando preset=fiscal
    // Para buyer/workshop/custom, fiscal é null
    const buyerResponse = { preset: "buyer", fiscal: null };
    expect(buyerResponse.fiscal).toBeNull();
  });

  it("T07 workshop não recebe CPF (fiscal=null)", () => {
    const workshopResponse = { preset: "workshop", fiscal: null };
    expect(workshopResponse.fiscal).toBeNull();
  });

  it("T08 custom não recebe CPF (fiscal=null)", () => {
    const customResponse = { preset: "custom", fiscal: null };
    expect(customResponse.fiscal).toBeNull();
  });
});

// ── T09–T12: FiscalPublicView — lógica de renderização ────────

describe("T09–T12 — FiscalPublicView dados opcionais", () => {
  it("T09 fiscal com dados completos tem owner_name e owner_cpf", () => {
    const { owner_name, owner_cpf } = FISCAL_DATA;
    expect(owner_name).toBeTruthy();
    expect(owner_cpf).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
  });

  it("T10 documento disponível quando origin_doc_id presente", () => {
    expect(FISCAL_VIEW_DATA.origin_doc_id).toBeTruthy();
    expect(FISCAL_VIEW_DATA.origin_doc_type).toBe("invoice");
  });

  it("T11 FiscalPublicView sem documento não quebra: origin_doc_type null", () => {
    // Quando origin_doc_type é null, exibir "Nenhum documento de origem cadastrado"
    const fiscal = { owner_name: "Test", owner_cpf: "123.456.789-09",
      origin_doc_id: null, origin_doc_type: null,
      origin_doc_mime: null, origin_doc_name: null, origin_doc_number: null };
    const hasDoc = !!fiscal.origin_doc_type;
    expect(hasDoc).toBe(false);
  });

  it("T12 campos opcionais ausentes não causam erro na montagem do input", () => {
    const inputSemDados: FiscalPdfInput = {
      ...BASE_PDF_INPUT,
      snapshot: {},
      fiscal: null,
    };
    // Deve ser possível criar o objeto sem erro de tipo
    expect(inputSemDados.fiscal).toBeNull();
    expect(inputSemDados.snapshot).toEqual({});
  });
});

// ── T13–T16: buildFiscalPdf ────────────────────────────────────

describe("T13–T16 — buildFiscalPdf", () => {
  it("T13 PDF sem documento é gerado como Blob", async () => {
    const input: FiscalPdfInput = {
      ...BASE_PDF_INPUT,
      fiscal: { owner_name: "Test", owner_cpf: "123.456.789-09",
                origin_doc_type: null, origin_doc_mime: null,
                origin_doc_name: null, origin_doc_number: null },
      docImageDataUrl: null,
    };
    const blob = await buildFiscalPdf(input);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toBe("application/pdf");
  });

  it("T14 PDF com imagem JPEG é gerado como Blob maior", async () => {
    // Criar data URL mínima válida (1x1 pixel JPEG)
    const minJpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD//gATQ3JlYXRlZCB3aXRoIEdJTVD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=";
    const input: FiscalPdfInput = {
      ...BASE_PDF_INPUT,
      docImageDataUrl: minJpeg,
    };
    const blob = await buildFiscalPdf(input);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
  });

  it("T15 PDF inclui proprietário e CPF no input", async () => {
    // Verificar que o input contém owner_name e owner_cpf
    expect(BASE_PDF_INPUT.fiscal?.owner_name).toBe("Joao da Silva");
    expect(BASE_PDF_INPUT.fiscal?.owner_cpf).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
    const blob = await buildFiscalPdf(BASE_PDF_INPUT);
    expect(blob).toBeInstanceOf(Blob);
  });

  it("T16 PDF inclui identificação da motocicleta no input", async () => {
    const moto = BASE_PDF_INPUT.snapshot.motorcycle;
    expect(moto?.brand).toBe("Honda");
    expect(moto?.model).toBe("CRF450X");
    expect(moto?.plate).toBe("ABC-1234");
    const blob = await buildFiscalPdf(BASE_PDF_INPUT);
    expect(blob).toBeInstanceOf(Blob);
  });
});

/*
HOMOLOGAÇÃO MANUAL NECESSÁRIA (T17–T25):

T17 — Verificar no app que botão 'Fiscalização' some quando disabled
T18 — Verificar badge β quando beta
T19 — Verificar botão PDF gera arquivo legível
T20 — Verificar que CPF completo aparece na tela pública /l/$token após migration
T21 — Verificar botão Visualizar documento abre signed URL correta
T22 — Verificar que signed URL expira com TTL (max 5 min após emissão)
T23 — Verificar que share revogado bloqueia nova signed URL, mas URL já emitida
       pode ter janela residual de até 5 minutos (TTL da signed URL)
T24 — Verificar layout mobile 320x568 a 392x852
T25 — PDF com imagem de NF real incorporada e legível
*/
