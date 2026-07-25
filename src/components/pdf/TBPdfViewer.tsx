import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileWarning,
  Loader2,
  MoreVertical,
  Printer,
  RefreshCw,
  Share2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { getReceiptPdfBytes } from "@/lib/smart-receipts.functions";
import { publicReceiptUrl } from "@/lib/smart-receipts";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Visualizador ÚNICO oficial de PDFs do TrailBook.
 *
 * Estratégia: baixar os bytes via server function autenticada e renderizar
 * página-a-página em <canvas> usando pdf.js (pdfjs-dist). Nenhum iframe é
 * usado para renderização — o TrailBook controla 100% da experiência.
 */

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
};
type PdfPage = {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas?: HTMLCanvasElement }) => { promise: Promise<void>; cancel: () => void };
  cleanup?: () => void;
};

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  (pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs as unknown as {
    getDocument: (src: { data: Uint8Array }) => { promise: Promise<PdfDoc> };
  };
}

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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bytesRef = useRef<Uint8Array | null>(null);
  const docRef = useRef<PdfDoc | null>(null);

  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1); // multiplicador sobre fit-to-width

  const filename = useMemo(
    () => `${code}${variant === "signed" ? "-assinado" : ""}.pdf`,
    [code, variant],
  );

  // --- Load bytes + open document ---
  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setNumPages(0);
    setCurrentPage(1);
    (async () => {
      try {
        const res = await pdfBytesFn({ data: { code, variant } });
        if (cancelled) return;
        if (!res.found) { setState("error"); return; }
        const bin = atob(res.base64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        bytesRef.current = arr;

        const pdfjs = await loadPdfJs();
        // pdf.js muta o buffer — passamos uma cópia para preservar bytes de download.
        const task = pdfjs.getDocument({ data: arr.slice() });
        const doc = await task.promise;
        if (cancelled) { void doc.destroy(); return; }
        if (docRef.current) await docRef.current.destroy().catch(() => {});
        docRef.current = doc;
        setNumPages(doc.numPages);
        setState("ready");
      } catch (err) {
        console.error("[TBPdfViewer] falha ao abrir documento", err);
        if (!cancelled) setState("error");
      }
    })();
    return () => { cancelled = true; };
  }, [code, variant, attempt, pdfBytesFn]);

  useEffect(() => () => {
    if (docRef.current) void docRef.current.destroy().catch(() => {});
  }, []);

  // --- Actions ---
  const download = useCallback(() => {
    const arr = bytesRef.current;
    if (!arr) return;
    const buf = arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
    const href = URL.createObjectURL(new Blob([buf], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = href; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 5_000);
  }, [filename]);

  const share = useCallback(async () => {
    const pageUrl = publicReceiptUrl(code);
    const arr = bytesRef.current;
    const nav = typeof navigator !== "undefined"
      ? (navigator as Navigator & {
          share?: (d: ShareData & { files?: File[] }) => Promise<void>;
          canShare?: (d: { files?: File[] }) => boolean;
        })
      : null;

    // Preferir compartilhar o arquivo em si (mobile)
    if (arr && nav?.share && nav.canShare) {
      try {
        const buf = arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
        const file = new File([buf], filename, { type: "application/pdf" });
        if (nav.canShare({ files: [file] })) {
          await nav.share({ files: [file], title: `Recibo TrailBook ${code}`, text: `Recibo Inteligente TrailBook — ${code}` });
          return;
        }
      } catch { /* usuário cancelou ou falhou — cai para link */ }
    }
    if (nav?.share) {
      try {
        await nav.share({ title: `Recibo TrailBook ${code}`, text: `Recibo Inteligente TrailBook — valide em ${pageUrl}`, url: pageUrl });
        return;
      } catch { return; }
    }
    try {
      await navigator.clipboard.writeText(pageUrl);
      toast.success("Link do recibo copiado");
    } catch { toast.info(pageUrl); }
  }, [code, filename]);

  const openExternal = useCallback(() => {
    const arr = bytesRef.current;
    if (!arr) return;
    const buf = arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
    const url = URL.createObjectURL(new Blob([buf], { type: "application/pdf" }));
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) toast.info("Habilite pop-ups para abrir em outro aplicativo.");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }, []);

  const print = useCallback(() => {
    const arr = bytesRef.current;
    if (!arr) { toast.info("Aguarde o documento carregar para imprimir."); return; }
    const buf = arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
    const url = URL.createObjectURL(new Blob([buf], { type: "application/pdf" }));
    // Usar iframe oculto apenas para acionar o diálogo de impressão do SO.
    // A renderização visual do documento continua em canvas pelo pdf.js.
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0"; frame.style.bottom = "0";
    frame.style.width = "0"; frame.style.height = "0"; frame.style.border = "0";
    frame.src = url;
    frame.onload = () => {
      try { frame.contentWindow?.focus(); frame.contentWindow?.print(); }
      catch { const w = window.open(url, "_blank"); if (!w) toast.info("Habilite pop-ups para imprimir."); }
    };
    document.body.appendChild(frame);
    setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60_000);
  }, []);

  const zoomIn = () => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header — mobile-first */}
      <header
        className="flex items-center justify-between gap-2 border-b border-border bg-background/95 px-2 backdrop-blur"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))", paddingBottom: "0.5rem" }}
      >
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Voltar" className="min-h-[44px]">
          <ArrowLeft className="h-5 w-5" />
          <span className="hidden sm:inline ml-1">Voltar</span>
        </Button>

        <div className="min-w-0 flex-1 text-center">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Documento</div>
          <div className="flex items-center justify-center gap-2">
            <span className="truncate font-mono text-sm font-bold text-primary">{code}</span>
            {status && (
              <span className="hidden sm:inline rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                {status}
              </span>
            )}
          </div>
          {status && (
            <div className="sm:hidden text-[10px] uppercase tracking-widest text-muted-foreground">{status}</div>
          )}
        </div>

        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar" className="min-h-[44px]">
          <X className="h-5 w-5" />
          <span className="hidden sm:inline ml-1">Fechar</span>
        </Button>
      </header>

      {/* Corpo */}
      <div ref={scrollRef} className="relative flex-1 overflow-auto bg-muted/30">
        {state === "loading" && (
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 p-4">
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Preparando documento…</span>
            </div>
            <Skeleton className="h-[70vh] w-full rounded-lg" />
          </div>
        )}

        {state === "error" && (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
            <FileWarning className="h-10 w-10 text-destructive" aria-hidden />
            <div>
              <h2 className="font-display text-lg font-bold">Não foi possível visualizar este documento.</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Você pode tentar novamente, baixar ou abrir em outro aplicativo.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={() => setAttempt((n) => n + 1)}>
                <RefreshCw className="h-4 w-4 mr-1" /> Tentar novamente
              </Button>
              <Button size="sm" variant="outline" onClick={download} disabled={!bytesRef.current}>
                <Download className="h-4 w-4 mr-1" /> Baixar
              </Button>
              <Button size="sm" variant="outline" onClick={openExternal} disabled={!bytesRef.current}>
                <ExternalLink className="h-4 w-4 mr-1" /> Abrir em outro aplicativo
              </Button>
              <Button size="sm" variant="ghost" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            </div>
          </div>
        )}

        {state === "ready" && docRef.current && (
          <PdfPages
            doc={docRef.current}
            numPages={numPages}
            zoom={zoom}
            scrollEl={scrollRef.current}
            onCurrentPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* Bottom action bar */}
      <footer
        className="flex items-center justify-between gap-2 border-t border-border bg-background/95 px-2 backdrop-blur"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))", paddingTop: "0.5rem" }}
      >
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={zoomOut} disabled={state !== "ready"} aria-label="Diminuir zoom" className="min-h-[44px] min-w-[44px]">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="tabular-nums text-xs text-muted-foreground w-14 text-center">
            {state === "ready" ? `${Math.round(zoom * 100)}%` : "—"}
          </span>
          <Button variant="outline" size="sm" onClick={zoomIn} disabled={state !== "ready"} aria-label="Aumentar zoom" className="min-h-[44px] min-w-[44px]">
            <ZoomIn className="h-4 w-4" />
          </Button>
          {numPages > 0 && (
            <span className="ml-2 tabular-nums text-xs text-muted-foreground">
              Página {currentPage} de {numPages}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={download} disabled={state !== "ready"} className="min-h-[44px]">
            <Download className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Baixar</span>
          </Button>
          <Button variant="outline" size="sm" onClick={share} disabled={state !== "ready"} className="min-h-[44px]">
            <Share2 className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Compartilhar</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Mais opções" className="min-h-[44px] min-w-[44px]">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top">
              <DropdownMenuItem onSelect={() => print()} disabled={state !== "ready"}>
                <Printer className="h-4 w-4 mr-2" /> Imprimir
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openExternal()} disabled={state !== "ready"}>
                <ExternalLink className="h-4 w-4 mr-2" /> Abrir em outro aplicativo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </footer>
    </div>
  );
}

/** Renderiza todas as páginas em canvas, com fit-to-width * zoom. */
function PdfPages({
  doc,
  numPages,
  zoom,
  scrollEl,
  onCurrentPageChange,
}: {
  doc: PdfDoc;
  numPages: number;
  zoom: number;
  scrollEl: HTMLDivElement | null;
  onCurrentPageChange: (page: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Rastreio de página atual conforme o scroll
  useEffect(() => {
    const root = scrollEl;
    const container = containerRef.current;
    if (!root || !container) return;
    const pageEls = Array.from(container.querySelectorAll<HTMLElement>("[data-page-number]"));
    if (pageEls.length === 0) return;
    const io = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) {
        const n = Number((visible.target as HTMLElement).dataset.pageNumber);
        if (n) onCurrentPageChange(n);
      }
    }, { root, threshold: [0.25, 0.5, 0.75] });
    pageEls.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [scrollEl, numPages, onCurrentPageChange]);

  const pages = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <div ref={containerRef} className="mx-auto flex max-w-3xl flex-col items-center gap-3 p-2 sm:p-4">
      {containerWidth > 0 && pages.map((n) => (
        <PdfPageCanvas
          key={n}
          doc={doc}
          pageNumber={n}
          targetWidth={Math.max(280, containerWidth - 16) * zoom}
        />
      ))}
    </div>
  );
}

function PdfPageCanvas({ doc, pageNumber, targetWidth }: { doc: PdfDoc; pageNumber: number; targetWidth: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;
    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const scale = targetWidth / base.width;
        const viewport = page.getViewport({ scale });
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        setSize({ w: viewport.width, h: viewport.height });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderTask = page.render({ canvasContext: ctx, viewport, canvas });
        await renderTask.promise;
        page.cleanup?.();
      } catch (err) {
        if (!cancelled) {
          console.error(`[TBPdfViewer] erro renderizando página ${pageNumber}`, err);
          setError(true);
        }
      }
    })();
    return () => { cancelled = true; try { renderTask?.cancel(); } catch { /* noop */ } };
  }, [doc, pageNumber, targetWidth]);

  return (
    <div
      data-page-number={pageNumber}
      className="relative w-full max-w-full overflow-hidden rounded-md border border-border bg-white shadow-sm"
      style={size ? { aspectRatio: `${size.w} / ${size.h}` } : { minHeight: 200 }}
    >
      <canvas ref={canvasRef} className="block h-auto w-full" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 p-3 text-center text-xs text-muted-foreground">
          Não foi possível renderizar a página {pageNumber}.
        </div>
      )}
    </div>
  );
}