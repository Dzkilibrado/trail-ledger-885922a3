import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import { formatDate } from "@/lib/trailbook";

type AuditRow = {
  id: string;
  table_name: string;
  action: "insert" | "update" | "delete" | string;
  created_at: string;
  actor_id: string | null;
  old_values: any;
  new_values: any;
};

const FIELD_LABEL: Record<string, string> = {
  hours_total: "Horímetro",
  km_total: "Quilometragem",
  nickname: "Apelido",
  plate: "Placa",
  renavam: "Renavam",
  chassis: "Chassi",
  main_photo_url: "Foto principal",
  conservation_score: "Índice de conservação",
  owner_id: "Proprietário",
  brand: "Marca",
  model: "Modelo",
  year_make: "Ano fabricação",
  year_model: "Ano modelo",
  displacement: "Cilindrada",
  control_type: "Tipo de controle",
  title: "Título",
  description: "Descrição",
  cost: "Custo",
  type: "Tipo",
  occurred_at: "Data",
  location: "Local",
  hours_at_event: "Horímetro no evento",
  km_at_event: "Hodômetro no evento",
  incident_declaration: "Declaração de sinistro",
};

const TABLE_LABEL: Record<string, string> = {
  motorcycles: "Motocicleta",
  events: "Atividade",
};

const ACTION_LABEL: Record<string, { label: string; tone: string }> = {
  insert: { label: "Criado", tone: "bg-emerald-500/15 text-emerald-400" },
  update: { label: "Alterado", tone: "bg-amber-500/15 text-amber-400" },
  delete: { label: "Removido", tone: "bg-destructive/15 text-destructive" },
};

function humanize(v: any): string {
  if (v == null || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return formatDate(v);
  return String(v);
}

function diffFields(row: AuditRow): { field: string; from: any; to: any }[] {
  const skip = new Set(["id", "updated_at", "created_at", "owner_id"]);
  const out: { field: string; from: any; to: any }[] = [];
  if (row.action === "insert" && row.new_values) {
    for (const [k, v] of Object.entries(row.new_values)) {
      if (skip.has(k) || v == null) continue;
      out.push({ field: k, from: null, to: v });
    }
  } else if (row.action === "delete" && row.old_values) {
    for (const [k, v] of Object.entries(row.old_values)) {
      if (skip.has(k) || v == null) continue;
      out.push({ field: k, from: v, to: null });
    }
  } else if (row.old_values && row.new_values) {
    const keys = new Set([...Object.keys(row.old_values), ...Object.keys(row.new_values)]);
    for (const k of keys) {
      if (skip.has(k)) continue;
      const a = row.old_values[k];
      const b = row.new_values[k];
      if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ field: k, from: a, to: b });
    }
  }
  return out.slice(0, 8);
}

/** Card-resumo já com botão que abre o modal completo. */
export function AuditSummary({ rows }: { rows: AuditRow[] }) {
  const [open, setOpen] = useState(false);
  const last = rows[0];
  return (
    <>
      <div className="surface-elevated flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
            <History className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">Histórico de alterações</div>
            <div className="text-xs text-muted-foreground">
              {rows.length === 0
                ? "Nenhuma alteração registrada ainda."
                : `${rows.length} registro(s) · última em ${formatDate(last.created_at)}`}
            </div>
          </div>
        </div>
        {rows.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Ver histórico completo</Button>
        )}
      </div>
      <AuditDialog rows={rows} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function AuditDialog({
  rows, trigger, open, onOpenChange,
}: { rows: AuditRow[]; trigger?: React.ReactNode; open?: boolean; onOpenChange?: (v: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = (v: boolean) => { onOpenChange ? onOpenChange(v) : setInternalOpen(v); };
  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" /> Histórico de alterações</DialogTitle>
          <DialogDescription>
            Registros imutáveis. Cada alteração é assinada com data e responsável, garantindo a confiabilidade do histórico.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhuma alteração registrada.
            </div>
          ) : rows.map((r) => {
            const action = ACTION_LABEL[r.action] ?? { label: r.action, tone: "bg-muted text-muted-foreground" };
            const diffs = diffFields(r);
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${action.tone}`}>{action.label}</span>
                    <span className="text-sm font-medium">{TABLE_LABEL[r.table_name] ?? r.table_name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                </div>
                {diffs.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs">
                    {diffs.map((d, i) => (
                      <li key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 rounded-md bg-muted/40 px-2 py-1.5">
                        <span className="font-medium text-foreground">{FIELD_LABEL[d.field] ?? d.field}</span>
                        <span className="text-muted-foreground line-through truncate" title={humanize(d.from)}>{humanize(d.from)}</span>
                        <span className="text-primary truncate" title={humanize(d.to)}>{humanize(d.to)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}