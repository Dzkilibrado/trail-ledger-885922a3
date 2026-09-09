/**
 * PlanItemRow — item compacto do accordion do plano de manutenção.
 * Componente compartilhado entre:
 *  - /motorcycles/:id/plan (revisão de plano existente)
 *  - /motorcycles/new     (wizard de cadastro, step 3)
 * Alterações aqui se refletem nos dois fluxos.
 */
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  ACTION_LABEL,
  SEVERITY_LABEL,
  type ProposedSchedule,
  type PlanAction,
  type PlanSeverity,
} from "@/lib/plan-templates";

export function PlanItemRow({
  row,
  globalIndex,
  intervalSummary,
  onUpdate,
  onRemove,
}: {
  row: ProposedSchedule;
  globalIndex: number;
  intervalSummary: string;
  onUpdate: (patch: Partial<ProposedSchedule>) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className={`px-4 py-3 transition ${!row.keep ? "opacity-40" : ""}`}>
      {/* Linha principal */}
      <div className="flex items-start gap-3">
        <Checkbox
          checked={row.keep}
          onCheckedChange={(v) => onUpdate({ keep: !!v })}
          aria-label={`${row.item_name} — ${ACTION_LABEL[row.action]}`}
          className="mt-0.5 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">{row.item_name}</p>
          <p className="text-xs text-primary/80 font-medium">{ACTION_LABEL[row.action]}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{intervalSummary}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-label="Editar item"
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Painel de edição inline */}
      {editing && (
        <div className="mt-3 space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Componente
            </Label>
            <Input
              value={row.item_name}
              onChange={(e) =>
                onUpdate({
                  item_name: e.target.value,
                  name: `${e.target.value} — ${ACTION_LABEL[row.action]}`,
                })
              }
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Ação
            </Label>
            <Select
              value={row.action}
              onValueChange={(v) =>
                onUpdate({
                  action: v as PlanAction,
                  name: `${row.item_name} — ${ACTION_LABEL[v as PlanAction]}`,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTION_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Horas
              </Label>
              <Input
                type="number"
                step="0.1"
                value={row.interval_hours ?? ""}
                onChange={(e) =>
                  onUpdate({ interval_hours: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                KM
              </Label>
              <Input
                type="number"
                value={row.interval_km ?? ""}
                onChange={(e) =>
                  onUpdate({ interval_km: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Dias
              </Label>
              <Input
                type="number"
                value={row.interval_days ?? ""}
                onChange={(e) =>
                  onUpdate({ interval_days: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Severidade
            </Label>
            <Select
              value={row.severity}
              onValueChange={(v) => onUpdate({ severity: v as PlanSeverity })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SEVERITY_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => {
              onRemove();
              setEditing(false);
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover este item
          </Button>
        </div>
      )}
    </div>
  );
}
