import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { adminDeleteHomologMotorcycle } from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, FlaskConical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { clearActiveMotorcycleIfMatches, invalidateMotorcycleState } from "@/hooks/useActiveMotorcycle";

const REASONS = [
  "Limpeza de homologação",
  "Cadastro de teste",
  "Cenário incorreto",
  "Duplicidade de teste",
  "Solicitação do administrador",
  "Outro",
] as const;

export function AdminMotoDangerZone({
  motoId, isHomologation, label,
}: { motoId: string; isHomologation: boolean; label: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const runDelete = useServerFn(adminDeleteHomologMotorcycle);
  const [flag, setFlag] = useState(isHomologation);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [reasonOther, setReasonOther] = useState("");
  const [deleting, setDeleting] = useState(false);

  const impact = useQuery({
    queryKey: ["admin", "moto-impact", motoId, open],
    enabled: open && flag,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_motorcycle_impact" as any, { _moto: motoId });
      if (error) throw error;
      return data as any;
    },
  });

  async function toggleFlag(next: boolean) {
    setSaving(true);
    const { error } = await supabase.rpc("admin_set_motorcycle_homologation" as any, {
      _moto: motoId, _flag: next, _reason: "Ajuste manual pelo admin",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setFlag(next);
    toast.success(next ? "Moto marcada como Homologação" : "Moto marcada como Produtiva");
    qc.invalidateQueries({ queryKey: ["motorcycle", motoId] });
  }

  const finalReason = reason === "Outro" ? reasonOther.trim() : reason;
  const canConfirm = confirmText === "EXCLUIR" && finalReason.length >= 3 && !deleting;

  async function handleDelete() {
    if (!canConfirm) return;
    setDeleting(true);
    try {
      const res: any = await runDelete({ data: { motorcycleId: motoId, reason: finalReason, confirmation: "EXCLUIR" } });
      const rem = res?.storage?.removed_count ?? 0;
      const miss = res?.storage?.missing_count ?? 0;
      toast.success(`Moto excluída. Arquivos removidos: ${rem}${miss ? ` (não encontrados: ${miss})` : ""}.`);
      setOpen(false);
      clearActiveMotorcycleIfMatches(motoId);
      await invalidateMotorcycleState(qc);
      navigate({ to: "/motorcycles" });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir moto de homologação");
    } finally {
      setDeleting(false);
    }
  }

  const counts = impact.data?.counts ?? {};

  return (
    <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
        <div className="flex-1">
          <h2 className="font-display text-lg font-bold text-destructive">Área administrativa · Zona de risco</h2>
          <p className="text-xs text-muted-foreground">
            Visível apenas para administradores. Ações aqui não podem ser desfeitas.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/40 p-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-amber-400" />
          <div>
            <div className="text-sm font-semibold">Moto de Homologação</div>
            <div className="text-xs text-muted-foreground">
              Marca esta moto como registro de teste. Só motos marcadas podem ser excluídas fisicamente.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs">{flag ? "Sim" : "Não"}</span>
          <Switch checked={flag} disabled={saving} onCheckedChange={toggleFlag} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground max-w-md">
          Motos <strong>produtivas</strong> só podem ser arquivadas. Para excluir definitivamente, marque como Homologação.
        </div>
        <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setConfirmText(""); setReason(REASONS[0]); setReasonOther(""); } }}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={!flag}>
              <Trash2 className="h-4 w-4" /> Excluir moto de homologação
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" /> Excluir {label}?
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>
                    Esta ação excluirá definitivamente a motocicleta de <strong>HOMOLOGAÇÃO</strong> e todos os registros vinculados.
                    Use apenas para limpeza de testes e cenários de homologação. Esta operação <strong>não poderá ser desfeita</strong>.
                  </p>
                  {impact.isLoading && <p className="text-muted-foreground">Calculando impacto…</p>}
                  {impact.data && (
                    <div className="rounded-lg border border-border bg-background/40 p-3 text-xs">
                      <div className="mb-1 font-semibold text-foreground">Serão removidos:</div>
                      <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                        <li>{counts.events ?? 0} atividades/eventos</li>
                        <li>{counts.event_attachments ?? 0} anexos de eventos</li>
                        <li>{counts.documents ?? 0} documentos</li>
                        <li>{counts.photos ?? 0} fotos</li>
                        <li>{counts.certificates ?? 0} certificados</li>
                        <li>{counts.schedules ?? 0} programações</li>
                        <li>{counts.inspections ?? 0} inspeções</li>
                        <li>{counts.ownership ?? 0} registros de propriedade</li>
                        <li>{counts.transfers ?? 0} transferências</li>
                        <li>{counts.tickets ?? 0} chamados vinculados</li>
                      </ul>
                      <div className="mt-2 text-muted-foreground">
                        TrailBook ID <code className="font-mono">{impact.data.motorcycle?.trailbook_id}</code> será aposentado e não poderá ser reutilizado.
                      </div>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Motivo</label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                {reason === "Outro" && (
                  <Textarea
                    className="mt-2"
                    rows={2}
                    placeholder="Detalhe o motivo…"
                    value={reasonOther}
                    onChange={(e) => setReasonOther(e.target.value)}
                  />
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Digite <code className="font-mono">EXCLUIR</code> para confirmar</label>
                <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="EXCLUIR" autoFocus />
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={!canConfirm}
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40"
              >
                {deleting ? "Excluindo…" : "Excluir definitivamente"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}