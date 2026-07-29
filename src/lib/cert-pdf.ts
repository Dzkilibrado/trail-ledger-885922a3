import jsPDF from "jspdf";
import QRCode from "qrcode";
import { brl, formatDate, EVENT_TYPE_LABEL, MAINT_CATEGORY_LABEL, type EventRow, type Motorcycle } from "./trailbook";
import type { ConservationResult, CategoryHealth } from "./conservation";
import type { ScheduleStatus } from "./maintenance-engine";
import { sanitizeFileName } from "./save-file";

const ORANGE: [number, number, number] = [234, 88, 12];
const DARK: [number, number, number] = [17, 17, 19];
const MUTED: [number, number, number] = [120, 120, 130];
const LINE: [number, number, number] = [225, 225, 230];

export interface CertPdfInput {
  moto: Motorcycle;
  events: EventRow[];
  conservation: ConservationResult;
  health: CategoryHealth[];
  upcoming: ScheduleStatus[];
  publicUrl: string;
  photoDataUrl: string | null;
  attachmentsCount: number;
  workshopsCount: number;
}

export interface CertPdfOutput {
  blob: Blob;
  fileName: string;
}

export async function generateCertificatePdf(input: CertPdfInput): Promise<CertPdfOutput> {
  const { moto, events, conservation, health, upcoming, publicUrl, photoDataUrl, attachmentsCount, workshopsCount } = input;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = 0;

  // Header bar
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 80, "F");
  doc.setFillColor(...ORANGE);
  doc.rect(0, 80, W, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("TrailBook", M, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 210);
  doc.text("Prontuário digital · Certificado oficial", M, 56);
  doc.setFontSize(8);
  doc.text(`Emitido em ${formatDate(new Date().toISOString())}`, W - M, 38, { align: "right" });
  doc.setTextColor(...ORANGE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TRAILBOOK CERTIFIED", W - M, 56, { align: "right" });

  y = 110;

  // Photo + title
  if (photoDataUrl) {
    try {
      // photoDataUrl chega normalizado como JPEG pelo helper prepareCertPhotoDataUrl.
      // O parâmetro `format` do jsPDF é obrigatório quando passamos coordenadas numéricas —
      // omiti-lo faz o jsPDF interpretar `x` como formato e lançar exceção.
      doc.addImage(photoDataUrl, "JPEG", M, y, 160, 110);
    } catch (err) {
      console.error("[cert-pdf] addImage falhou, seguindo com placeholder", err);
      doc.setFillColor(245, 245, 248); doc.rect(M, y, 160, 110, "F");
    }
  } else {
    doc.setFillColor(245, 245, 248); doc.rect(M, y, 160, 110, "F");
  }
  const tx = M + 175;
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(moto.nickname || `${moto.brand} ${moto.model}`, tx, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text(`${moto.brand} ${moto.model} · ${moto.year_model ?? "—"}`, tx, y + 36);
  if (moto.plate || moto.chassis) {
    doc.setFontSize(9);
    doc.text(`Placa: ${moto.plate || "—"}   Chassi: ${moto.chassis || "—"}`, tx, y + 52);
  }

  // Quick stats
  const stats = [
    ["Horas", `${Number(moto.hours_total ?? 0).toFixed(1)} h`],
    ["Quilometragem", `${Number(moto.km_total ?? 0).toFixed(0)} km`],
    ["Conservação", `${conservation.score} (${conservation.grade})`],
    ["Eventos", String(events.length)],
  ];
  let sx = tx;
  const sy = y + 70;
  for (const [k, v] of stats) {
    doc.setFillColor(248, 248, 250); doc.rect(sx, sy, 80, 40, "F");
    doc.setTextColor(...MUTED); doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text(k.toUpperCase(), sx + 6, sy + 12);
    doc.setTextColor(...DARK); doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text(v, sx + 6, sy + 30);
    sx += 86;
  }

  y += 130;

  // QR Code
  const qrDataUrl = await QRCode.toDataURL(publicUrl, { margin: 0, width: 256, color: { dark: "#111113", light: "#FFFFFF" } });
  const qrSize = 90;
  doc.addImage(qrDataUrl, "PNG", W - M - qrSize, y - 100, qrSize, qrSize);
  doc.setFontSize(7); doc.setTextColor(...MUTED);
  doc.text("Escaneie para validar", W - M - qrSize / 2, y - 5, { align: "center" });

  // Conservation breakdown
  y += 10;
  section(doc, "Índice de Conservação", M, y, W - M * 2);
  y += 18;
  doc.setFontSize(28); doc.setFont("helvetica", "bold"); doc.setTextColor(...ORANGE);
  doc.text(`${conservation.score}`, M, y + 22);
  doc.setFontSize(11); doc.setTextColor(...DARK);
  doc.text(`Nota ${conservation.grade}`, M + 55, y + 22);
  doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal");
  let fy = y;
  for (const f of conservation.factors.slice(0, 6)) {
    const sign = f.delta >= 0 ? "+" : "";
    doc.text(`${sign}${f.delta}  ·  ${f.label}${f.detail ? "  (" + f.detail + ")" : ""}`, M + 120, fy + 10);
    fy += 11;
  }
  y += 70;

  // Health panel
  section(doc, "Painel de saúde", M, y, W - M * 2);
  y += 18;
  const cellW = (W - M * 2) / 4;
  let cx = M, cy = y;
  for (let i = 0; i < health.length; i++) {
    const h = health[i];
    const color: [number, number, number] = h.status === "good" ? [16, 185, 129] : h.status === "warn" ? [234, 179, 8] : [239, 68, 68];
    doc.setDrawColor(...LINE); doc.rect(cx + 2, cy, cellW - 4, 46);
    doc.setFillColor(...color); doc.rect(cx + 2, cy, 3, 46, "F");
    doc.setTextColor(...DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text(h.label, cx + 10, cy + 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text(`${h.score}/100`, cx + 10, cy + 26);
    doc.text(h.reason.slice(0, 30), cx + 10, cy + 38);
    cx += cellW;
    if ((i + 1) % 4 === 0) { cx = M; cy += 52; }
  }
  y = cy + (health.length % 4 === 0 ? 0 : 52) + 10;

  // Upcoming maintenance
  if (upcoming.length > 0) {
    section(doc, "Próximas manutenções críticas", M, y, W - M * 2);
    y += 18;
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...DARK);
    for (const u of upcoming.slice(0, 5)) {
      const tag = u.status === "overdue" ? "VENCIDA" : u.status === "due" ? "DEVIDA" : "EM BREVE";
      const eta = u.estimatedDueDate ? formatDate(u.estimatedDueDate.toISOString()) : "—";
      doc.text(`• ${u.label}`, M, y);
      doc.setTextColor(...MUTED); doc.text(`${tag} · ${MAINT_CATEGORY_LABEL[u.category]} · est. ${eta}`, M + 200, y);
      doc.setTextColor(...DARK);
      y += 14;
    }
    y += 6;
  }

  // History (last events) — paginate
  section(doc, "Histórico de eventos", M, y, W - M * 2);
  y += 16;
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...MUTED);
  doc.text("DATA", M, y); doc.text("TIPO", M + 70, y); doc.text("DESCRIÇÃO", M + 160, y); doc.text("CUSTO", W - M - 40, y);
  y += 6; doc.setDrawColor(...LINE); doc.line(M, y, W - M, y); y += 10;
  doc.setFont("helvetica", "normal"); doc.setTextColor(...DARK); doc.setFontSize(9);
  for (const e of events) {
    if (y > H - 60) { doc.addPage(); y = M; }
    doc.text(formatDate(e.occurred_at), M, y);
    doc.text(EVENT_TYPE_LABEL[e.type] ?? e.type, M + 70, y);
    const desc = (e.title || e.description || "").slice(0, 60);
    doc.text(desc, M + 160, y);
    doc.text(brl(e.cost != null ? Number(e.cost) : null), W - M, y, { align: "right" });
    y += 13;
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE); doc.line(M, H - 36, W - M, H - 36);
    doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal");
    doc.text(`TrailBook · ${publicUrl}`, M, H - 22);
    doc.text(`${attachmentsCount} evidência(s) · ${workshopsCount} oficina(s) registrada(s) · Página ${p}/${pages}`, W - M, H - 22, { align: "right" });
  }

  const brandPart = sanitizeFileName(moto.brand || "", "");
  const modelPart = sanitizeFileName(moto.model || moto.nickname || "", "");
  const tbid = ((moto as unknown as { trailbook_id?: string }).trailbook_id || "").toString();
  const idPart = sanitizeFileName(tbid, "");
  const parts = ["TrailBook", "Certificado", brandPart, modelPart, idPart].filter((p) => p && p.trim().length > 0);
  const fallback = "TrailBook-Certificado-Motocicleta";
  const baseName = parts.length > 2 ? parts.join("-") : fallback;
  const fileName = `${sanitizeFileName(baseName, fallback)}.pdf`;
  const blob = doc.output("blob");
  return { blob, fileName };
}

function section(doc: jsPDF, title: string, x: number, y: number, w: number) {
  doc.setDrawColor(...LINE); doc.line(x, y + 14, x + w, y + 14);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...DARK);
  doc.text(title, x, y + 10);
}

/**
 * Normaliza a foto principal para JPEG via canvas, preservando proporção
 * e limitando a resolução. Retorna null em qualquer falha (HEIC, CORS, etc.)
 * para que o PDF continue sendo gerado com placeholder.
 */
export async function prepareCertPhotoDataUrl(sourceUrl: string, maxSide = 1200): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, { mode: "cors", credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => { URL.revokeObjectURL(url); resolve(el); };
      el.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      el.src = url;
    });
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = tw; canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // fundo neutro para tratar transparência (PNG/WEBP)
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, tw, th);
    ctx.drawImage(img, 0, 0, tw, th);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  }
}