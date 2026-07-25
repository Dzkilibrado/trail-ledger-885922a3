import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Download,
  FileWarning,
  Loader2,
  Printer,
  RefreshCw,
  Share2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getReceiptPdfBytes } from "@/lib/smart-receipts.functions";
import { publicReceiptUrl } from "@/lib/smart-receipts";

/**
 * Visualizador ÚNICO oficial de PDFs do TrailBook.
 * Todos os fluxos (Recibo, Histórico, Central, Passaporte, página pública)
 * devem usar este componente — nenhum fluxo pode abrir a URL do storage.
 *
 * Estratégia: baixar os bytes via server function autenticada e renderizar
 * como `blob:` mesma-origem em iframe fullscreen. Cabeçalho fixo com Voltar,
 * Código, Status, Baixar, Compartilhar, Imprimir e Fechar. Safe-area friendly.
 */
export function TBPdfViewer({
  code,
  variant = "signed",
  status,
  onBack,
  onClose,
}: {
  code: string;
  variant?: "signed" | "original";
  status?: string | null;
  onBack: () => void;
  onClose: () => void;
}) {
  const pdfBytesFn = useServerFn(getReceiptPdfBytes);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const currentUrlRef = useRef<string | null>(null);

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    (async () => {
      try {
        const res = await pdfBytesFn({ data: { code, variant } });
        if (cancelled) return;
        if (!res.found) { setState("error"); return; }
        const bin = atob(res.base64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const blob = new Blob([arr], { type: res.contentType });
        const url = URL.createObjectURL(blob);
        if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
        currentUrlRef.current = url;
        setBytes(arr);
        setBlobUrl(url);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => { cancelled = true; };
  }, [code, variant, attempt, pdfBytesFn]);

  useEffect(() => () => {
    if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
  }, []);

  const filename = useMemo(
    () => `${code}${variant === "signed" ? "-assinado" : ""}.pdf`,
    [code, variant],
  );

  function download() {
    if (!bytes) return;
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const href = URL.createObjectURL(new Blob([buf], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 5_000);
  }

  async function share() {
    const pageUrl = publicReceiptUrl(code);
    const nav = typeof navigator !== "undefined"
      ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> })
      : null;
    if (nav?.share) {
      try {
        await nav.share({
          title: `Recibo TrailBook ${code}`,
          text: `Recibo Inteligente TrailBook — valide em ${pageUrl}`,
          url: pageUrl,
        });
        return;
      } catch { return; }
    }
    try {
      await navigator.clipboard.writeText(pageUrl);
      toast.success("Link do recibo copiado");
    } catch { toast.info(pageUrl); }
  }

  function print() {
    const iframe = iframeRef.current;
    if (!iframe || !blobUrl) { toast.info("Aguarde o PDF carregar para imprimir."); return; }
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // Fallback: abrir o blob em nova janela para o próprio visualizador do navegador imprimir.
      const w = window.open(blobUrl, "_blank");
      if (!w) toast.info("Habilite pop-ups para imprimir o recibo.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))", paddingBottom: "0.5rem" }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label="Voltar">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Voltar</span>
          </Button>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Documento
            </div>
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-sm font-bold text-primary">{code}</span>
              {status && (
                <span className="hidden sm:inline rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {status}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={download} disabled={state !== "ready"} aria-label="Baixar">
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Baixar</span>
          </Button>
          <Button size="sm" variant="outline" onClick={share} aria-label="Compartilhar">
            <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Compartilhar</span>
          </Button>
          <Button size="sm" variant="outline" onClick={print} disabled={state !== "ready"} aria-label="Imprimir">
            <Printer className="h-4 w-4" /> <span className="hidden sm:inline">Imprimir</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4" /> <span className="hidden sm:inline">Fechar</span>
          </Button>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden bg-muted/20">
        {state === "loading" && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Carregando documento…</p>
          </div>
        )}
        {state === "error" && (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
            <FileWarning className="h-10 w-10 text-destructive" />
            <div>
              <h2 className="font-display text-lg font-bold">Não foi possível abrir o documento</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tente novamente ou faça o download.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={() => setAttempt((n) => n + 1)}>
                <RefreshCw className="h-4 w-4" /> Tentar novamente
              </Button>
              <Button size="sm" variant="outline" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
            </div>
          </div>
        )}
        {state === "ready" && blobUrl && (
          <iframe
            key={blobUrl}
            ref={iframeRef}
            title={`Documento ${code}`}
            src={blobUrl}
            className="h-full w-full border-0"
          />
        )}
      </div>
    </div>
  );
}