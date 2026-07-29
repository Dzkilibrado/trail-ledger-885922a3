import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate } from "@/lib/trailbook";
import type { HealthReportSnapshot } from "./types";

const M = 15;
const W = 210;
const H = 297;

const STATUS_TEXT: Record<string, string> = {
  ok: "OK",
  attention: "Atencao",
  action: "Necessita acao",
  unknown: "Sem dados",
};

/**
 * PDF oficial do Laudo Inteligente TrailBook.
 * Fonte de dados: EXCLUSIVAMENTE o snapshot emitido.
 */
export async function buildReportPdf(input: {
  snapshot: HealthReportSnapshot;
  code: string;
  sha256: string;
  statusLabel: string;
  qrDataUrl?: string | null;
  publicUrl?: string | null;
  photoDataUrl?: string | null;
}): Promise<Blob> {
  const { snapshot: s, code } = input;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const footer = () => {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Laudo Inteligente TrailBook · ${code}`, M, H - 8);
      doc.text(`Página ${i} de ${pages}`, W - M, H - 8, { align: "right" });
      doc.setDrawColor(225);
      doc.line(M, H - 12, W - M, H - 12);
    }
  };

  let y = M;
  const ensure = (need: number) => {
    if (y + need > H - 20) {
      doc.addPage();
      y = M;
    }
  };
  const title = (t: string) => {
    ensure(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text(t, M, y);
    y += 2;
    doc.setDrawColor(200);
    doc.line(M, y, W - M, y);
    y += 6;
  };
  const para = (t: string, size = 10) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(50);
    const lines = doc.splitTextToSize(t, W - M * 2);
    for (const line of lines) {
      ensure(6);
      doc.text(line, M, y);
      y += 5;
    }
    y += 1;
  };
  const bullets = (list: string[]) => {
    for (const item of list) para(`•  ${item}`);
  };

  // ---------- Capa ----------
  doc.setFillColor(17, 24, 39);
  doc.rect(0, 0, W, 58, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("TrailBook", M, 24);
  doc.setFontSize(13);
  doc.text("Laudo Inteligente da Motocicleta", M, 33);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Código: ${code}`, M, 43);
  doc.text(`Emitido em: ${formatDate(s.issuedAt)}`, M, 49);
  doc.text(`Situação: ${input.statusLabel}`, W - M, 43, { align: "right" });
  doc.text(`Estado geral: ${s.overall.statusLabel}`, W - M, 49, { align: "right" });

  y = 68;
  if (input.photoDataUrl) {
    try {
      doc.addImage(input.photoDataUrl, "JPEG", M, y, 60, 40);
    } catch {
      /* foto opcional */
    }
  }
  const infoX = input.photoDataUrl ? M + 66 : M;
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${s.motorcycle.brand} ${s.motorcycle.model}`, infoX, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  const ident = [
    s.motorcycle.nickname ? `Apelido: ${s.motorcycle.nickname}` : null,
    s.motorcycle.yearMake || s.motorcycle.yearModel
      ? `Ano: ${s.motorcycle.yearMake ?? "—"}/${s.motorcycle.yearModel ?? "—"}`
      : null,
    s.motorcycle.plate ? `Placa: ${s.motorcycle.plate}` : null,
    s.motorcycle.chassisMasked ? `Chassi: ${s.motorcycle.chassisMasked}` : null,
    `Horas: ${s.motorcycle.hoursTotal} h · Km: ${s.motorcycle.kmTotal}`,
    s.motorcycle.trailbookId ? `ID TrailBook: ${s.motorcycle.trailbookId}` : null,
  ].filter(Boolean) as string[];
  let iy = y + 13;
  for (const line of ident) {
    doc.text(line, infoX, iy);
    iy += 5;
  }
  y = Math.max(iy, y + 44) + 6;

  // ---------- Resumo ----------
  title("Resumo geral");
  para(s.overall.headline);
  para(`Índice de Conservação: ${s.indices.conservation} · Confiabilidade: ${s.indices.confidenceLabel}`);

  title("Posso rodar hoje?");
  para(`${s.rideAnswer.title} — ${s.rideAnswer.message}`);
  if (s.rideAnswer.rationale) para(s.rideAnswer.rationale);
  para(
    `Itens críticos: ${s.rideAnswer.counts.critical} · Em atenção: ${s.rideAnswer.counts.attention} · OK: ${s.rideAnswer.counts.ok} · Sem dados: ${s.rideAnswer.counts.unknown}`,
  );

  // ---------- Componentes ----------
  ensure(30);
  title("Diagnóstico por componente");
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 20 },
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, overflow: "linebreak", textColor: 40 },
    headStyles: { fillColor: [17, 24, 39], textColor: 255, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 26 }, 3: { cellWidth: 24 } },
    head: [["Componente", "Situação", "Conclusão", "Confiabilidade"]],
    body: s.components.map((c) => [
      c.name,
      STATUS_TEXT[c.status] ?? c.statusLabel,
      c.conclusion || c.nextAction || "—",
      c.confidenceLabel,
    ]),
    didDrawPage: () => {
      /* paginação tratada no rodapé */
    },
  });
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 8;

  // ---------- Plano de ação ----------
  if (s.recommendations.length) {
    ensure(24);
    title("Plano de Ação");
    const groups = new Map<string, typeof s.recommendations>();
    for (const r of s.recommendations) {
      const list = groups.get(r.groupLabel) ?? [];
      list.push(r);
      groups.set(r.groupLabel, list);
    }
    for (const [group, list] of groups) {
      ensure(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(20);
      doc.text(group, M, y);
      y += 5;
      bullets(list.map((r) => `${r.title}: ${r.recommendation}`));
      y += 2;
    }
  }

  // ---------- Histórico ----------
  ensure(24);
  title("Histórico resumido");
  if (s.history.lastMaintenances.length) {
    bullets(s.history.lastMaintenances.map((m) => `${formatDate(m.date)} — ${m.title} (${m.type})`));
  } else {
    para("Nenhuma manutenção registrada até a emissão deste laudo.");
  }
  if (s.history.incidents.length) {
    para("Ocorrências:");
    bullets(s.history.incidents.map((i) => `${formatDate(i.date)} — ${i.title}`));
  }
  para(`Total de registros na linha do tempo: ${s.history.totalEvents}`);

  // ---------- Índices ----------
  ensure(24);
  title("Índices");
  para(`Índice de Conservação: ${s.indices.conservation}. ${s.indices.conservationExplanation}`);
  para(`Confiabilidade: ${s.indices.confidenceLabel}. ${s.indices.confidenceExplanation}`);

  // ---------- Ressalvas ----------
  ensure(24);
  title("Ressalvas");
  if (s.reservations.length) bullets(s.reservations);
  else para("Nenhuma ressalva registrada na emissão.");
  if (s.conflicts.length) {
    para("Conflitos identificados:");
    bullets(s.conflicts);
  }
  if (s.missingData.length) {
    para("Dados ausentes:");
    bullets(s.missingData.slice(0, 20));
  }

  // ---------- Validade e integridade ----------
  ensure(30);
  title("Validade");
  para(s.validity.label);
  para(s.validity.reason);
  if (s.validity.hoursLimit != null) para(`Limite de horas: ${s.validity.hoursLimit} h`);
  if (s.validity.kmLimit != null) para(`Limite de quilometragem: ${s.validity.kmLimit} km`);

  ensure(40);
  title("Informações do laudo");
  para(`Código: ${code}`);
  para(`Hash SHA-256: ${input.sha256}`, 8.5);
  para(`Formato: ${s.formatVersion} · TIL: ${s.tilVersion} · Regras: ${s.ruleVersion}`);
  para(`Emissão: ${formatDate(s.issuedAt)} (${s.timezone})`);
  para(`Fontes de dados: ${s.dataSources.join("; ")}`);

  if (input.qrDataUrl) {
    ensure(42);
    try {
      doc.addImage(input.qrDataUrl, "PNG", M, y, 32, 32);
    } catch {
      /* QR opcional */
    }
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text("Verificação pública deste laudo:", M + 38, y + 10);
    if (input.publicUrl) doc.text(input.publicUrl, M + 38, y + 16, { maxWidth: W - M - 40 });
    y += 38;
  }

  ensure(24);
  title("Aviso importante");
  para(s.disclaimer, 9);

  footer();
  return doc.output("blob");
}

/** Nome de arquivo previsível: Laudo-TrailBook-[codigo]-[data].pdf */
export function reportFileName(code: string, issuedAt: string) {
  const d = new Date(issuedAt);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `Laudo-TrailBook-${code}-${iso}.pdf`;
}