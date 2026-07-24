/**
 * Helpers server-only para geração do Recibo Inteligente (PDF + QR Code).
 * NUNCA importar de client/route directly — sempre via server function handler.
 */
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib/dist/pdf-lib.esm.js";
import QRCode from "qrcode";
import { formatCurrencyBRL, formatIssuedAt, formatVersion, nextReceiptCode, publicReceiptUrl } from "./smart-receipts";

export interface ReceiptPayload {
  code: string;
  version: number;
  issuedAt: string; // ISO
  motorcycle: {
    brand: string; model: string; year_model?: number | null;
    chassis?: string | null; plate?: string | null;
    hours_total?: number | null; km_total?: number | null;
  };
  seller: { full_name: string; cpf?: string | null; email?: string | null };
  buyer: { full_name: string; cpf?: string | null; email?: string | null };
  negotiation: {
    amount: number;
    payment_method: string;
    date: string; // ISO date
    location?: string | null;
    notes?: string | null;
  };
}

/** Gera PNG do QR Code apontando para trailbook.com.br/r/<code>. */
async function qrPng(code: string, origin: string): Promise<Uint8Array> {
  const url = publicReceiptUrl(code, origin);
  const buffer = await QRCode.toBuffer(url, {
    errorCorrectionLevel: "M",
    type: "png",
    margin: 1,
    width: 220,
  });
  return new Uint8Array(buffer);
}

function drawText(page: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont, color = rgb(0.12, 0.12, 0.14)) {
  page.drawText(text, { x, y, size, font, color });
}

function drawWrapped(page: PDFPage, text: string, x: number, y: number, maxWidth: number, size: number, font: PDFFont, lineHeight = 12): number {
  const words = text.split(/\s+/);
  let line = "";
  let cy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      drawText(page, line, x, cy, size, font);
      cy -= lineHeight;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) { drawText(page, line, x, cy, size, font); cy -= lineHeight; }
  return cy;
}

function drawFooter(page: PDFPage, font: PDFFont, code: string, version: number, sha256: string, origin: string) {
  const w = page.getWidth();
  const size = 7.5;
  const line1 = `Documento emitido eletronicamente pelo TrailBook — não substitui ATPV-e, CRV ou registro no DETRAN.`;
  const line2 = `Código ${code} · Versão ${formatVersion(version)} · SHA-256 ${sha256}`;
  const line3 = `Valide em ${publicReceiptUrl(code, origin)}`;
  const gray = rgb(0.4, 0.4, 0.45);
  drawText(page, line1, 40, 42, size, font, gray);
  drawText(page, line2, 40, 30, size, font, gray);
  drawText(page, line3, 40, 18, size, font, gray);
  // separator
  page.drawRectangle({ x: 40, y: 54, width: w - 80, height: 0.5, color: rgb(0.8, 0.8, 0.85) });
}

/**
 * Constrói o PDF do Recibo Inteligente (A4) com QR e rodapé institucional.
 * Retorna bytes do PDF + hash SHA-256 dos bytes.
 */
export async function buildReceiptPdf(payload: ReceiptPayload, origin: string): Promise<{ pdfBytes: Uint8Array; sha256: string }> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4 portrait
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const w = page.getWidth();

  // Header
  drawText(page, "TrailBook", 40, 800, 20, bold, rgb(0.02, 0.36, 0.78));
  drawText(page, "RECIBO DE COMPRA E VENDA DE MOTOCICLETA", 40, 780, 11, bold);
  drawText(page, "Documento eletrônico — modelo de referência", 40, 766, 8.5, font, rgb(0.4, 0.4, 0.45));

  // Right side: código + versão + emissão
  drawText(page, `Código: ${payload.code}`, w - 220, 800, 10, bold);
  drawText(page, `Versão: ${formatVersion(payload.version)}`, w - 220, 786, 9, font);
  drawText(page, `Emitido em: ${formatIssuedAt(payload.issuedAt)}`, w - 220, 774, 9, font);

  // QR Code
  const qrBytes = await qrPng(payload.code, origin);
  const qrImg = await pdf.embedPng(qrBytes);
  const qrSize = 100;
  page.drawImage(qrImg, { x: w - 140, y: 640, width: qrSize, height: qrSize });
  drawText(page, "Escaneie para validar", w - 138, 630, 7.5, font, rgb(0.4, 0.4, 0.45));

  // Section: Motocicleta
  let y = 740;
  drawText(page, "1. MOTOCICLETA", 40, y, 10, bold, rgb(0.02, 0.36, 0.78)); y -= 16;
  const m = payload.motorcycle;
  const motoLine = `${m.brand} ${m.model}${m.year_model ? ` — ${m.year_model}` : ""}`;
  drawText(page, motoLine, 40, y, 10, font); y -= 14;
  if (m.chassis) { drawText(page, `Chassi: ${m.chassis}`, 40, y, 9, font); y -= 12; }
  if (m.plate) { drawText(page, `Placa: ${m.plate}`, 40, y, 9, font); y -= 12; }
  if (m.hours_total != null) { drawText(page, `Horímetro: ${Number(m.hours_total).toFixed(1)} h`, 40, y, 9, font); y -= 12; }
  if (m.km_total != null) { drawText(page, `Odômetro: ${Number(m.km_total).toFixed(0)} km`, 40, y, 9, font); y -= 12; }

  // Section: Partes
  y -= 10;
  drawText(page, "2. PARTES", 40, y, 10, bold, rgb(0.02, 0.36, 0.78)); y -= 16;
  drawText(page, "VENDEDOR", 40, y, 9, bold); drawText(page, "COMPRADOR", 310, y, 9, bold); y -= 12;
  drawText(page, payload.seller.full_name, 40, y, 9.5, font);
  drawText(page, payload.buyer.full_name, 310, y, 9.5, font); y -= 12;
  if (payload.seller.cpf) drawText(page, `CPF: ${payload.seller.cpf}`, 40, y, 9, font);
  if (payload.buyer.cpf) drawText(page, `CPF: ${payload.buyer.cpf}`, 310, y, 9, font);
  y -= 12;
  if (payload.seller.email) drawText(page, payload.seller.email, 40, y, 9, font);
  if (payload.buyer.email) drawText(page, payload.buyer.email, 310, y, 9, font);
  y -= 20;

  // Section: Negociação
  drawText(page, "3. NEGOCIAÇÃO", 40, y, 10, bold, rgb(0.02, 0.36, 0.78)); y -= 16;
  drawText(page, `Valor: ${formatCurrencyBRL(payload.negotiation.amount)}`, 40, y, 10, bold); y -= 14;
  drawText(page, `Forma de pagamento: ${payload.negotiation.payment_method}`, 40, y, 9, font); y -= 12;
  drawText(page, `Data da negociação: ${new Date(payload.negotiation.date).toLocaleDateString("pt-BR")}`, 40, y, 9, font); y -= 12;
  if (payload.negotiation.location) { drawText(page, `Local: ${payload.negotiation.location}`, 40, y, 9, font); y -= 12; }
  if (payload.negotiation.notes) {
    y -= 4;
    drawText(page, "Observações:", 40, y, 9, bold); y -= 12;
    y = drawWrapped(page, payload.negotiation.notes, 40, y, w - 80, 9, font);
  }

  // Section: Cláusulas
  y -= 10;
  drawText(page, "4. CLÁUSULAS", 40, y, 10, bold, rgb(0.02, 0.36, 0.78)); y -= 16;
  const clauses = [
    "O vendedor declara ser legítimo proprietário da motocicleta descrita, livre de ônus judiciais e restrições que impeçam a transferência.",
    "O comprador declara receber a motocicleta no estado em que se encontra, tendo verificado a documentação apresentada.",
    "Motocicletas de uso off-road podem ter histórico de trilhas, competições e uso intenso — as partes reconhecem essa condição.",
    "Este documento é um modelo de referência e não substitui orientação jurídica, ATPV-e, CRV ou registro no DETRAN.",
    "As partes autorizam o registro deste recibo no TrailBook e sua consulta pública pelo código único acima.",
    "O Comprador declara ter examinado a motocicleta e estar ciente de seu estado de conservação, características e condições aparentes de uso. A partir da entrega, assume a responsabilidade pelo uso, multas, tributos, manutenção e demais encargos relacionados à motocicleta. A venda é realizada no estado em que o veículo se encontra, sem garantia contratual adicional oferecida pelo Vendedor, ressalvadas as responsabilidades legalmente aplicáveis.",
  ];
  for (const c of clauses) {
    y = drawWrapped(page, `• ${c}`, 40, y, w - 80, 8.5, font, 11);
    y -= 2;
  }

  // Encerramento formal antes das assinaturas.
  y -= 6;
  y = drawWrapped(
    page,
    "Por estarem de pleno acordo, as partes firmam o presente recibo em duas vias de igual teor e forma.",
    40, y, w - 80, 8.5, font, 11,
  );

  // Section: Assinaturas (linhas)
  y -= 20;
  drawText(page, "5. ASSINATURAS", 40, y, 10, bold, rgb(0.02, 0.36, 0.78)); y -= 26;
  page.drawRectangle({ x: 40, y, width: 230, height: 0.6, color: rgb(0.3, 0.3, 0.33) });
  page.drawRectangle({ x: 310, y, width: 230, height: 0.6, color: rgb(0.3, 0.3, 0.33) });
  drawText(page, "Vendedor", 40, y - 12, 8, font, rgb(0.4, 0.4, 0.45));
  drawText(page, "Comprador", 310, y - 12, 8, font, rgb(0.4, 0.4, 0.45));

  // Pre-compute pdf with placeholder hash, then rewrite footer with real hash.
  // Simpler: hash the payload bytes to embed in footer, then hash final PDF for the DB record.
  // We display in-PDF hash = SHA-256 of canonical payload JSON (deterministic).
  const canonical = JSON.stringify({ ...payload, origin });
  const canonicalBytes = new TextEncoder().encode(canonical);
  const ab = canonicalBytes.buffer.slice(canonicalBytes.byteOffset, canonicalBytes.byteOffset + canonicalBytes.byteLength) as ArrayBuffer;
  const canonicalHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", ab)))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

  drawFooter(page, font, payload.code, payload.version, canonicalHash, origin);

  const pdfBytes = await pdf.save();
  // Final PDF SHA-256 (bytes on disk) is what a validador externo recomputes.
  const pdfAb = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", pdfAb)))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  return { pdfBytes, sha256 };
}

export { nextReceiptCode };