import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { FileWarning, Loader2 } from "lucide-react";

/**
 * Renderizador PDF.js reutilizável — recebe bytes (Uint8Array) e desenha as
 * páginas em <canvas>. Sem iframes. Extraído do TBPdfViewer para uso genérico
 * (documentos da motocicleta, etc.) sem alterar o fluxo do Recibo Inteligente.
 */

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
};
type PdfPage = {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (opts: {
    canvasContext: CanvasRenderingContext2D;
    viewport: unknown;
    canvas?: HTMLCanvasElement;
  }) => { promise: Promise<void>; cancel: () => void };
  cleanup?: () => void;
};

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  (
    pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } }
  ).GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs as unknown as {
    getDocument: (src: { data: Uint8Array }) => { promise: Promise<PdfDoc> };
  };
}

export function PdfBytesView({
  bytes,
  scrollEl,
  zoom = 1,
  onError,
}: {
  bytes: Uint8Array | null;
  scrollEl: HTMLDivElement | null;
  zoom?: number;
  onError?: (err: unknown) => void;
}) {
  const docRef = useRef<PdfDoc | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    if (!bytes) {
      setState("idle");
      return;
    }
    setState("loading");
    (async () => {
      try {
        const pdfjs = await loadPdfJs();
        const task = pdfjs.getDocument({ data: bytes.slice() });
        const doc = await task.promise;
        if (cancelled) {
          void doc.destroy();
          return;
        }
        if (docRef.current) await docRef.current.destroy().catch(() => {});
        docRef.current = doc;
        setNumPages(doc.numPages);
        setState("ready");
      } catch (err) {
        console.error("[PdfBytesView] falha ao abrir documento", err);
        if (!cancelled) {
          setState("error");
          onError?.(err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bytes, onError]);

  useEffect(
    () => () => {
      if (docRef.current) void docRef.current.destroy().catch(() => {});
    },
    [],
  );

  if (state === "loading" || state === "idle") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 p-4">
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Preparando documento…</span>
        </div>
        <Skeleton className="h-[70vh] w-full rounded-lg" />
      </div>
    );
  }

  if (state === "error" || !docRef.current) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-6 text-center text-sm text-muted-foreground">
        <FileWarning className="h-8 w-8 text-destructive" aria-hidden />
        Não foi possível renderizar este documento.
      </div>
    );
  }

  return <PdfPages doc={docRef.current} numPages={numPages} zoom={zoom} scrollEl={scrollEl} />;
}

function PdfPages({
  doc,
  numPages,
  zoom,
}: {
  doc: PdfDoc;
  numPages: number;
  zoom: number;
  scrollEl: HTMLDivElement | null;
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

  const pages = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <div
      ref={containerRef}
      className="mx-auto flex max-w-3xl flex-col items-center gap-3 p-2 sm:p-4"
    >
      {containerWidth > 0 &&
        pages.map((n) => (
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

function PdfPageCanvas({
  doc,
  pageNumber,
  targetWidth,
}: {
  doc: PdfDoc;
  pageNumber: number;
  targetWidth: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;
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
          console.error(`[PdfBytesView] erro renderizando página ${pageNumber}`, err);
          setError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        /* noop */
      }
    };
  }, [doc, pageNumber, targetWidth]);

  return (
    <div
      data-page-number={pageNumber}
      className="relative mx-auto overflow-hidden rounded-md border border-border bg-white shadow-sm"
      style={
        size
          ? { width: size.w, aspectRatio: `${size.w} / ${size.h}` }
          : { minHeight: 200, width: targetWidth }
      }
    >
      <canvas
        ref={canvasRef}
        className="block h-auto"
        style={{ width: size ? size.w : targetWidth }}
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 p-3 text-center text-xs text-muted-foreground">
          Não foi possível renderizar a página {pageNumber}.
        </div>
      )}
    </div>
  );
}
