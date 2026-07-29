/**
 * Salvamento oficial de arquivos gerados no cliente (TrailBook).
 *
 * Cascata de estratégias, por capacidade (nunca por user-agent):
 *   1. window.showSaveFilePicker  → o usuário escolhe nome e destino.
 *   2. navigator.canShare({ files }) + navigator.share → compartilhamento
 *      nativo com o arquivo real (iOS: "Salvar em Arquivos").
 *   3. Download convencional via <a download>.
 *
 * Cancelamentos/falhas nas etapas mediadas pelo navegador NÃO encerram a
 * cascata. O fluxo sempre tenta a próxima estratégia até chegar ao download
 * convencional. Apenas falhas no download final retornam { outcome: "error" }.
 */

export type SaveOutcome = "saved" | "shared" | "downloaded" | "cancelled" | "error";

export interface SaveFileResult {
  outcome: SaveOutcome;
  error?: unknown;
}

type SaveStrategy = "file-picker" | "native-share" | "download";

export interface SaveFileStep {
  event: string;
  strategy?: SaveStrategy;
  fileName?: string;
  mime?: string;
  size?: number;
  outcome?: SaveOutcome;
  errorName?: string;
  errorMessage?: string;
}

type SaveFileReporter = (step: SaveFileStep) => void;

function errorMeta(err: unknown): Pick<SaveFileStep, "errorName" | "errorMessage"> {
  const e = err as { name?: string; message?: string };
  return {
    errorName: e?.name ?? typeof err,
    errorMessage: e?.message ?? String(err),
  };
}

function isAbort(err: unknown): boolean {
  if (!err) return false;
  const e = err as { name?: string; message?: string };
  const name = e.name ?? "";
  const msg = (e.message ?? "").toLowerCase();
  return (
    name === "AbortError" ||
    name === "NotAllowedError" ||
    msg.includes("abort") ||
    msg.includes("cancel") ||
    msg.includes("user denied")
  );
}

function extFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("pdf")) return "pdf";
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  if (m.includes("plain")) return "txt";
  if (m.includes("csv")) return "csv";
  return "bin";
}

/** Sanitiza nome de arquivo: sem barras, reservados, duplo-espaço, ponto final, tamanho <= 120. */
export function sanitizeFileName(name: string, fallback = "arquivo"): string {
  const cleaned = (name || "")
    .normalize("NFKD")
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "")
    .trim();
  const safe = cleaned.length > 0 ? cleaned : fallback;
  return safe.length > 120 ? safe.slice(0, 120) : safe;
}

function ensureExtension(fileName: string, mime: string): string {
  const ext = extFromMime(mime);
  const lower = fileName.toLowerCase();
  return lower.endsWith(`.${ext}`) ? fileName : `${fileName}.${ext}`;
}

async function trySaveFilePicker(blob: Blob, fileName: string, mime: string, report?: SaveFileReporter): Promise<SaveFileResult | null> {
  const w = typeof window !== "undefined" ? (window as unknown as { showSaveFilePicker?: (opts: unknown) => Promise<{ createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }> }) : null;
  if (!w || typeof w.showSaveFilePicker !== "function") {
    report?.({ event: "unavailable", strategy: "file-picker", fileName, mime, size: blob.size });
    return null;
  }
  try {
    report?.({ event: "start", strategy: "file-picker", fileName, mime, size: blob.size });
    const handle = await w.showSaveFilePicker({
      suggestedName: fileName,
      types: [{ description: "Arquivo", accept: { [mime]: [`.${extFromMime(mime)}`] } }],
    });
    report?.({ event: "handle-created", strategy: "file-picker", fileName, mime, size: blob.size });
    const stream = await handle.createWritable();
    await stream.write(blob);
    await stream.close();
    report?.({ event: "success", strategy: "file-picker", outcome: "saved", fileName, mime, size: blob.size });
    return { outcome: "saved" };
  } catch (err) {
    report?.({
      event: isAbort(err) ? "cancelled-continue" : "error-continue",
      strategy: "file-picker",
      fileName,
      mime,
      size: blob.size,
      ...errorMeta(err),
    });
    return null;
  }
}

async function tryShareFile(blob: Blob, fileName: string, mime: string, title?: string, report?: SaveFileReporter): Promise<SaveFileResult | null> {
  if (typeof navigator === "undefined") {
    report?.({ event: "unavailable", strategy: "native-share", fileName, mime, size: blob.size });
    return null;
  }
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share !== "function") {
    report?.({ event: "unavailable", strategy: "native-share", fileName, mime, size: blob.size });
    return null;
  }
  try {
    report?.({ event: "start", strategy: "native-share", fileName, mime, size: blob.size });
    const file = new File([blob], fileName, { type: mime });
    if (typeof nav.canShare === "function" && !nav.canShare({ files: [file] })) {
      report?.({ event: "cannot-share-files", strategy: "native-share", fileName, mime, size: blob.size });
      return null;
    }
    await nav.share({ files: [file], title });
    report?.({ event: "success", strategy: "native-share", outcome: "shared", fileName, mime, size: blob.size });
    return { outcome: "shared" };
  } catch (err) {
    report?.({
      event: isAbort(err) ? "cancelled-continue" : "error-continue",
      strategy: "native-share",
      fileName,
      mime,
      size: blob.size,
      ...errorMeta(err),
    });
    return null;
  }
}

function downloadBlob(blob: Blob, fileName: string, report?: SaveFileReporter): SaveFileResult {
  try {
    report?.({ event: "start", strategy: "download", fileName, mime: blob.type, size: blob.size });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    report?.({ event: "click-dispatched", strategy: "download", outcome: "downloaded", fileName, mime: blob.type, size: blob.size });
    return { outcome: "downloaded" };
  } catch (err) {
    report?.({ event: "error", strategy: "download", fileName, mime: blob.type, size: blob.size, ...errorMeta(err) });
    return { outcome: "error", error: err };
  }
}

/**
 * Salva um Blob no dispositivo do usuário, respeitando a cascata oficial.
 * Nunca lança — sempre retorna um SaveFileResult para a UI decidir o toast.
 */
export async function saveFile(params: {
  blob: Blob;
  fileName: string;
  mime?: string;
  shareTitle?: string;
  onStep?: SaveFileReporter;
}): Promise<SaveFileResult> {
  const mime = params.mime || params.blob.type || "application/octet-stream";
  const name = ensureExtension(sanitizeFileName(params.fileName), mime);
  params.onStep?.({ event: "prepared", fileName: name, mime, size: params.blob.size });

  const picker = await trySaveFilePicker(params.blob, name, mime, params.onStep);
  if (picker) return picker;

  const shared = await tryShareFile(params.blob, name, mime, params.shareTitle, params.onStep);
  if (shared) return shared;

  return downloadBlob(params.blob, name, params.onStep);
}