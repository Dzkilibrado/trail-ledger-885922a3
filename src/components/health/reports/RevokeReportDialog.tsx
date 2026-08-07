import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";

// O laudo é um documento imutável (código, hash, trilha de auditoria) — por
// isso "excluir" aqui significa revogar: some da listagem principal e deixa
// de valer como comprovação, mas o registro é preservado para histórico.
export const REVOKE_REPORT_REASONS: { code: string; label: string }[] = [
  { code: "mistake", label: "Gerado por engano" },
  { code: "duplicate", label: "Laudo duplicado" },
  { code: "incorrect_info", label: "Informações incorretas" },
  { code: "owner_request", label: "Não quero mais manter este laudo" },
  { code: "other", label: "Outros" },
];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reportId: string;
  motorcycleId: string;
  reportCode?: string | null;
};

export function RevokeReportDialog({
  open,
  onOpenChange,
  reportId,
  motorcycleId,
  reportCode,
}: Props) {
  const qc = useQueryClient();
  const [code, setCode] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const needsNotes = code === "other";
  const canSubmit = !!code && (!needsNotes || notes.trim().length >= 3);

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    const { data: userRes } = await supabase.auth.getSession();
    const { error } = await supabase
      .from("health_reports")
      .update({
        status: "revoked",
        revoked_reason_code: code,
        revoked_reason_notes: needsNotes ? notes.trim() : null,
        revoked_at: new Date().toISOString(),
        revoked_by: userRes.session?.user.id ?? null,
      })
      .eq("id", reportId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Laudo excluído da sua lista.");
    qc.invalidateQueries({ queryKey: ["health-reports", motorcycleId] });
    setCode("");
    setNotes("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" aria-hidden /> Excluir laudo{" "}
            {reportCode ? `${reportCode}` : ""}
          </DialogTitle>
          <DialogDescription>
            O laudo sai da sua lista e deixa de valer como comprovação. Por ser um documento com
            código e trilha de auditoria, ele não é apagado por completo — fica registrado como
            revogado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Motivo</Label>
            <Select value={code} onValueChange={setCode}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um motivo" />
              </SelectTrigger>
              <SelectContent>
                {REVOKE_REPORT_REASONS.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsNotes && (
            <div className="space-y-2">
              <Label
                htmlFor="revoke-report-notes"
                className="text-xs uppercase tracking-wide text-muted-foreground"
              >
                Descreva o motivo
              </Label>
              <Textarea
                id="revoke-report-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Informe o motivo"
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button variant="destructive" onClick={submit} disabled={!canSubmit || saving}>
            {saving ? "Excluindo…" : "Excluir laudo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
