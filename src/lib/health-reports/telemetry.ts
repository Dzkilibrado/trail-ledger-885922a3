/**
 * Telemetria técnica da Etapa 3 (Check-up e Laudo Inteligente).
 * Somente eventos funcionais, sem dados pessoais e sem rastreamento invasivo.
 */
export type HealthTelemetryEvent =
  | "checkup_iniciado"
  | "checkup_abandonado"
  | "analise_concluida"
  | "emissao_bloqueada"
  | "laudo_emitido"
  | "pdf_iniciado"
  | "pdf_concluido"
  | "pdf_erro"
  | "compartilhamento_criado"
  | "pagina_publica_acessada"
  | "link_expirado"
  | "link_revogado"
  | "comparacao_executada";

type Payload = Record<string, string | number | boolean | null | undefined>;

export function trackHealth(event: HealthTelemetryEvent, payload: Payload = {}) {
  try {
    const entry = { scope: "trailbook-health", event, at: new Date().toISOString(), ...payload };
    // Log estruturado — consumido no diagnóstico do beta.
    console.info("[TB-HEALTH]", JSON.stringify(entry));
  } catch {
    /* telemetria nunca pode quebrar a experiência */
  }
}