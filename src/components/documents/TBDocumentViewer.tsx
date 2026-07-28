import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FileWarning, Loader2, Share2, X } from "lucide-react";
import { toast } from "sonner";

export type ViewerDoc = {
  id: string;
  bucket: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  title: string;
};

async function fetchBlob(doc: ViewerDoc): Promise<{ blob: Blob; mime: string }> {
  const { data, error } = await supabase.storage
    .from(doc.bucket)
    .createSignedUrl(doc.storage_path, 300);
  if (error || !data?.signedUrl) throw new Error(error?.message || "signed_url_failed");
  const res = await fetch(data.signedUrl);
  if (!res.ok) throw new Error(`http_${res.status}`);
  const blob = await res.blob();
  const mime = doc.mime_type || blob.type || "application/octet-stream";
  return { blob, mime: mime === "application/octet-stream" && doc.file_name?.toLowerCase().endsWith(".pdf") ? "application/pdf" : mime };
}

export function TBDocumentViewer({
  doc,
  onBack,
  onClose,
  backLabel = "Voltar",
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

  useEffect(() => {
    let cancelled = false;
    let currentUrl: string | null = null;
    setState("loading");
    setBlobUrl(null);
    blobRef.current = null;

    fetchBlob(doc)
      .then(({ blob, mime }) => {
        if (cancelled) return;
        blobRef.current = blob;
        currentUrl = URL.createObjectURL(blob);
        setBlobUrl(currentUrl);
        setMime(mime);
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
      const { blob, mime } = await fetchBlob(doc);
      blobRef.current = blob;
      const url = URL.createObjectURL(blob);
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setMime(mime);
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
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> };
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
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur">
        <Button variant="ghost" size="sm" onClick={onBack} className="min-h-[40px] shrink-0">
          <ArrowLeft className="h-4 w-4" />
          <span className="ml-1 hidden sm:inline">{backLabel}</span>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{doc.title}</div>
          {doc.file_name && <div className="truncate text-xs text-muted-foreground">{doc.file_name}</div>}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="min-h-[40px] shrink-0" aria-label="Encerrar apresentação">
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto bg-muted/30">
        {state === "loading" && (
          <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando documento…
          </div>
        )}
        {state === "error" && (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
            <FileWarning className="h-10 w-10 text-amber-500" />
            <div className="text-sm font-semibold">Não foi possível abrir o documento</div>
            <p className="text-xs text-muted-foreground">
              O link pode ter expirado ou o arquivo foi removido. Tente novamente.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={retry}>Tentar novamente</Button>
              <Button variant="ghost" size="sm" onClick={onBack}>Voltar</Button>
            </div>
            <div className="text-[11px] text-muted-foreground/70">{errorMsg}</div>
          </div>
        )}
        {state === "ready" && blobUrl && (
          <>
            {isPdf ? (
              <iframe
                src={blobUrl}
                title={doc.title}
                className="h-[calc(100dvh-8rem)] w-full border-0 bg-white"
              />
            ) : isImage ? (
              <div className="flex min-h-full items-center justify-center p-3">
                <img src={blobUrl} alt={doc.title} className="max-h-[calc(100dvh-10rem)] max-w-full rounded-lg shadow-sm" />
              </div>
            ) : (
              <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
                <FileWarning className="h-10 w-10 text-muted-foreground" />
                <div className="text-sm font-semibold">Prévia indisponível para este formato</div>
                <p className="text-xs text-muted-foreground">Use as opções abaixo para baixar ou compartilhar.</p>
              </div>
            )}
          </>
        )}
      </div>

      <footer className="sticky bottom-0 z-10 grid grid-cols-2 gap-2 border-t border-border bg-background/95 p-3 backdrop-blur">
        <Button variant="outline" onClick={download} disabled={state !== "ready"} className="min-h-[44px]">
          <Download className="mr-2 h-4 w-4" /> Baixar
        </Button>
        <Button onClick={share} disabled={state !== "ready"} className="min-h-[44px]">
          <Share2 className="mr-2 h-4 w-4" /> Compartilhar
        </Button>
      </footer>
    </div>
  );
}