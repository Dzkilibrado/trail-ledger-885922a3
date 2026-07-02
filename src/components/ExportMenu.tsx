import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, FileType } from "lucide-react";
import { exportCsv, exportPdf, exportXlsx, type ExportColumn } from "@/lib/exports";

type Props<T> = {
  filename: string;
  title: string;
  columns: ExportColumn<T>[];
  rows: T[];
  subtitle?: string;
  disabled?: boolean;
  label?: string;
};

export function ExportMenu<T>({ filename, title, columns, rows, subtitle, disabled, label = "Exportar" }: Props<T>) {
  const empty = !rows || rows.length === 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || empty}>
          <Download className="h-4 w-4" /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs">{rows.length} registro(s)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => exportCsv(filename, columns, rows)}>
          <FileText className="h-4 w-4" /> CSV (UTF-8)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportXlsx(filename, columns, rows)}>
          <FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportPdf(filename, title, columns, rows, { subtitle })}>
          <FileType className="h-4 w-4" /> PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
