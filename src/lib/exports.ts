import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportColumn<T> = {
  key: keyof T | string;
  label: string;
  value?: (row: T) => string | number | null | undefined;
  align?: "left" | "right" | "center";
};

function cellValue<T>(row: T, col: ExportColumn<T>): string {
  const raw = col.value ? col.value(row) : (row as any)[col.key];
  if (raw == null) return "";
  return String(raw);
}

function ts() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCsv<T>(filename: string, columns: ExportColumn<T>[], rows: T[]) {
  const header = columns.map((c) => c.label);
  const body = rows.map((r) => columns.map((c) => cellValue(r, c)));
  const csv = [header, ...body]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  // BOM garante acentos corretos no Excel PT-BR
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  download(blob, `${filename}-${ts()}.csv`);
}

export function exportXlsx<T>(filename: string, columns: ExportColumn<T>[], rows: T[], sheetName = "Dados") {
  const data = rows.map((r) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((c) => { obj[c.label] = c.value ? c.value(r) : (r as any)[c.key]; });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(data, { header: columns.map((c) => c.label) });
  ws["!cols"] = columns.map((c) => ({ wch: Math.max(12, c.label.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${filename}-${ts()}.xlsx`);
}

export function exportPdf<T>(
  filename: string,
  title: string,
  columns: ExportColumn<T>[],
  rows: T[],
  meta?: { subtitle?: string; footer?: string },
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 40, 40);
  if (meta?.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(meta.subtitle, 40, 56);
    doc.setTextColor(0);
  }
  autoTable(doc, {
    startY: 72,
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => cellValue(r, c))),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: Object.fromEntries(columns.map((c, i) => [i, { halign: c.align ?? "left" }])),
  });
  const pageCount = doc.getNumberOfPages();
  const now = new Date().toLocaleString("pt-BR");
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    const footer = `${meta?.footer ?? "TrailBook"} · Gerado em ${now} · Página ${i}/${pageCount}`;
    doc.text(footer, 40, doc.internal.pageSize.getHeight() - 20);
  }
  doc.save(`${filename}-${ts()}.pdf`);
}
