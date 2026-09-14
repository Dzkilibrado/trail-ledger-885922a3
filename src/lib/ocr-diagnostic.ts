/**
 * OCR Diagnostic — armazenamento em memoria do diagnostico tecnico da ultima leitura.
 *
 * PRIVACIDADE:
 *   rawText, correctedText e tokens podem conter textos extraidos do documento
 *   (nome de cliente, oficina, CPF, telefone, endereco, placa, valores etc.).
 *   Dado tecnico potencialmente sensivel. Nao persiste automaticamente no banco.
 *   Nao envia ao servidor. O admin decide explicitamente exportar/copiar.
 *
 * DISPONIBILIDADE:
 *   Apenas para admins em Modo Homologacao. Nao exibir para usuarios comuns.
 */

export const DIAGNOSTIC_VERSION = 1;

export interface TokenDiagEntry {
  word: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number } | null;
  block_num: number | null;
  par_num: number | null;
  paragraph_num: number | null;
  line_num: number | null;
  lineKey: string;
}

export interface LineKeyEntry {
  lineKey: string;
  text: string;
  tokenCount: number;
  yMin: number;
  yMax: number;
  yRange: number;
  /** true quando yRange > 15px — indica possivel mistura de linhas visuais */
  hasMixture: boolean;
}

export interface RetryDecision {
  tokenWord: string;
  conf1: number;
  bbox: { left: number; top: number; width: number; height: number };
  cropSx: number; cropSy: number; cropSw: number; cropSh: number;
  cropCanvasWidth: number; cropCanvasHeight: number;
  psm7Result: string; psm7Conf: number;
  psm13Result: string; psm13Conf: number;
  bestPsm: 7 | 13;
  bestText: string; bestConf: number; delta: number;
  decision: "SUBSTITUIU" | "MANTEVE";
  finalToken: string;
}

export interface PageDiagnostic {
  pageNumber: number;
  devicePixelRatio: number;
  srcType: "File" | "dataUrl";
  naturalWidth: number; naturalHeight: number;
  bitmapWidth: number; bitmapHeight: number;
  bitmapEqualsNatural: boolean;
  wordsCount: number;
  tokens: TokenDiagEntry[];
  lineKeys: LineKeyEntry[];
  lineKeyCount: number;
  mixedLineKeys: string[];
  retryDecisions: RetryDecision[];
  rawText: string;
  correctedText: string;
}

export interface OcrDiagnosticReport {
  diagnosticVersion: number;
  timestamp: string;
  status: "ok" | "partial" | "error";
  errorMessage?: string;
  fileType: "image" | "pdf-digital" | "pdf-scanned" | "unknown";
  pageCount: number;
  pages: PageDiagnostic[];
  finalRawText: string;
  finalCorrectedText: string;
  finalLines: string[];
}

// Singleton em memoria — substituido a cada nova leitura
let _lastReport: OcrDiagnosticReport | null = null;

/** Inicia novo relatorio, descartando o anterior. */
export function startDiagnosticReport(
  fileType: OcrDiagnosticReport["fileType"],
  pageCount: number,
): OcrDiagnosticReport {
  _lastReport = {
    diagnosticVersion: DIAGNOSTIC_VERSION,
    timestamp: new Date().toISOString(),
    status: "ok",
    fileType,
    pageCount,
    pages: [],
    finalRawText: "",
    finalCorrectedText: "",
    finalLines: [],
  };
  return _lastReport;
}

export function getLastOcrDiagnostic(): OcrDiagnosticReport | null {
  return _lastReport;
}

export function markDiagnosticError(message: string, partial = false): void {
  if (!_lastReport) return;
  _lastReport.status = partial ? "partial" : "error";
  _lastReport.errorMessage = message;
}

export function appendPageDiagnostic(page: PageDiagnostic): void {
  if (!_lastReport) return;
  _lastReport.pages.push(page);
}

export function finalizeDiagnosticReport(
  finalRawText: string,
  finalCorrectedText: string,
  finalLines: string[],
): void {
  if (!_lastReport) return;
  _lastReport.finalRawText = finalRawText;
  _lastReport.finalCorrectedText = finalCorrectedText;
  _lastReport.finalLines = finalLines;
}

export function serializeDiagnostic(report: OcrDiagnosticReport): string {
  return JSON.stringify(report, null, 2);
}

export function diagnosticFileName(report: OcrDiagnosticReport): string {
  const ts = report.timestamp.replace(/[:.]/g, "-").slice(0, 19);
  return `trailbook-ocr-diagnostic-${ts}.json`;
}

export async function copyDiagnosticToClipboard(report: OcrDiagnosticReport): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(serializeDiagnostic(report));
    return true;
  } catch {
    return false;
  }
}

export function downloadDiagnostic(report: OcrDiagnosticReport): void {
  const blob = new Blob([serializeDiagnostic(report)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = diagnosticFileName(report);
  a.click();
  URL.revokeObjectURL(url);
}
