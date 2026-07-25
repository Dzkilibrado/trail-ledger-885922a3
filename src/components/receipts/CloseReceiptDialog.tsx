import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  reasonsForRole,
  closeActionLabel,
  type CloseRole,
} from "@/lib/receipts/close-reasons";
import { closeReceiptProcess } from "@/lib/smart-receipts.functions";
import { invalidateMotorcycleState } from "@/hooks/useActiveMotorcycle";

/**
 * Diálogo oficial de encerramento de processo de Compra e Venda.
 * Terminologia por papel: "Cancelar processo" (vendedor), "Recusar compra"
 * (comprador), "Cancelar administrativamente" (admin).
 */
export function CloseReceiptDialog({
  receiptId,
  code,
  role,
  origin = "central",
  motorcycleId,
  trigger,
  onClosed,
}: {
  receiptId: string;
  code: string;
  role: CloseRole;
  origin?: "central" | "receipt_view" | "moto_control" | "admin_panel";
  motorcycleId?: string;
  trigger: React.ReactNode;
  onClosed?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [ack, setAck] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const qc = useQueryClient();
  const navigate = useNavigate();
  const closeFn = useServerFn(closeReceiptProcess);

  const reasons = useMemo(() => reasonsForRole(role), [role]);
  const actionLabel = closeActionLabel(role);
  const isOther = reasonCode === "other";
  const notesTrim = notes.trim();
  const notesValid = !isOther || (notesTrim.length >= 10 && notesTrim.length <= 500);
  const canConfirm = Boolean(reasonCode) && ack && notesValid && !submitting;

  const successTitle =
    role === "seller" ? "Processo cancelado com sucesso." :
    role === "buyer"  ? "Você informou que não dará continuidade à compra." :
                        "Processo encerrado administrativamente.";

  const dialogTitle =
    role === "seller" ? "Cancelar processo de compra e venda" :
    role === "buyer"  ? "Recusar esta compra" :
                        "Cancelar administrativamente";

  const dialogDescription =
    role === "seller"
      ? "Ao cancelar, o processo é encerrado imediatamente e a contraparte é avisada. O documento permanece preservado no histórico."
      : role === "buyer"
      ? "Ao recusar, você informa oficialmente que não dará continuidade a esta compra. O vendedor será avisado e o histórico permanece registrado."
      : "Encerramento oficial pela equipe TrailBook. Ambas as partes serão notificadas.";

  function reset() {
    setReasonCode("");
    setNotes("");
    setAck(false);
  }

  async function handleConfirm() {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      const res = await closeFn({
        data: {
          id: receiptId,
          reason_code: reasonCode,
          notes: isOther ? notesTrim : (notesTrim || null),
          origin,
          acknowledge: true,
        },
      });

      // Invalidação imediata (sem depender de staleTime).
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["user-processes"] }),
        qc.invalidateQueries({ queryKey: ["smart-receipts"] }),
        qc.invalidateQueries({ queryKey: ["active-negotiation"] }),
        qc.invalidateQueries({ queryKey: ["receipt-meta", code] }),
        qc.invalidateQueries({ queryKey: ["notifications"] }),
        qc.invalidateQueries({ queryKey: ["notifications-unread-count"] }),
        motorcycleId ? invalidateMotorcycleState(qc) : Promise.resolve(),
      ]);

      const goToHistory = () =>
        navigate({
          to: "/transfers",
          search: { filter: "cancelled", receipt: res.code || code },
        });

      toast.success(successTitle, {
        id: `receipt-closed-${res.receipt_id}`,
        duration: 6000,
        action: { label: "Ver histórico", onClick: goToHistory },
      });

      setOpen(false);
      reset();
      onClosed?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível encerrar o processo.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="close-reason">Motivo</Label>
            <select
              id="close-reason"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Selecione um motivo…</option>
              {reasons.map((r) => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </select>
          </div>

          {isOther && (
            <div className="space-y-2">
              <Label htmlFor="close-notes">Descreva o motivo</Label>
              <Textarea
                id="close-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                placeholder="Informe brevemente por que este processo não terá continuidade."
                rows={3}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Mínimo 10 caracteres.</span>
                <span className={notesTrim.length > 500 ? "text-destructive" : ""}>
                  {notesTrim.length}/500
                </span>
              </div>
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
            <Checkbox
              checked={ack}
              onCheckedChange={(v) => setAck(v === true)}
              className="mt-0.5"
              aria-label="Confirmação de ciência"
            />
            <span className="text-muted-foreground">
              Estou ciente de que o processo será encerrado imediatamente, o documento
              permanecerá preservado no histórico e a contraparte será notificada.
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}