/**
 * Rota pública: /d/:token
 * Exibe o cofre de documentos de uma motocicleta via token de compartilhamento.
 * Sem necessidade de login. Token gerado na emissão de laudos Comerciais.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  ChevronRight,
  Inbox,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  Info,
  XCircle,
} from "lucide-react";
import { getPublicDocumentShare } from "@/lib/document-shares.functions";
import { TBLoadingState } from "@/design-system";
import { formatDate } from "@/lib/trailbook";

export const Route = createFileRoute("/d/$token")({
  head: () => ({
    meta: [
      { title: "Documentos da Moto — TrailBook" },
      {
        name: "description",
        content: "Acesso ao cofre de documentos da motocicleta compartilhado via TrailBook.",
      },
      { property: "og:title", content: "Documentos da Moto — TrailBook" },
      {
        property: "og:description",
        content:
          "Nota Fiscal, Recibo de Compra e Venda e outros documentos da motocicleta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicDocumentVaultPage,
});

const DOC_TYPE_ICONS: Record<string, string> = {
  bill_of_sale: "🖋️",
  invoice: "🧾",
  manual: "📘",
  warranty: "🛡️",
  import: "🌍",
  certificate: "🏅",
  workshop_receipt: "🔧",
  inspection_report: "📋",
  photo: "🖼️",
  contract: "📝",
  other: "📄",
};

function PublicDocumentVaultPage() {
  const { token } = Route.useParams();
  const [openUrl, setOpenUrl] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["public-doc-share", token],
    queryFn: () => getPublicDocumentShare({ data: { token } }),
    staleTime: 60_000,
  });

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <TBLoadingState label="Verificando acesso…" />
      </div>
    );
  }

  if (q.error || !q.data) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center">
          <XCircle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-3 text-lg font-bold">Não foi possível abrir os documentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tente novamente em instantes ou solicite um novo link ao proprietário.
          </p>
        </div>
      </div>
    );
  }

  const result = q.data;

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-3 text-lg font-bold">Acesso indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">{result.reason}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            O link pode ter expirado ou sido revogado pelo proprietário.
            Solicite um novo link diretamente ao dono da motocicleta.
          </p>
        </div>
      </div>
    );
  }

  const { motorcycleLabel, docs } = result;

  // Viewer de documento em tela cheia (iframe/embed)
  if (openUrl) {
    return (
      <div className="flex h-dvh flex-col bg-background">
        <header className="flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={() => setOpenUrl(null)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent"
          >
            ← Voltar
          </button>
          <span className="truncate text-sm font-semibold">{motorcycleLabel}</span>
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
            aria-label="Abrir em nova aba"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </header>
        <iframe
          src={openUrl}
          title="Documento"
          className="flex-1 w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 pb-20">
      {/* Cabeçalho */}
      <header className="space-y-1 pt-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>TrailBook · Cofre de Documentos</span>
        </div>
        <h1 className="text-2xl font-black">{motorcycleLabel}</h1>
        <p className="text-sm text-muted-foreground">
          Acesso compartilhado pelo proprietário via laudo comercial.
        </p>
      </header>

      {/* Aviso */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Estes documentos foram compartilhados pelo proprietário para fins de comprovação
          de origem e histórico.{" "}
          <strong>Eles não substituem documentos oficiais</strong> exigidos pelas
          autoridades.
        </p>
      </div>

      {/* Lista de documentos */}
      {docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">Nenhum documento disponível</p>
          <p className="mt-1 text-xs text-muted-foreground">
            O proprietário ainda não cadastrou documentos nesta moto.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => {
            const icon = DOC_TYPE_ICONS[d.doc_type] ?? "📄";
            const label = d.custom_label?.trim() || d.doc_type_label;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => d.signedUrl && setOpenUrl(d.signedUrl)}
                  disabled={!d.signedUrl}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent/40 active:bg-accent/60 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-lg">
                    <span aria-hidden>{icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{label}</span>
                      {d.is_origin_document && (
                        <span className="shrink-0 rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Origem
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                      {d.doc_date && <span>{formatDate(d.doc_date)}</span>}
                      {d.issuer && <span className="truncate">· {d.issuer}</span>}
                      {d.file_name && (
                        <span className="truncate text-muted-foreground/60">
                          {d.file_name}
                        </span>
                      )}
                    </div>
                  </div>
                  {d.signedUrl ? (
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="h-5 w-5 shrink-0 text-muted-foreground/40" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Rodapé informativo */}
      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          Os links de visualização expiram em 5 minutos por sessão. Este acesso pode ser
          revogado pelo proprietário a qualquer momento.
        </p>
      </div>

      {/* Marca TrailBook */}
      <div className="pt-2 text-center text-xs text-muted-foreground/50">
        Powered by TrailBook
      </div>
    </div>
  );
}
