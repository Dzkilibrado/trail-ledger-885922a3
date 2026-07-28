import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ShieldOff } from "lucide-react";

export const REVOKE_REASONS: { code: string; label: string }[] = [
  { code: "sale", label: "Venda da motocicleta" },
  { code: "incorrect_info", label: "Informações incorretas" },
  { code: "replaced", label: "Certificado substituído" },
  { code: "doc_update", label: "Atualização documental" },
  { code: "owner_request", label: "Solicitação do proprietário" },
  { code: "mistake", label: "Certificado emitido por engano" },
  { code: "other", label: "Outros" },
];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  certificateId: string;
  motorcycleId: string;
};

export function RevokeCertificateDialog({ open, onOpenChange, certificateId, motorcycleId }: Props) {
  const qc = useQueryClient();
  const [code, setCode] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const needsNotes = code === "other";
  const canSubmit = !!code && (!needsNotes || notes.trim().length >= 3);

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    const { error } = await supabase
      .from("certificates")
      .update({
        status: "revoked",
        revoked_reason_code: code,
        revoked_reason_notes: needsNotes ? notes.trim() : null,
        revoked_at: new Date().toISOString(),
      })
      .eq("id", certificateId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Certificado revogado.");
    qc.invalidateQueries({ queryKey: ["certificates", motorcycleId] });
    setCode("");
    setNotes("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldOff className="h-5 w-5 text-destructive" /> Revogar Certificado Digital
          </DialogTitle>
          <DialogDescription>
            O link público deixará de abrir imediatamente. Registre o motivo para manter o histórico.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Motivo da revogação
            </Label>
            <Select value={code} onValueChange={setCode}>
              <SelectTrigger><SelectValue placeholder="Selecione um motivo" /></SelectTrigger>
              <SelectContent>
                {REVOKE_REASONS.map((r) => (
                  <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsNotes && (
            <div className="space-y-2">
              <Label htmlFor="revoke-notes" className="text-xs uppercase tracking-wide text-muted-foreground">
                Descreva o motivo
              </Label>
              <Textarea
                id="revoke-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Informe o motivo da revogação"
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
            {saving ? "Revogando…" : "Revogar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}