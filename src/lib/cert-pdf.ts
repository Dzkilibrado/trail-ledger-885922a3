import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import {
  brl,
  formatDate,
  EVENT_TYPE_LABEL,
  MAINT_CATEGORY_LABEL,
  type EventRow,
  type Motorcycle,
} from "./trailbook";
import type { ConservationResult, CategoryHealth } from "./conservation";
import type { ScheduleStatus } from "./maintenance-engine";
import { sanitizeFileName } from "./save-file";

// ─── Paleta ──────────────────────────────────────────────────────────────────
const ORANGE: [number, number, number] = [234, 88, 12];
const DARK: [number, number, number] = [17, 17, 19];
const MUTED: [number, number, number] = [120, 120, 130];
const LINE: [number, number, number] = [225, 225, 230];
const GREEN: [number, number, number] = [16, 185, 129];
const YELLOW: [number, number, number] = [234, 179, 8];
const RED: [number, number, number] = [239, 68, 68];
const LIGHT_BG: [number, number, number] = [248, 248, 250];

// ─── Tipos ───────────────────────────────────────────────────────────────────
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
  /** Seções liberadas pelo proprietário — respeitar ao gerar o PDF */
  allowedSections?: string[];
  /** Documentos de origem válidos (doc_type=invoice, is_current=true, deleted_at IS NULL) */
  hasValidInvoice?: boolean;
}

export interface CertPdfOutput {
  blob: Blob;
  fileName: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Traduz score 0–100 para estado oficial TrailBook 4.0 — nunca exibe o número. */
function stateLabel(score: number): string {
  if (score <= 0) return "Sem dados suficientes";
  if (score >= 85) return "Saudável";
  if (score >= 70) return "Atenção";
  if (score >= 50) return "Revisão recomendada";
  return "Necessita ação";
}

/** Frase descritiva alinhada ao estado oficial do TrailBook 4.0. */
function conservationSentence(score: number): string {
  if (score <= 0) return "Ainda não existem informações suficientes para avaliar esta motocicleta.";
  if (score >= 85) return "Os registros indicam acompanhamento consistente desta motocicleta.";
  if (score >= 70) return "Os registros atuais indicam acompanhamento adequado da motocicleta.";
  if (score >= 50) return "A motocicleta possui registros parciais. Recomenda-se programar uma revisão.";
  return "Poucos registros encontrados. Priorize a correção dos itens indicados.";
}

/** Símbolo de status sem peso numérico. */
function factorSymbol(f: { delta: number }): string {
  return f.delta >= 0 ? "✓" : "⚠";
}

/** Rótulo textual para o status da manutenção. */
function upcomingTag(status: string): string {
  if (status === "overdue") return "Vencida";
  if (status === "due") return "Devida";
  return "Em breve";
}

/** Estado oficial de saúde por categoria (TrailBook 4.0). */
function healthLabel(status: string): string {
  if (status === "good") return "Saudável";
  if (status === "warn") return "Atenção";
  return "Necessita ação";
}

/** Cor RGB para o status de saúde. */
function healthColor(status: string): [number, number, number] {
  if (status === "good") return GREEN;
  if (status === "warn") return YELLOW;
  return RED;
}

// ─── Constantes de layout ────────────────────────────────────────────────────
const PAGE_MARGIN = 40;
const PAGE_TOP = PAGE_MARGIN;
const SECTION_GAP = 14;   // espaço entre seções
const HEADER_H = 83;      // altura do cabeçalho da página
const FOOTER_H = 50;      // área reservada para o rodapé

// ─── Cursor vertical ─────────────────────────────────────────────────────────
class Cursor {
  constructor(
    private doc: jsPDF,
    public y: number,
    private margin: number,
  ) {}

  get W() { return this.doc.internal.pageSize.getWidth(); }
  get H() { return this.doc.internal.pageSize.getHeight(); }
  get contentW() { return this.W - this.margin * 2; }

  /** Avança o cursor e quebra página se necessário. */
  advance(delta: number, minRemaining = FOOTER_H + 20) {
    this.y += delta;
    if (this.y > this.H - minRemaining) {
      this.doc.addPage();
      this.y = PAGE_TOP;
    }
  }

  /** Garante que há pelo menos `needed` pts disponíveis antes de renderizar um bloco. */
  ensureSpace(needed: number) {
    if (this.y + needed > this.H - FOOTER_H) {
      this.doc.addPage();
      this.y = PAGE_TOP;
    }
  }
}

// ─── Seção de título ─────────────────────────────────────────────────────────
function renderSectionTitle(doc: jsPDF, cur: Cursor, title: string) {
  cur.ensureSpace(30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(title, PAGE_MARGIN, cur.y);
  cur.y += 4;
  doc.setDrawColor(...LINE);
  doc.line(PAGE_MARGIN, cur.y, PAGE_MARGIN + cur.contentW, cur.y);
  cur.y += SECTION_GAP;
}

// ─── Rodapé em todas as páginas ───────────────────────────────────────────────
function renderFooters(doc: jsPDF, publicUrl: string, workshopsCount: number, attachmentsCount: number) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.line(PAGE_MARGIN, H - 36, W - PAGE_MARGIN, H - 36);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.text(`TrailBook · ${publicUrl}`, PAGE_MARGIN, H - 22);
    doc.text(
      `${attachmentsCount} evidência(s) · ${workshopsCount} oficina(s) · Pág. ${p}/${pages}`,
      W - PAGE_MARGIN,
      H - 22,
      { align: "right" },
    );
  }
}

// ─── Função principal ─────────────────────────────────────────────────────────
export async function generateCertificatePdf(input: CertPdfInput): Promise<CertPdfOutput> {
  const {
    moto,
    events,
    conservation,
    health,
    upcoming,
    publicUrl,
    photoDataUrl,
    attachmentsCount,
    workshopsCount,
    allowedSections = [],
    hasValidInvoice = false,
  } = input;

  const showSection = (k: string) =>
    allowedSections.length === 0 || allowedSections.includes(k);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = PAGE_MARGIN;

  // ── Cabeçalho fixo ──────────────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, HEADER_H - 3, "F");
  doc.setFillColor(...ORANGE);
  doc.rect(0, HEADER_H - 3, W, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("TrailBook", M, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 210);
  doc.text("Prontuário digital", M, 56);
  doc.setFontSize(8);
  doc.text(`Emitido em ${formatDate(new Date().toISOString())}`, W - M, 38, { align: "right" });
  doc.setTextColor(...ORANGE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Certificado Digital", W - M, 56, { align: "right" });

  const cur = new Cursor(doc, HEADER_H + 16, M);

  // ── QR Code (canto superior direito, ao lado do título) ─────────────────────
  const qrSize = 90;
  const qrX = W - M - qrSize;
  const qrY = cur.y;
  try {
    const qrDataUrl = await QRCode.toDataURL(publicUrl, {
      margin: 0,
      width: 256,
      color: { dark: "#111113", light: "#FFFFFF" },
    });
    doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.text("Escaneie para consultar o certificado", qrX + qrSize / 2, qrY + qrSize + 8, {
      align: "center",
      maxWidth: qrSize + 10,
    });
  } catch { /* QR opcional */ }

  // ── Foto + dados da moto ────────────────────────────────────────────────────
  const photoW = 145;
  const photoH = 100;
  const textX = M + photoW + 14;
  const textMaxW = qrX - textX - 10;

  if (photoDataUrl) {
    try {
      doc.addImage(photoDataUrl, "JPEG", M, cur.y, photoW, photoH);
    } catch {
      doc.setFillColor(...LIGHT_BG);
      doc.rect(M, cur.y, photoW, photoH, "F");
    }
  } else {
    doc.setFillColor(...LIGHT_BG);
    doc.rect(M, cur.y, photoW, photoH, "F");
  }

  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const motoName = moto.nickname || `${moto.brand} ${moto.model}`;
  const nameLines = doc.splitTextToSize(motoName, textMaxW) as string[];
  doc.text(nameLines, textX, cur.y + 16);
  const nameLinesH = nameLines.length * 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`${moto.brand} ${moto.model} · ${moto.year_model ?? moto.year_make ?? "—"}`, textX, cur.y + nameLinesH + 6);

  // Quick stats (abaixo do nome, dentro da área de texto)
  const statsY = cur.y + nameLinesH + 22;
  const statItems = [
    ["Horas", `${Number(moto.hours_total ?? 0).toFixed(1)} h`],
    ["KM", `${Number(moto.km_total ?? 0).toLocaleString("pt-BR")} km`],
    ["Conservação", stateLabel(conservation.score)],
  ];
  let sx = textX;
  for (const [label, value] of statItems) {
    const sw = 86;
    doc.setFillColor(...LIGHT_BG);
    doc.rect(sx, statsY, sw, 34, "F");
    doc.setTextColor(...MUTED);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(label.toUpperCase(), sx + 6, statsY + 11);
    doc.setTextColor(...DARK);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    const valueLines = doc.splitTextToSize(value, sw - 10) as string[];
    doc.text(valueLines[0], sx + 6, statsY + 26);
    sx += sw + 4;
  }

  cur.y += Math.max(photoH, nameLinesH + 60) + SECTION_GAP;

  // ── ESTADO DE CONSERVAÇÃO ───────────────────────────────────────────────────
  if (showSection("conservation")) {
    renderSectionTitle(doc, cur, "Estado de Conservação");

    // Estado textual em destaque
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...ORANGE);
    doc.text(stateLabel(conservation.score), M, cur.y);
    cur.y += 16;

    // Frase descritiva
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    const sentence = conservationSentence(conservation.score);
    const sentLines = doc.splitTextToSize(sentence, cur.contentW) as string[];
    doc.text(sentLines, M, cur.y);
    cur.y += sentLines.length * 12 + 10;

    // Fatores — sem pesos numéricos
    const factorItems = conservation.factors
      .slice(0, 5)
      .filter((f) => f.label && f.label.trim())
      .map((f) => [factorSymbol(f), f.label + (f.detail ? ` — ${f.detail}` : "")]);

    if (factorItems.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      doc.text("O QUE ENCONTRAMOS", M, cur.y);
      cur.y += 10;

      for (const [sym, label] of factorItems) {
        cur.ensureSpace(14);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const isPositive = sym === "✓";
        doc.setTextColor(isPositive ? GREEN[0] : YELLOW[0], isPositive ? GREEN[1] : YELLOW[1], isPositive ? GREEN[2] : YELLOW[2]);
        doc.text(sym, M, cur.y);
        doc.setTextColor(...DARK);
        const labelLines = doc.splitTextToSize(label, cur.contentW - 16) as string[];
        doc.text(labelLines, M + 14, cur.y);
        cur.y += labelLines.length * 12;
      }
    }
    cur.y += SECTION_GAP;
  }

  // ── DOCUMENTAÇÃO ────────────────────────────────────────────────────────────
  if (showSection("invoices") || showSection("documents")) {
    renderSectionTitle(doc, cur, "Documentação");

    // Somente informações documentais — sem evidências ou oficinas neste bloco
    const docItems: Array<[boolean, string]> = [
      [hasValidInvoice, "Nota Fiscal"],
    ];

    for (const [present, label] of docItems) {
      cur.ensureSpace(14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(
        present ? GREEN[0] : MUTED[0],
        present ? GREEN[1] : MUTED[1],
        present ? GREEN[2] : MUTED[2],
      );
      doc.text(present ? "✓" : "—", M, cur.y);
      doc.setTextColor(...DARK);
      doc.text(present ? "Nota Fiscal cadastrada" : "Nota Fiscal não cadastrada", M + 14, cur.y);
      cur.y += 14;
    }

    cur.y += SECTION_GAP;
  }

  // ── PAINEL DE SAÚDE ─────────────────────────────────────────────────────────
  if (showSection("health") && health.length > 0) {
    // Previne linha órfã: garante espaço para título + cabeçalho + mínimo 2 linhas
    const healthMinHeight = 30 + 22 + Math.min(health.length, 2) * 22;
    cur.ensureSpace(healthMinHeight);
    renderSectionTitle(doc, cur, "Painel de Saúde");

    const rows = health.map((h) => [
      h.label,
      healthLabel(h.status),
      doc.splitTextToSize(h.reason || "", 180).join(" "),
    ]);

    autoTable(doc, {
      startY: cur.y,
      head: [["Área", "Estado", "Observação"]],
      body: rows,
      margin: { left: M, right: M },
      styles: { fontSize: 8, cellPadding: 5, textColor: DARK },
      headStyles: {
        fillColor: DARK,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 100, fontStyle: "bold" },
        1: { cellWidth: 70 },
        2: { cellWidth: "auto" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 1) {
          const status = health[data.row.index]?.status ?? "good";
          const [r, g, b] = healthColor(status);
          data.cell.styles.textColor = [r, g, b];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    cur.y = (doc as any).lastAutoTable.finalY + SECTION_GAP;
  }

  // ── PRÓXIMAS MANUTENÇÕES ─────────────────────────────────────────────────────
  if (showSection("upcoming") && upcoming.length > 0) {
    // Previne linha órfã: garante espaço para título + cabeçalho + mínimo 2 linhas
    const upcomingMinHeight = 30 + 22 + Math.min(upcoming.length, 2) * 22;
    cur.ensureSpace(upcomingMinHeight);
    renderSectionTitle(doc, cur, "Próximas Manutenções");

    const upcomingSlice = upcoming.slice(0, 5);
    const rows = upcomingSlice.map((u) => [
      doc.splitTextToSize(u.label, 140).join(" "),
      MAINT_CATEGORY_LABEL[u.category] ?? u.category,
      upcomingTag(u.status),
      u.estimatedDueDate ? formatDate(u.estimatedDueDate.toISOString()) : "—",
    ]);

    autoTable(doc, {
      startY: cur.y,
      head: [["Item", "Área", "Status", "Previsão"]],
      body: rows,
      margin: { left: M, right: M },
      styles: { fontSize: 8, cellPadding: 5, textColor: DARK },
      headStyles: {
        fillColor: DARK,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 80 },
        2: { cellWidth: 60, fontStyle: "bold" },
        3: { cellWidth: 70 },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          const status = upcomingSlice[data.row.index]?.status ?? "";
          const color: [number, number, number] =
            status === "overdue" ? RED : status === "due" ? YELLOW : MUTED;
          data.cell.styles.textColor = color;
        }
      },
    });

    cur.y = (doc as any).lastAutoTable.finalY;

    if (upcoming.length > 5) {
      cur.y += 8;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(
        `+ ${upcoming.length - 5} outros cuidados disponíveis no TrailBook.`,
        M,
        cur.y,
      );
      cur.y += 10;
    }

    cur.y += SECTION_GAP;
  }

  // ── HISTÓRICO DE EVENTOS ─────────────────────────────────────────────────────
  if (showSection("history")) {
    // Previne linha órfã: garante espaço para título + cabeçalho + mínimo 2 linhas
    const histMinHeight = 30 + 22 + (events.length > 0 ? 2 * 18 : 20);
    cur.ensureSpace(histMinHeight);
    renderSectionTitle(doc, cur, "Histórico de Eventos");

    if (events.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(
        "Ainda não há eventos registrados no histórico desta motocicleta.",
        M,
        cur.y,
      );
      cur.y += 20;
    } else {
      const cols = showSection("costs")
        ? ["Data", "Evento", "Resumo", "Leitura", "Custo"]
        : ["Data", "Evento", "Resumo", "Leitura"];

      const rows = events.map((e) => {
        const reading = e.hours_at_event != null
          ? `${Number(e.hours_at_event).toFixed(1)} h`
          : e.km_at_event != null
          ? `${Number(e.km_at_event).toLocaleString("pt-BR")} km`
          : "—";
        const title = (e.title || e.description || "").slice(0, 80);
        const base = [
          formatDate(e.occurred_at),
          EVENT_TYPE_LABEL[e.type] ?? e.type,
          doc.splitTextToSize(title, 160).join(" "),
          reading,
        ];
        if (showSection("costs")) base.push(brl(e.cost != null ? Number(e.cost) : null));
        return base;
      });

      autoTable(doc, {
        startY: cur.y,
        head: [cols],
        body: rows,
        margin: { left: M, right: M },
        styles: { fontSize: 7.5, cellPadding: 4, textColor: DARK },
        headStyles: {
          fillColor: DARK,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 7.5,
        },
        columnStyles: showSection("costs")
          ? {
              0: { cellWidth: 55 },
              1: { cellWidth: 70 },
              2: { cellWidth: "auto" },
              3: { cellWidth: 55 },
              4: { cellWidth: 55, halign: "right" },
            }
          : {
              0: { cellWidth: 55 },
              1: { cellWidth: 80 },
              2: { cellWidth: "auto" },
              3: { cellWidth: 60 },
            },
        pageBreak: "auto",
      });

      cur.y = (doc as any).lastAutoTable.finalY + SECTION_GAP;
    }
  }

  // ── Rodapés ──────────────────────────────────────────────────────────────────
  renderFooters(doc, publicUrl, workshopsCount, attachmentsCount);

  // ── Gera o arquivo ────────────────────────────────────────────────────────────
  const brandPart = sanitizeFileName(moto.brand || "", "");
  const modelPart = sanitizeFileName(moto.model || moto.nickname || "", "");
  const tbid = ((moto as unknown as { trailbook_id?: string }).trailbook_id || "").toString();
  const idPart = sanitizeFileName(tbid, "");
  const parts = ["TrailBook", "Certificado", brandPart, modelPart, idPart].filter(
    (p) => p && p.trim().length > 0,
  );
  const fallback = "TrailBook-Certificado-Motocicleta";
  const baseName = parts.length > 2 ? parts.join("-") : fallback;
  const fileName = `${sanitizeFileName(baseName, fallback)}.pdf`;
  const blob = doc.output("blob");
  return { blob, fileName };
}

/**
 * Normaliza a foto principal para JPEG via canvas, preservando proporção
 * e limitando a resolução. Retorna null em qualquer falha (HEIC, CORS, etc.)
 * para que o PDF continue sendo gerado com placeholder.
 */
export async function prepareCertPhotoDataUrl(
  sourceUrl: string,
  maxSide = 1200,
): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, { mode: "cors", credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => {
        URL.revokeObjectURL(url);
        resolve(el);
      };
      el.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      el.src = url;
    });
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, tw, th);
    ctx.drawImage(img, 0, 0, tw, th);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  }
}
