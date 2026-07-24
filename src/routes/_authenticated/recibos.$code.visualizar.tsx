import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getReceiptPdfBytes } from "@/lib/smart-receipts.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, RefreshCw, Share2, X, FileWarning, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { publicReceiptUrl } from "@/lib/smart-receipts";

type SearchParams = { variant?: "signed" | "original" };

export const Route = createFileRoute("/_authenticated/recibos/$code/visualizar")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    variant: search.variant === "original" ? "original" : "signed",
  }),
  head: ({ params }) => ({
    meta: [
      { title: `Visualizar recibo ${params.code} — TrailBook` },
      { name: "description", content: `Visualização controlada do Recibo Inteligente ${params.code}.` },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ReceiptViewer,
});

function ReceiptViewer() {
  const { code } = Route.useParams();
  const { variant = "signed" } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const pdfBytesFn = useServerFn(getReceiptPdfBytes);

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const currentUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const res = await pdfBytesFn({ data: { code, variant } });
        if (cancelled) return;
        if (!res.found) { setStatus("error"); return; }
        const bin = atob(res.base64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const blob = new Blob([arr], { type: res.contentType });
        const url = URL.createObjectURL(blob);
        if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
        currentUrlRef.current = url;
        setBytes(arr);
        setBlobUrl(url);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [code, variant, attempt, pdfBytesFn]);

  useEffect(() => () => {
    if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
  }, []);

  const filename = useMemo(() => `${code}${variant === "signed" ? "-assinado" : ""}.pdf`, [code, variant]);

  function goBack() {
    if (window.history.length > 1) router.history.back();
    else navigate({ to: "/central" });
  }
  function close() { navigate({ to: "/central" }); }

  function download() {
    if (!bytes) return;
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5_000);
  }

  async function share() {
    const pageUrl = publicReceiptUrl(code);
    const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
    if (nav?.share) {
      try { await nav.share({ title: `Recibo TrailBook ${code}`, text: `Recibo Inteligente TrailBook — valide em ${pageUrl}`, url: pageUrl }); return; }
      catch { return; }
    }
    try { await navigator.clipboard.writeText(pageUrl); toast.success("Link do recibo copiado"); }
    catch { toast.info(pageUrl); }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header
        className="flex items-center justify-between gap-2 border-b border-border bg-background/95 px-3 backdrop-blur"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))", paddingBottom: "0.5rem" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={goBack} aria-label="Voltar">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Voltar</span>
          </Button>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Visualizar recibo</div>
            <div className="truncate font-mono text-sm font-bold text-primary">{code}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={download} disabled={status !== "ready"}>
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Baixar</span>
          </Button>
          <Button size="sm" variant="outline" onClick={share}>
            <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Compartilhar</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={close} aria-label="Fechar">
            <X className="h-4 w-4" /> <span className="hidden sm:inline">Fechar</span>
          </Button>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden bg-muted/20">
        {status === "loading" && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Carregando recibo…</p>
          </div>
        )}
        {status === "error" && (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
            <FileWarning className="h-10 w-10 text-destructive" />
            <div>
              <h2 className="font-display text-lg font-bold">Não foi possível abrir o recibo</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Gere uma nova visualização ou faça o download do documento.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={() => setAttempt((n) => n + 1)}>
                <RefreshCw className="h-4 w-4" /> Tentar novamente
              </Button>
              <Button size="sm" variant="outline" onClick={goBack}>
                <ArrowLeft className="h-4 w-4" /> Voltar ao TrailBook
              </Button>
            </div>
          </div>
        )}
        {status === "ready" && blobUrl && (
          <iframe
            key={blobUrl}
            title={`Recibo ${code}`}
            src={blobUrl}
            className="h-full w-full border-0"
          />
        )}
      </div>
    </div>
  );
}