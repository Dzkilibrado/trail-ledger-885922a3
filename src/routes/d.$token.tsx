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
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  Info,
  XCircle,
  Bike,
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

  // Viewer de documento em tela cheia (iframe para PDF/outros, img para imagens)
  if (openUrl) {
    const isImage = openUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)/i) ||
      docs.find(d => d.signedUrl === openUrl)?.mime_type?.startsWith("image/");
    return (
      <div className="flex h-dvh flex-col bg-background">
        <header className="flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <button
            type="button"
            onClick={() => setOpenUrl(null)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
          >
            ← Voltar
          </button>
          <span className="min-w-0 truncate text-sm font-semibold text-foreground">
            {docs.find(d => d.signedUrl === openUrl)?.custom_label?.trim()
              || docs.find(d => d.signedUrl === openUrl)?.doc_type_label
              || motorcycleLabel}
          </span>
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
            aria-label="Abrir em nova aba"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Abrir em nova aba</span>
          </a>
        </header>
        {isImage ? (
          <div className="flex-1 overflow-auto flex items-start justify-center p-4 bg-muted/20">
            <img
              src={openUrl}
              alt="Documento"
              className="max-w-full rounded-lg shadow-lg"
            />
          </div>
        ) : (
          <iframe
            src={openUrl}
            title="Documento"
            className="flex-1 w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-xl space-y-4 px-4 py-6 pb-16">

        {/* Marca TrailBook no topo */}
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground/70">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Bike className="h-4 w-4" />
          </div>
          <span>TrailBook</span>
        </div>

        {/* Cabeçalho */}
        <header className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            <span>Cofre de Documentos</span>
          </div>
          <h1 className="text-2xl font-black leading-tight">{motorcycleLabel}</h1>
          <p className="text-sm text-muted-foreground">
            Documentos compartilhados pelo proprietário.
          </p>
        </header>

        {/* Aviso de autenticidade */}
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/8 p-3.5 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>
            Documentos disponibilizados pelo proprietário para comprovação de origem e histórico.{" "}
            <strong>Não substituem documentos oficiais</strong> exigidos pelas autoridades.
          </p>
        </div>

        {/* Lista de documentos */}
        {docs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-10 text-center space-y-3">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted">
              <Inbox className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-base font-bold">Cofre vazio</p>
              <p className="mt-1 text-sm text-muted-foreground">
                O proprietário ainda não adicionou documentos a esta moto no TrailBook.
              </p>
            </div>
            <p className="text-xs text-muted-foreground/70">
              Documentos como Nota Fiscal, Recibo de Compra e Venda e histórico de manutenção
              podem ser cadastrados pelo proprietário e aparecem aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground px-1">
              {docs.length} {docs.length === 1 ? "documento" : "documentos"}
            </p>
            <ul className="space-y-2">
              {docs.map((d) => {
                const icon = DOC_TYPE_ICONS[d.doc_type] ?? "📄";
                const label = d.custom_label?.trim() || d.doc_type_label;
                const canOpen = !!d.signedUrl;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => canOpen && setOpenUrl(d.signedUrl!)}
                      disabled={!canOpen}
                      className="group flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 text-left shadow-sm transition-all hover:border-primary/30 hover:shadow-md active:scale-[0.99] disabled:opacity-40 disabled:cursor-default"
                    >
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/8 text-xl transition-colors group-hover:bg-primary/15">
                        <span aria-hidden>{icon}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{label}</span>
                          {d.is_origin_document && (
                            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                              Origem
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          {d.doc_date && <span>{formatDate(d.doc_date)}</span>}
                          {d.issuer && (
                            <>
                              <span className="text-muted-foreground/40">·</span>
                              <span className="truncate">{d.issuer}</span>
                            </>
                          )}
                          {d.file_name && !d.issuer && (
                            <span className="truncate text-muted-foreground/50">{d.file_name}</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {canOpen ? (
                          <ChevronRight className="h-5 w-5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                        ) : (
                          <FileText className="h-5 w-5 text-muted-foreground/30" />
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Rodapé informativo */}
        <div className="flex items-start gap-2 rounded-xl border border-border/50 bg-muted/30 p-3 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Os links de visualização expiram em 5 minutos por sessão. Este acesso pode ser
            revogado pelo proprietário a qualquer momento.
          </p>
        </div>

        {/* Rodapé TrailBook */}
        <div className="pt-1 text-center">
          <p className="text-[11px] text-muted-foreground/40">
            Cofre de documentos por{" "}
            <a
              href="https://trailbook.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:underline"
            >
              TrailBook
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
