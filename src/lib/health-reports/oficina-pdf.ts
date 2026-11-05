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
const MB = 16; // margem base (espaço para rodapé)

// ─── Paleta ──────────────────────────────────────────────────────────────────
const COLOR = {
  bg:          [255, 255, 255] as [number, number, number],
  ink:         [20,  20,  20]  as [number, number, number],
  muted:       [100, 100, 100] as [number, number, number],
  border:      [210, 210, 210] as [number, number, number],
  headerDark:  [17,  24,  39]  as [number, number, number],
  headerText:  [255, 255, 255] as [number, number, number],
  boxBg:       [240, 244, 248] as [number, number, number],
  // grupos
  groupVenc:  [220, 38,  38]  as [number, number, number],
  groupAtenc: [217, 119, 6]   as [number, number, number],
  groupProx:  [37,  99,  235] as [number, number, number],
  // linhas zebradas leves
  rowAlt:      [249, 249, 249] as [number, number, number],
};

// ─── Classificação dos itens ─────────────────────────────────────────────────
/**
 * Regras:
 *  "action"    → status === "action"  (vencido / sem dados de vida útil negativos)
 *  "attention" → status === "attention"
 *  "upcoming"  → status === "ok" mas lifeRemainingPct <= 25 %
 *                (≈ 1 ciclo de uso típico antes de vencer)
 *  null        → ok e confortável → não exibir
 */
function classify(c: SnapshotComponent): "action" | "attention" | "upcoming" | null {
  if (c.status === "action")    return "action";
  if (c.status === "attention") return "attention";
  if (c.status === "ok" && c.lifeRemainingPct !== null && c.lifeRemainingPct <= 25)
    return "upcoming";
  return null;
}

// ─── Rótulos por grupo ────────────────────────────────────────────────────────
const GROUP_LABEL: Record<string, string> = {
  action:    "VENCIDO / AÇÃO IMEDIATA",
  attention: "ATENÇÃO",
  upcoming:  "PRÓXIMO A VENCER",
};
const GROUP_COLOR: Record<string, [number, number, number]> = {
  action:    COLOR.groupVenc,
  attention: COLOR.groupAtenc,
  upcoming:  COLOR.groupProx,
};

// ─── Texto de prazo / vida útil ──────────────────────────────────────────────
/**
 * Constrói o texto da coluna "Prazo / Vida útil".
 * Prioriza o texto descritivo (labels) em vez do número bruto de %.
 */
function prazoLabel(c: SnapshotComponent): string {
  if (c.dueEstimateLabel && c.dueEstimateLabel.trim())    return c.dueEstimateLabel;
  if (c.lifeRemainingLabel && c.lifeRemainingLabel.trim()) return c.lifeRemainingLabel;
  if (c.remainingLabel && c.remainingLabel.trim())         return c.remainingLabel;
  if (c.lifeRemainingPct !== null) {
    const pct = Math.max(0, Math.round(c.lifeRemainingPct));
    return pct === 0 ? "Vida útil esgotada" : `${pct}% de vida restante`;
  }
  return "-";
}

// ─── Texto de ação recomendada ────────────────────────────────────────────────
/**
 * Texto da coluna "Ação recomendada".
 * Usa o texto mais descritivo disponível; evita strings genéricas curtas.
 */
function acaoLabel(c: SnapshotComponent, grupo: string): string {
  // conclusion tende a ser a frase mais completa e específica
  if (c.conclusion && c.conclusion.trim() && c.conclusion.length > 10)
    return c.conclusion;
  // nextAction também é bom
  if (c.nextAction && c.nextAction.trim() && c.nextAction.length > 5)
    return c.nextAction;
  // fallback por grupo
  if (grupo === "action")    return "Manutenção imediata necessária";
  if (grupo === "attention") return "Verificar e agendar manutenção";
  return "Verificar no próximo uso";
}

// ─── Rodapé ───────────────────────────────────────────────────────────────────
function rodape(doc: jsPDF, code: string, docTitle: string) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const lineY = H - MB + 1;
    doc.setDrawColor(...COLOR.border);
    doc.setLineWidth(0.2);
    doc.line(ML, lineY, W - MR, lineY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR.muted);
    doc.text(`${docTitle} - Codigo: ${code}`, ML, lineY + 4);
    doc.text(`Página ${i} / ${pages}`, W - MR, lineY + 4, { align: "right" });
    doc.setFontSize(6.5);
    doc.text(
      "TrailBook - Checklist gerado automaticamente. Nao substitui avaliacao tecnica presencial do profissional responsavel.",
      ML,
      lineY + 8,
      { maxWidth: W - ML - MR },
    );
  }
}

// ─── Bloco retangular com rótulo ──────────────────────────────────────────────
function drawBox(
  doc: jsPDF,
  y: number,
  h: number,
  fillColor: [number, number, number],
  borderColor: [number, number, number] = COLOR.border,
) {
  doc.setFillColor(...fillColor);
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.rect(ML, y, W - ML - MR, h, "FD");
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
  const docTitle = "Checklist de Manutencao - Oficina";
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // ── 1. CABEÇALHO ─────────────────────────────────────────────────────────────
  doc.setFillColor(...COLOR.headerDark);
  doc.rect(0, 0, W, 44, "F");

  doc.setTextColor(...COLOR.headerText);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("TrailBook", ML, 13);

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.text(docTitle, ML, 20);

  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(`Código: ${code}`, ML, 27);
  doc.text(`Emitido em: ${formatDate(s.issuedAt)}`, ML, 33);
  doc.text(`Situação geral: ${s.overall.statusLabel}`, ML, 39);

  // Coluna direita
  doc.text(`Válido: ${s.validity.label}`, W - MR, 27, { align: "right" });
  doc.setFontSize(7.5);
  doc.text("SHA-256:", W - MR, 33, { align: "right" });
  doc.setFontSize(7);
  doc.text(input.sha256.slice(0, 28) + "...", W - MR, 38, { align: "right" });

  let y = 49;

  // ── 2. DADOS DA MOTO ─────────────────────────────────────────────────────────
  const moto = s.motorcycle;
  const motoName = [moto.brand, moto.model].filter(Boolean).join(" ") || "-";
  const motoYear = [moto.yearMake, moto.yearModel]
    .filter(Boolean)
    .join("/") || "-";

  drawBox(doc, y, 30, COLOR.boxBg);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR.ink);
  doc.text("DADOS DA MOTOCICLETA", ML + 3, y + 6);

  const col1X = ML + 3;
  const col2X = W / 2 + 2;
  doc.setFontSize(8);

  // Linha 1
  doc.setFont("helvetica", "bold"); doc.text("Modelo:", col1X, y + 13);
  doc.setFont("helvetica", "normal"); doc.text(motoName, col1X + 16, y + 13);
  doc.setFont("helvetica", "bold"); doc.text("Horímetro:", col2X, y + 13);
  doc.setFont("helvetica", "normal"); doc.text(`${Number(moto.hoursTotal).toFixed(1)} h`, col2X + 23, y + 13);

  // Linha 2
  doc.setFont("helvetica", "bold"); doc.text("Ano:", col1X, y + 20);
  doc.setFont("helvetica", "normal"); doc.text(motoYear, col1X + 10, y + 20);
  doc.setFont("helvetica", "bold"); doc.text("ID TrailBook:", col2X, y + 20);
  doc.setFont("helvetica", "normal"); doc.text(moto.trailbookId || "-", col2X + 27, y + 20);

  // Linha 3
  doc.setFont("helvetica", "bold"); doc.text("Placa:", col1X, y + 27);
  doc.setFont("helvetica", "normal"); doc.text(moto.plate || "-", col1X + 13, y + 27);
  if (moto.chassisMasked) {
    doc.setFont("helvetica", "bold"); doc.text("Chassi:", col2X, y + 27);
    doc.setFont("helvetica", "normal"); doc.text(moto.chassisMasked, col2X + 15, y + 27);
  }

  y += 34;

  // ── 3. DADOS DO PROPRIETÁRIO ──────────────────────────────────────────────────
  const ownerName = input.ownerName ?? s.owner?.name ?? null;
  const ownerPhone = input.ownerPhone ?? null;
  const ownerEmail = input.ownerEmail ?? null;

  if (ownerName || ownerPhone || ownerEmail) {
    const propItems = [
      ownerName  ? `Nome: ${ownerName}`    : null,
      ownerPhone ? `Tel.: ${ownerPhone}`   : null,
      ownerEmail ? `E-mail: ${ownerEmail}` : null,
    ].filter(Boolean) as string[];

    const boxH = 10 + propItems.length * 6;
    drawBox(doc, y, boxH, COLOR.boxBg);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR.ink);
    doc.text("DADOS DO PROPRIETÁRIO", ML + 3, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    // dois itens em colunas, terceiro na coluna 2
    if (propItems.length <= 2) {
      propItems.forEach((txt, i) => {
        doc.text(txt, col1X, y + 12 + i * 6);
      });
    } else {
      doc.text(propItems[0], col1X,  y + 12);
      doc.text(propItems[1], col1X,  y + 18);
      doc.text(propItems[2], col2X,  y + 12);
    }

    y += boxH + 4;
  }

  // ── 4. INSTRUÇÃO AO MECÂNICO ──────────────────────────────────────────────────
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.5);
  doc.rect(ML, y, W - ML - MR, 12, "FD");
  doc.setLineWidth(0.2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(120, 60, 0);
  doc.text(
    "ATENCAO: Este checklist exibe APENAS os itens que requerem atencao ou manutencao. " +
    "Para cada item: marque [SIM] se o servico foi executado " +
    "ou [NAO] se esta pendente. Utilize o campo Observacao para detalhes.",
    ML + 3,
    y + 4.5,
    { maxWidth: W - ML - MR - 6 },
  );

  y += 16;

  // ── 5. SEPARAÇÃO E AGRUPAMENTO ────────────────────────────────────────────────
  const groups: Record<"action" | "attention" | "upcoming", SnapshotComponent[]> = {
    action:    [],
    attention: [],
    upcoming:  [],
  };
  for (const c of s.components) {
    const cls = classify(c);
    if (cls) groups[cls].push(c);
  }

  const totalItems =
    groups.action.length + groups.attention.length + groups.upcoming.length;

  // ── 5a. Sem itens críticos ────────────────────────────────────────────────────
  if (totalItems === 0) {
    drawBox(doc, y, 20, [220, 252, 231], [134, 239, 172]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(21, 128, 61);
    doc.text("OK - Nenhum item critico identificado", ML + 4, y + 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(
      "Todos os componentes estão dentro do prazo de manutenção.",
      ML + 4,
      y + 15,
    );
    y += 24;
  } else {
    // ── 5b. Badges de resumo ──────────────────────────────────────────────────
    const badges = [
      { label: "Vencidos",       count: groups.action.length,    color: COLOR.groupVenc },
      { label: "Atenção",        count: groups.attention.length,  color: COLOR.groupAtenc },
      { label: "Próx. a vencer", count: groups.upcoming.length,   color: COLOR.groupProx },
    ];

    const bW = (W - ML - MR - 6) / 3;
    badges.forEach(({ label, count, color }, i) => {
      const bx = ML + i * (bW + 3);
      doc.setFillColor(...color);
      doc.roundedRect(bx, y, bW, 11, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(255, 255, 255);
      doc.text(String(count), bx + 8, y + 7.5);
      doc.setFontSize(7.5);
      doc.text(label, bx + 18, y + 7.5);
    });

    y += 15;

    // ── 5c. Tabelas por grupo ─────────────────────────────────────────────────
    for (const groupKey of ["action", "attention", "upcoming"] as const) {
      const items = groups[groupKey];
      if (!items.length) continue;

      const groupColor = GROUP_COLOR[groupKey];

      // Título do grupo
      doc.setFillColor(...groupColor);
      doc.rect(ML, y, W - ML - MR, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(GROUP_LABEL[groupKey], ML + 3, y + 5);
      doc.text(
        `${items.length} item${items.length > 1 ? "s" : ""}`,
        W - MR - 3,
        y + 5,
        { align: "right" },
      );
      y += 7;

      // Linhas da tabela
      const rows = items.map((c, idx) => [
        String(idx + 1),
        c.name,
        c.categoryLabel || "-",
        prazoLabel(c),
        acaoLabel(c, groupKey),
        "", // SIM
        "", // NÃO
        "", // Observação
      ]);

      // larguras (total = W - ML - MR = 186):
      //  # | Item/Componente | Categoria | Prazo | Ação | SIM | NÃO | Observação
      //  6 |      40         |    22     |  30   |  40  | 12  | 12  |    24
      const colWidths = [6, 40, 22, 30, 40, 12, 12, 24];

      (autoTable as any)(doc, {
        startY: y,
        margin: { left: ML, right: MR },
        tableWidth: W - ML - MR,
        rowPageBreak: "avoid",   // nunca quebra uma linha no meio entre páginas
        styles: {
          font: "helvetica",
          fontSize: 7.5,
          cellPadding: { top: 2.8, bottom: 2.8, left: 2, right: 2 },
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
          fontSize: 6.8,
          lineColor: COLOR.border,
          lineWidth: 0.3,
          minCellHeight: 12,
          valign: "middle",
        },
        alternateRowStyles: { fillColor: COLOR.rowAlt },
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
        // Cabeçalho com sub-rótulo nas colunas SIM/NÃO
        head: [[
          "#",
          "Item / Componente",
          "Categoria",
          "Prazo / Vida útil",
          "Ação recomendada",
          "SIM\n(feito)",
          "NÃO\n(pend.)",
          "Observação do mecânico",
        ]],
        body: rows,
        didDrawCell: (data: any) => {
          // Desenha checkbox nas células de corpo das colunas SIM (5) e NÃO (6)
          if (data.section === "body" && (data.column.index === 5 || data.column.index === 6)) {
            const { x, y: cy, width, height } = data.cell;
            const size = 3.8;
            const cx = x + (width - size) / 2;
            const cboxY = cy + (height - size) / 2;
            doc.setDrawColor(140, 140, 140);
            doc.setFillColor(255, 255, 255);
            doc.setLineWidth(0.3);
            doc.rect(cx, cboxY, size, size, "FD");
          }
        },
      });

      y = ((doc as any).lastAutoTable?.finalY ?? y) + 6;
    }
  }

  // ── 6. ASSINATURA — sempre na última página, perto do fim ─────────────────────
  // Calcula onde está o fim da última página e posiciona a 45 mm do rodapé
  const lastPage = doc.getNumberOfPages();
  doc.setPage(lastPage);
  const signY = H - MB - 48; // 48 mm acima do rodapé

  // Só desenha se não colidir com o conteúdo atual
  const contentY = y;
  const signatureStartY = Math.max(signY, contentY + 10);

  // Se não cabe, adiciona nova página
  const finalSignY =
    signatureStartY + 40 > H - MB
      ? (() => { doc.addPage(); return MT + 10; })()
      : signatureStartY;

  // Linha separadora fina acima da assinatura
  doc.setDrawColor(...COLOR.border);
  doc.setLineWidth(0.3);
  doc.line(ML, finalSignY - 4, W - MR, finalSignY - 4);

  // Três campos de assinatura
  const sigW = (W - ML - MR - 12) / 3;
  const sigFields = [
    "Mecânico responsável",
    "Data entrada / saída",
    "Proprietário / Autorização",
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR.muted);

  sigFields.forEach((label, i) => {
    const sx = ML + i * (sigW + 6);
    // Linha de assinatura
    doc.setDrawColor(...COLOR.muted);
    doc.line(sx, finalSignY + 16, sx + sigW, finalSignY + 16);
    // Rótulo
    doc.text(label, sx + sigW / 2, finalSignY + 20, { align: "center" });
  });

  // ── 7. RODAPÉ ─────────────────────────────────────────────────────────────────
  rodape(doc, code, docTitle);

  return doc.output("blob");
}

/** Nome de arquivo para o checklist de oficina */
export function oficinaChecklistFileName(code: string, issuedAt: string) {
  const d = new Date(issuedAt);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `Checklist-Oficina-TrailBook-${code}-${iso}.pdf`;
}
