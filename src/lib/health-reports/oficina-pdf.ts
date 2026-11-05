import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate } from "@/lib/trailbook";
import type { HealthReportSnapshot, SnapshotComponent } from "./types";

// ─── Medidas A4 ──────────────────────────────────────────────────────────────
const W = 210;
const H = 297;
const ML = 12; // margem esquerda
const MR = 12; // margem direita
const MT = 12; // margem topo
const MB = 14; // margem base

// ─── Paleta ──────────────────────────────────────────────────────────────────
const COLOR = {
  bg:          [255, 255, 255] as [number, number, number],
  ink:         [20,  20,  20]  as [number, number, number],
  muted:       [100, 100, 100] as [number, number, number],
  border:      [210, 210, 210] as [number, number, number],
  // cabeçalhos de grupo
  headerVenc:  [220, 38,  38]  as [number, number, number], // vermelho — vencido / ação imediata
  headerAtenc: [217, 119, 6]   as [number, number, number], // âmbar — atenção
  headerProx:  [37,  99,  235] as [number, number, number], // azul — próximo a vencer
  // texto sobre fundo colorido
  headerText:  [255, 255, 255] as [number, number, number],
  // linhas zebradas
  rowAlt:      [249, 249, 249] as [number, number, number],
};

// ─── Classificação dos itens ─────────────────────────────────────────────────
/**
 * Regras para "próximo a vencer":
 * - status === "ok" mas lifeRemainingPct <= 25 %  →  próximo a vencer
 *   (25 % equivale a ~1 intervalo de uso típico de folga antes do vencimento)
 */
function classify(c: SnapshotComponent): "action" | "attention" | "upcoming" | null {
  if (c.status === "action")     return "action";
  if (c.status === "attention")  return "attention";
  if (
    c.status === "ok" &&
    c.lifeRemainingPct !== null &&
    c.lifeRemainingPct <= 25
  )                              return "upcoming";
  return null; // ok e confortável → não exibir
}

// ─── Título de grupo ──────────────────────────────────────────────────────────
const GROUP_LABEL: Record<string, string> = {
  action:    "VENCIDO / AÇÃO IMEDIATA",
  attention: "ATENÇÃO",
  upcoming:  "PRÓXIMO A VENCER",
};
const GROUP_COLOR: Record<string, [number, number, number]> = {
  action:    COLOR.headerVenc,
  attention: COLOR.headerAtenc,
  upcoming:  COLOR.headerProx,
};

// ─── Helpers de desenho ───────────────────────────────────────────────────────
function checkbox(doc: jsPDF, x: number, y: number, size = 3.8) {
  doc.setDrawColor(...COLOR.border);
  doc.setFillColor(...COLOR.bg);
  doc.rect(x, y - size + 0.5, size, size, "FD");
}

function rodape(doc: jsPDF, code: string, docTitle: string) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR.muted);
    doc.text(`${docTitle} · Código: ${code}`, ML, H - 6);
    doc.text(`Página ${i} / ${pages}`, W - MR, H - 6, { align: "right" });
    doc.setDrawColor(...COLOR.border);
    doc.line(ML, H - MB + 2, W - MR, H - MB + 2);
    doc.setFontSize(7);
    doc.text(
      "TrailBook — Este checklist é gerado automaticamente com base nos dados registrados no sistema. " +
      "Não substitui avaliação técnica presencial do profissional responsável.",
      ML,
      H - 4,
      { maxWidth: W - ML - MR },
    );
  }
}

// ─── Função principal ─────────────────────────────────────────────────────────
export async function buildOficinaChecklistPdf(input: {
  snapshot: HealthReportSnapshot;
  code: string;
  sha256: string;
  statusLabel: string;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
}): Promise<Blob> {
  const { snapshot: s, code } = input;
  const docTitle = s.reportTitle ?? "Checklist de Manutenção — Oficina";
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // ── 1. CABEÇALHO ────────────────────────────────────────────────────────────
  // Faixa escura
  doc.setFillColor(17, 24, 39);
  doc.rect(0, 0, W, 46, "F");

  doc.setTextColor(...COLOR.headerText);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("TrailBook", ML, 14);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(docTitle, ML, 21);

  doc.setFontSize(8.5);
  doc.setTextColor(180, 180, 180);
  doc.text(`Código: ${code}`, ML, 28);
  doc.text(`Emitido em: ${formatDate(s.issuedAt)}`, ML, 34);
  doc.text(`Situação geral: ${s.overall.statusLabel}`, ML, 40);

  // Coluna direita: validade
  doc.setTextColor(180, 180, 180);
  doc.text(`Válido: ${s.validity.label}`, W - MR, 28, { align: "right" });
  doc.text(`Código SHA-256:`, W - MR, 34, { align: "right" });
  doc.setFontSize(7);
  doc.text(input.sha256.slice(0, 24) + "…", W - MR, 38.5, { align: "right" });

  let y = 52;

  // ── 2. DADOS DA MOTO ─────────────────────────────────────────────────────────
  const moto = s.motorcycle;
  const motoName = [moto.brand, moto.model].filter(Boolean).join(" ");
  const motoYear = [moto.yearMake, moto.yearModel].filter(Boolean).join("/");

  doc.setFillColor(240, 244, 248);
  doc.setDrawColor(...COLOR.border);
  doc.rect(ML, y, W - ML - MR, 28, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.ink);
  doc.text("DADOS DA MOTOCICLETA", ML + 3, y + 6);

  const col1X = ML + 3;
  const col2X = W / 2 + 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR.ink);

  // Coluna 1
  doc.setFont("helvetica", "bold"); doc.text("Modelo:", col1X, y + 13); doc.setFont("helvetica", "normal");
  doc.text(motoName || "—", col1X + 16, y + 13);

  doc.setFont("helvetica", "bold"); doc.text("Ano:", col1X, y + 19); doc.setFont("helvetica", "normal");
  doc.text(motoYear || "—", col1X + 10, y + 19);

  doc.setFont("helvetica", "bold"); doc.text("Placa:", col1X, y + 25); doc.setFont("helvetica", "normal");
  doc.text(moto.plate || "—", col1X + 12, y + 25);

  // Coluna 2
  doc.setFont("helvetica", "bold"); doc.text("Horímetro:", col2X, y + 13); doc.setFont("helvetica", "normal");
  doc.text(`${Number(moto.hoursTotal).toFixed(1)} h`, col2X + 22, y + 13);

  doc.setFont("helvetica", "bold"); doc.text("ID TrailBook:", col2X, y + 19); doc.setFont("helvetica", "normal");
  doc.text(moto.trailbookId || "—", col2X + 26, y + 19);

  if (moto.chassisMasked) {
    doc.setFont("helvetica", "bold"); doc.text("Chassi:", col2X, y + 25); doc.setFont("helvetica", "normal");
    doc.text(moto.chassisMasked, col2X + 15, y + 25);
  }

  y += 32;

  // ── 3. DADOS DO PROPRIETÁRIO ─────────────────────────────────────────────────
  const ownerName  = input.ownerName  ?? s.owner?.name ?? null;
  const ownerPhone = input.ownerPhone ?? null;
  const ownerEmail = input.ownerEmail ?? null;

  if (ownerName || ownerPhone || ownerEmail) {
    doc.setFillColor(240, 244, 248);
    doc.setDrawColor(...COLOR.border);
    doc.rect(ML, y, W - ML - MR, 20, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR.ink);
    doc.text("DADOS DO PROPRIETÁRIO", ML + 3, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);

    const pItems = [
      ownerName  ? `Nome: ${ownerName}`   : null,
      ownerPhone ? `Tel.: ${ownerPhone}`  : null,
      ownerEmail ? `E-mail: ${ownerEmail}`: null,
    ].filter(Boolean) as string[];

    pItems.forEach((item, i) => {
      const px = i < 2 ? col1X : col2X;
      const row = i < 2 ? i : 0;
      const baseY = i === 0 ? col1X : (i === 1 ? col2X : col2X);
      doc.text(item, ML + 3 + (i === 2 ? W / 2 - ML : 0), y + 13 + (i < 2 ? (i * 5) : 0));
    });

    y += 24;
  }

  // ── 4. INSTRUÇÃO AO MECÂNICO ─────────────────────────────────────────────────
  doc.setFillColor(255, 251, 235); // âmbar clarinho
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.5);
  doc.rect(ML, y, W - ML - MR, 11, "FD");
  doc.setLineWidth(0.2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(120, 60, 0);
  doc.text(
    "⚠  Este checklist lista APENAS os itens que requerem atenção do mecânico. " +
    "Para cada item, marque SIM (executado) ou NÃO (pendente) e use o campo de observação se necessário.",
    ML + 3,
    y + 4.5,
    { maxWidth: W - ML - MR - 6 },
  );

  y += 15;

  // ── 5. SEPARAÇÃO E AGRUPAMENTO ───────────────────────────────────────────────
  const groups: Record<string, SnapshotComponent[]> = {
    action:    [],
    attention: [],
    upcoming:  [],
  };
  for (const c of s.components) {
    const cls = classify(c);
    if (cls) groups[cls].push(c);
  }

  const totalItems = groups.action.length + groups.attention.length + groups.upcoming.length;

  if (totalItems === 0) {
    // Tudo ok — sem itens para listar
    doc.setFillColor(220, 252, 231);
    doc.setDrawColor(134, 239, 172);
    doc.rect(ML, y, W - ML - MR, 20, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(21, 128, 61);
    doc.text("✓  Nenhum item crítico identificado", ML + 4, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Todos os componentes estão dentro do prazo de manutenção.", ML + 4, y + 14);
    y += 24;
  } else {
    // ── Resumo rápido (badges) ──────────────────────────────────────────────
    const badgeData = [
      { label: "Vencidos",         count: groups.action.length,    color: COLOR.headerVenc },
      { label: "Atenção",          count: groups.attention.length,  color: COLOR.headerAtenc },
      { label: "Próx. a vencer",   count: groups.upcoming.length,   color: COLOR.headerProx },
    ];

    const bW = (W - ML - MR - 6) / 3;
    badgeData.forEach(({ label, count, color }, i) => {
      const bx = ML + i * (bW + 3);
      doc.setFillColor(...color);
      doc.roundedRect(bx, y, bW, 10, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text(String(count), bx + bW / 2 - 5, y + 7);
      doc.setFontSize(7.5);
      doc.text(label, bx + bW / 2 + 2, y + 7, { align: "left" });
    });

    y += 14;

    // ── Tabelas por grupo ───────────────────────────────────────────────────
    for (const groupKey of ["action", "attention", "upcoming"] as const) {
      const items = groups[groupKey];
      if (!items.length) continue;

      // Título do grupo
      const groupColor = GROUP_COLOR[groupKey];
      doc.setFillColor(...groupColor);
      doc.rect(ML, y, W - ML - MR, 7.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text(GROUP_LABEL[groupKey], ML + 3, y + 5.2);

      // Contagem
      doc.text(`${items.length} item${items.length > 1 ? "s" : ""}`, W - MR - 3, y + 5.2, {
        align: "right",
      });

      y += 7.5;

      // Tabela com autoTable
      const rows = items.map((c, idx) => {
        const statusInfo = c.lifeRemainingPct !== null
          ? `${c.lifeRemainingPct.toFixed(0)}% restante`
          : c.dueEstimateLabel || c.lifeRemainingLabel || "—";
        return [
          String(idx + 1),
          c.name,
          c.categoryLabel || "—",
          statusInfo,
          c.nextAction || c.conclusion || "—",
          "", // SIM (checkbox)
          "", // NÃO (checkbox)
          "", // Observação (campo livre)
        ];
      });

      // larguras: nº | nome | categoria | prazo | ação | SIM | NÃO | Observação
      const colWidths = [7, 42, 25, 24, 42, 10, 10, 26];

      (autoTable as any)(doc, {
        startY: y,
        margin: { left: ML, right: MR },
        tableWidth: W - ML - MR,
        styles: {
          font: "helvetica",
          fontSize: 7.8,
          cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
          textColor: COLOR.ink,
          lineColor: COLOR.border,
          lineWidth: 0.2,
          overflow: "linebreak",
          valign: "middle",
        },
        headStyles: {
          fillColor: [245, 245, 245],
          textColor: COLOR.ink,
          fontStyle: "bold",
          fontSize: 7.5,
          lineColor: COLOR.border,
          lineWidth: 0.3,
        },
        alternateRowStyles: {
          fillColor: COLOR.rowAlt,
        },
        columnStyles: {
          0: { cellWidth: colWidths[0], halign: "center" },
          1: { cellWidth: colWidths[1] },
          2: { cellWidth: colWidths[2] },
          3: { cellWidth: colWidths[3] },
          4: { cellWidth: colWidths[4] },
          5: { cellWidth: colWidths[5], halign: "center" },
          6: { cellWidth: colWidths[6], halign: "center" },
          7: { cellWidth: colWidths[7] },
        },
        head: [["#", "Item / Componente", "Categoria", "Prazo / Vida útil", "Ação recomendada", "SIM", "NÃO", "Observação"]],
        body: rows,
        didDrawCell: (data: any) => {
          // Desenha checkboxes nas colunas SIM (5) e NÃO (6)
          if (data.section === "body" && (data.column.index === 5 || data.column.index === 6)) {
            const { x, y: cy, width, height } = data.cell;
            const size = 3.5;
            const cx = x + (width - size) / 2;
            const cboxY = cy + (height - size) / 2;
            doc.setDrawColor(120, 120, 120);
            doc.setFillColor(255, 255, 255);
            doc.rect(cx, cboxY, size, size, "FD");
          }
        },
        didDrawPage: () => {
          /* rodapé tratado separadamente */
        },
      });

      y = ((doc as any).lastAutoTable?.finalY ?? y) + 5;
    }
  }

  // ── 6. CAMPO DE ASSINATURA ───────────────────────────────────────────────────
  // Garantir que cabe na página atual, senão adiciona nova
  if (y + 40 > H - MB - 15) {
    doc.addPage();
    y = MT;
  }

  y += 4;
  doc.setDrawColor(...COLOR.border);
  doc.line(ML, y + 18, ML + 70, y + 18);
  doc.line(ML + 80, y + 18, ML + 150, y + 18);
  doc.line(ML + 160, y + 18, W - MR, y + 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR.muted);
  doc.text("Mecânico responsável", ML, y + 22);
  doc.text("Data de entrada / saída", ML + 80, y + 22);
  doc.text("Proprietário / Autorização", ML + 160, y + 22);

  // ── 7. RODAPÉ ────────────────────────────────────────────────────────────────
  rodape(doc, code, docTitle);

  return doc.output("blob");
}

/** Nome de arquivo para o checklist de oficina */
export function oficinaChecklistFileName(code: string, issuedAt: string) {
  const d = new Date(issuedAt);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `Checklist-Oficina-TrailBook-${code}-${iso}.pdf`;
}
