// ============================================================
// fiscal-pdf.ts — PDF de Fiscalizacao TrailBook
// Reutiliza infraestrutura de jsPDF existente.
// ============================================================

import jsPDF from "jspdf";
import QRCode from "qrcode";
import { formatDate } from "@/lib/trailbook";
import { shareUrl } from "@/lib/external-links";
import type { PublicHealthReportSnapshot } from "./public-types";
import type { HealthReportSnapshot } from "./types";

const M = 15;
const W = 210;
const H = 297;

const FISCAL_STATUS: Record<string, string> = {
  ok:        "Saudavel",
  attention: "Atencao",
  action:    "Necessita acao",
  unknown:   "Sem dados suficientes",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  invoice:       "Nota Fiscal",
  bill_of_sale:  "Recibo de Compra e Venda",
};

export interface FiscalPdfInput {
  snapshot: PublicHealthReportSnapshot | Partial<HealthReportSnapshot>;
  code: string;
  issuedAt: string;
  status: string;
  fiscal: {
    owner_name: string | null;
    owner_cpf: string | null;
    origin_doc_type: string | null;
    origin_doc_name: string | null;
    origin_doc_number: string | null;
    origin_doc_mime: string | null;
  } | null;
  // Token público do share fiscal — para gerar QR Code no PDF
  fiscalToken?: string | null;
  // Data URL da imagem do documento (JPEG/PNG) — obtida pelo chamador autenticado
  docImageDataUrl?: string | null;
}

export async function buildFiscalPdf(input: FiscalPdfInput): Promise<Blob> {
  const { snapshot: s, code, issuedAt, status, fiscal, fiscalToken, docImageDataUrl } = input;
  const moto = s.motorcycle;
  const rideAnswer = s.rideAnswer;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Pré-gera QR Code se token disponível
  let qrDataUrl: string | null = null;
  if (fiscalToken) {
    try {
      const fiscalUrl = shareUrl(`/l/${fiscalToken}`);
      qrDataUrl = await QRCode.toDataURL(fiscalUrl, { width: 400, margin: 1, errorCorrectionLevel: "M" });
    } catch (_) { /* QR Code opcional */ }
  }

  let y = M;
  const ensure = (need: number) => {
    if (y + need > H - 20) { doc.addPage(); y = M; }
  };
  const heading = (t: string) => {
    ensure(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(t, M, y);
    y += 2;
    doc.setDrawColor(200);
    doc.line(M, y, W - M, y);
    y += 6;
  };
  const row = (label: string, value: string | null | undefined) => {
    if (!value) return;
    ensure(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(label + ":", M, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20);
    const lines = doc.splitTextToSize(value, W - M * 2 - 35);
    doc.text(lines, M + 35, y);
    y += 5 * (lines.length) + 1;
  };
  const note = (t: string) => {
    ensure(6);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(t, M, y);
    y += 6;
  };
  const footer = () => {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text("TrailBook - Laudo para Fiscalizacao", M, H - 8);
      doc.text("Pagina " + i + " de " + pages, W - M, H - 8, { align: "right" });
      doc.setDrawColor(225);
      doc.line(M, H - 12, W - M, H - 12);
    }
  };

  // Cabecalho com QR Code à direita
  const QR_SIZE = 38; // mm
  const QR_X = W - M - QR_SIZE;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20);
  doc.text("TRAILBOOK", M, y);
  y += 7;
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text("LAUDO PARA FISCALIZACAO", M, y);
  y += 3;
  doc.setDrawColor(40);
  doc.setLineWidth(0.5);
  doc.line(M, y, W - M, y);
  doc.setLineWidth(0.2);
  y += 8;

  // QR Code — inserido no canto superior direito alinhado ao cabecalho
  if (qrDataUrl) {
    try {
      const qrY = M;
      doc.addImage(qrDataUrl, "PNG", QR_X, qrY, QR_SIZE, QR_SIZE, undefined, "FAST");
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.setFont("helvetica", "normal");
      doc.text("Escaneie para verificar", QR_X + QR_SIZE / 2, qrY + QR_SIZE + 3.5, { align: "center" });
    } catch (_) { /* falha silenciosa */ }
  }

  // Proprietario
  heading("PROPRIETARIO");
  if (fiscal?.owner_name || fiscal?.owner_cpf) {
    row("Nome", fiscal?.owner_name);
    row("CPF",  fiscal?.owner_cpf);
  } else {
    note("Dados do proprietario nao disponiveis.");
  }
  y += 3;

  // Motocicleta
  heading("MOTOCICLETA");
  if (moto) {
    row("Marca",   moto.brand);
    row("Modelo",  moto.model);
    row("Ano",     moto.yearModel ? String(moto.yearModel) : null);
    row("Placa",   moto.plate);
    row("Chassi",  moto.chassisMasked);
  } else {
    note("Dados da motocicleta nao disponiveis.");
  }
  y += 3;

  // Laudo
  heading("LAUDO");
  row("Codigo",   code);
  row("Emissao",  issuedAt ? formatDate(issuedAt) : null);
  row("Situacao", FISCAL_STATUS[rideAnswer?.status ?? ""] ?? status);
  if (rideAnswer?.message) row("Condicao", rideAnswer.message);
  y += 3;

  // Documento de Origem
  heading("DOCUMENTO DE ORIGEM");
  if (fiscal?.origin_doc_type) {
    row("Tipo",    DOC_TYPE_LABEL[fiscal.origin_doc_type] ?? fiscal.origin_doc_type);
    row("Numero",  fiscal.origin_doc_number);
    row("Arquivo", fiscal.origin_doc_name);
    y += 3;

    const mime = fiscal.origin_doc_mime ?? "";
    const isImage = /image\/(jpeg|jpg|png|webp)/i.test(mime);
    const isPdf   = mime === "application/pdf";

    if (docImageDataUrl && isImage) {
      try {
        const imgType = mime.toLowerCase().includes("png") ? "PNG" : "JPEG";
        const maxW = W - M * 2;
        const maxH = Math.min(H - y - 25, 120);
        ensure(maxH + 5);
        doc.addImage(docImageDataUrl, imgType, M, y, maxW, maxH, undefined, "MEDIUM");
        y += maxH + 4;
      } catch (_) {
        note("Nao foi possivel incorporar a imagem do documento.");
      }
    } else if (isPdf || (!isImage && !isPdf)) {
      // Para PDF ou outros tipos: exibe QR Code do acesso fiscal para visualizacao do documento
      if (qrDataUrl) {
        try {
          const docQrSize = 50;
          ensure(docQrSize + 20);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(60);
          doc.text("Visualize o documento escaneando o QR Code abaixo:", M, y);
          y += 5;
          const centerX = (W - docQrSize) / 2;
          doc.addImage(qrDataUrl, "PNG", centerX, y, docQrSize, docQrSize, undefined, "FAST");
          y += docQrSize + 3;
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(120);
          doc.text(
            isPdf ? "Documento em PDF — acesse a versao eletronica para visualizacao." :
                    "Acesse a versao eletronica do acesso de fiscalizacao para visualizar o documento.",
            M,
            y,
            { maxWidth: W - M * 2 },
          );
          y += 6;
        } catch (_) {
          note(isPdf
            ? "Documento em formato PDF. Consulte a versao eletronica do acesso de fiscalizacao."
            : "Documento referenciado. Consulte a versao eletronica do acesso de fiscalizacao.");
        }
      } else {
        note(isPdf
          ? "Documento em formato PDF. Consulte a versao eletronica do acesso de fiscalizacao."
          : "Documento referenciado. Consulte a versao eletronica do acesso de fiscalizacao.");
      }
    }
  } else {
    note("Nenhum documento de origem cadastrado.");
  }

  footer();
  return doc.output("blob");
}
