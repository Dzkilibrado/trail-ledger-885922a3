import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
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
import { Loader2, UploadCloud, FileText, X } from "lucide-react";
import { attachSignedReceipt } from "@/lib/smart-receipts.functions";

const MAX_BYTES = 10 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Diálogo oficial de anexação do documento assinado ao Recibo Inteligente.
 * Fluxo enxuto (v1.7.7 lite): seleciona/arrasta um PDF, confirma e envia.
 * Regras validadas no cliente E no servidor:
 *  - Somente PDF, até 10 MB, arquivo não vazio.
 *  - Apenas vendedor/comprador do processo ativo.
 */
export function AttachSignedDialog({
  receiptId,
  trigger,
  onAttached,
}: {
  receiptId: string;
  trigger: React.ReactNode;
  onAttached?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const qc = useQueryClient();
  const attachFn = useServerFn(attachSignedReceipt);

  function reset() {
    setFile(null);
    setDragOver(false);
    setSubmitting(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function pickFile(f: File | null | undefined) {
    if (!f) return;
    const isPdf =
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      toast.error("Somente arquivos PDF são aceitos.");
      return;
    }
    if (f.size === 0) {
      toast.error("Arquivo vazio. Selecione um PDF válido.");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("Arquivo excede 10 MB.");
      return;
    }
    setFile(f);
  }

  async function submit() {
    if (!file || submitting) return;
    setSubmitting(true);
    try {
      const base64 = await fileToBase64(file);
      await attachFn({ data: { id: receiptId, pdf_base64: base64 } });
      toast.success("Documento assinado anexado com sucesso.");
      // Invalida tudo que depende do estado do recibo/central.
      qc.invalidateQueries({ queryKey: ["user-processes"] });
      qc.invalidateQueries({ queryKey: ["receipt-meta"] });
      qc.invalidateQueries({ queryKey: ["receipts"] });
      setOpen(false);
      reset();
      onAttached?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao anexar documento";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Anexar documento assinado</DialogTitle>
          <DialogDescription>
            Envie o PDF já assinado pelas partes. O documento original permanece preservado.
          </DialogDescription>
        </DialogHeader>

        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={
              "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors " +
              (dragOver
                ? "border-primary bg-primary/5"
                : "border-border bg-muted/30 hover:bg-muted/50")
            }
          >
            <UploadCloud className="h-8 w-8 text-primary" />
            <div className="text-sm font-semibold">Selecionar PDF ou arrastar aqui</div>
            <div className="text-[11px] text-muted-foreground">
              Somente PDF · até 10 MB
            </div>
          </button>
        ) : (
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{file.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {formatSize(file.size)}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                aria-label="Remover arquivo"
                disabled={submitting}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Deseja anexar este documento assinado ao processo?
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (!submitting) {
                setOpen(false);
                reset();
              }
            }}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!file || submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
              </>
            ) : (
              <>Confirmar envio</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}