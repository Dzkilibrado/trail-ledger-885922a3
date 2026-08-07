import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Download,
  FileWarning,
  Loader2,
  RefreshCw,
  Share2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { PdfBytesView } from "@/components/pdf/PdfBytesView";

export type ViewerDoc = {
  id: string;
  bucket: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  title: string;
};

async function fetchBlob(doc: ViewerDoc): Promise<{ blob: Blob; mime: string; bytes: Uint8Array }> {
  const { data, error } = await supabase.storage
    .from(doc.bucket)
    .createSignedUrl(doc.storage_path, 300);
  if (error || !data?.signedUrl) throw new Error(error?.message || "signed_url_failed");
  const res = await fetch(data.signedUrl);
  if (!res.ok) throw new Error(`http_${res.status}`);
  const buf = await res.arrayBuffer();
  const blob = new Blob([buf], {
    type: doc.mime_type || res.headers.get("content-type") || "application/octet-stream",
  });
  let mime = doc.mime_type || blob.type || "application/octet-stream";
  if (
    (mime === "application/octet-stream" || !mime) &&
    doc.file_name?.toLowerCase().endsWith(".pdf")
  )
    mime = "application/pdf";
  return { blob, mime, bytes: new Uint8Array(buf) };
}

export function TBDocumentViewer({
  doc,
  onBack,
  onClose,
  backLabel = "Voltar aos documentos",
}: {
  doc: ViewerDoc;
  onBack: () => void;
  onClose: () => void;
  backLabel?: string;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mime, setMime] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const blobRef = useRef<Blob | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let currentUrl: string | null = null;
    setState("loading");
    setBlobUrl(null);
    setPdfBytes(null);
    blobRef.current = null;

    fetchBlob(doc)
      .then(({ blob, mime, bytes }) => {
        if (cancelled) return;
        blobRef.current = blob;
        setMime(mime);
        if (mime === "application/pdf") {
          setPdfBytes(bytes);
        } else {
          currentUrl = URL.createObjectURL(blob);
          setBlobUrl(currentUrl);
        }
        setState("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setErrorMsg(msg);
        setState("error");
      });

    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [doc.id, doc.bucket, doc.storage_path]);

  async function retry() {
    setState("loading");
    try {
      const { blob, mime, bytes } = await fetchBlob(doc);
      blobRef.current = blob;
      setMime(mime);
      if (mime === "application/pdf") {
        setBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setPdfBytes(bytes);
      } else {
        const url = URL.createObjectURL(blob);
        setBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setPdfBytes(null);
      }
      setState("ready");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  }

  async function download() {
    try {
      let blob = blobRef.current;
      if (!blob) blob = (await fetchBlob(doc)).blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name || `${doc.title || "documento"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Não foi possível baixar o arquivo.");
    }
  }

  async function share() {
    try {
      const blob = blobRef.current ?? (await fetchBlob(doc)).blob;
      const file = new File([blob], doc.file_name || `${doc.title}.pdf`, {
        type: mime || blob.type || "application/pdf",
      });
      const nav = navigator as Navigator & {
        canShare?: (d: ShareData) => boolean;
        share?: (d: ShareData) => Promise<void>;
      };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: doc.title });
        return;
      }
      await download();
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      toast.error("Não foi possível compartilhar. O download foi iniciado.");
      await download();
    }
  }

  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";

  return (
    <div className="flex h-full flex-col bg-background">
      <header
        className="sticky top-0 z-10 border-b border-border bg-background/95 px-2 backdrop-blur"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))", paddingBottom: "0.5rem" }}
      >
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="min-h-[44px] shrink-0 px-2"
            aria-label={backLabel}
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="ml-1 text-sm font-semibold">Voltar</span>
            <span className="ml-1 hidden text-sm font-semibold sm:inline">aos documentos</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="min-h-[44px] shrink-0"
            aria-label="Encerrar apresentação"
          >
            <X className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Encerrar</span>
          </Button>
        </div>
        <div className="mt-1 px-1">
          <div className="truncate text-sm font-semibold">{doc.title}</div>
          {doc.file_name && (
            <div className="truncate text-xs text-muted-foreground">{doc.file_name}</div>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-muted/30">
        {state === "loading" && (
          <div className="mx-auto flex max-w-md flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="font-semibold text-foreground">{doc.title}</div>
            <div>Preparando documento…</div>
          </div>
        )}
        {state === "error" && (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
            <FileWarning className="h-10 w-10 text-amber-500" />
            <div className="text-sm font-semibold">Não foi possível visualizar este documento.</div>
            <p className="text-xs text-muted-foreground">
              O link pode ter expirado ou o arquivo está temporariamente indisponível.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={retry}>
                <RefreshCw className="mr-1 h-4 w-4" />
                Tentar novamente
              </Button>
              <Button variant="outline" size="sm" onClick={download}>
                <Download className="mr-1 h-4 w-4" />
                Baixar documento
              </Button>
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Voltar aos documentos
              </Button>
            </div>
            {errorMsg && <div className="sr-only">{errorMsg}</div>}
          </div>
        )}
        {state === "ready" && (
          <>
            {isPdf && pdfBytes ? (
              <PdfBytesView bytes={pdfBytes} scrollEl={scrollRef.current} zoom={zoom} />
            ) : isImage && blobUrl ? (
              <div className="flex min-h-full items-center justify-center p-3">
                <img
                  src={blobUrl}
                  alt={doc.title}
                  className="max-h-[calc(100dvh-10rem)] max-w-full rounded-lg shadow-sm"
                />
              </div>
            ) : (
              <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
                <FileWarning className="h-10 w-10 text-muted-foreground" />
                <div className="text-sm font-semibold">Prévia indisponível para este formato</div>
                <p className="text-xs text-muted-foreground">
                  Use as opções abaixo para baixar ou compartilhar.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <footer
        className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-border bg-background/95 px-2"
        style={{ paddingTop: "0.5rem", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        {isPdf && (
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
              disabled={state !== "ready"}
              aria-label="Diminuir zoom"
              className="min-h-[44px] min-w-[44px]"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center tabular-nums text-xs text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
              disabled={state !== "ready"}
              aria-label="Aumentar zoom"
              className="min-h-[44px] min-w-[44px]"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={download}
            disabled={state !== "ready"}
            className="min-h-[44px]"
          >
            <Download className="mr-2 h-4 w-4 shrink-0" /> Baixar
          </Button>
          <Button onClick={share} disabled={state !== "ready"} className="min-h-[44px]">
            <Share2 className="mr-2 h-4 w-4 shrink-0" /> Compartilhar
          </Button>
        </div>
      </footer>
    </div>
  );
}
