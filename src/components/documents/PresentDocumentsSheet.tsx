import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { DOC_TYPE_LABEL, DOC_TYPE_ICON, type DocType } from "@/lib/motorcycle-documents";
import { formatDate } from "@/lib/trailbook";
import { FileText, ChevronRight, Inbox, Info, Loader2, X, ShieldAlert } from "lucide-react";
import { TBDocumentViewer, type ViewerDoc } from "./TBDocumentViewer";

type Row = {
  id: string;
  doc_type: DocType;
  bucket: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  doc_date: string | null;
  issuer: string | null;
  custom_label: string | null;
  is_origin_document: boolean | null;
  created_at: string;
};

/** Tipos documentais oficiais (DOC_TYPES existentes) usados na apresentação de origem. */
const RELEVANT_TYPES: DocType[] = ["invoice", "bill_of_sale", "import", "contract"];

function priority(r: Row): number {
  if (r.doc_type === "invoice") return 0;
  if (r.doc_type === "bill_of_sale") return 1;
  if (r.doc_type === "import") return 2;
  if (r.doc_type === "contract") return 3;
  if (r.is_origin_document) return 4;
  return 5;
}

function titleFor(r: Row): string {
  const base = r.custom_label?.trim() || DOC_TYPE_LABEL[r.doc_type] || "Documento";
  return base;
}

export function PresentDocumentsSheet({
  open,
  onOpenChange,
  motorcycleId,
  motorcycleLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  motorcycleId: string;
  motorcycleLabel?: string;
}) {
  const [selected, setSelected] = useState<ViewerDoc | null>(null);

  const q = useQuery({
    queryKey: ["present-documents", motorcycleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorcycle_documents")
        .select("id, doc_type, bucket, storage_path, file_name, mime_type, doc_date, issuer, custom_label, is_origin_document, created_at, deleted_at, is_current")
        .eq("motorcycle_id", motorcycleId)
        .is("deleted_at", null)
        .eq("is_current", true);
      if (error) throw error;
      const rows = (data ?? []) as unknown as (Row & { deleted_at: null; is_current: true })[];
      return rows.filter((r) => RELEVANT_TYPES.includes(r.doc_type) || r.is_origin_document === true);
    },
    enabled: open,
    staleTime: 30_000,
  });

  const docs = useMemo(() => {
    const list = (q.data ?? []).slice();
    list.sort((a, b) => priority(a) - priority(b) || (b.doc_date ?? b.created_at).localeCompare(a.doc_date ?? a.created_at));
    return list;
  }, [q.data]);

  function handleOpenChange(v: boolean) {
    if (!v) setSelected(null);
    onOpenChange(v);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[100dvh] max-h-[100dvh] w-full max-w-full overflow-hidden p-0 sm:max-w-full"
        hideClose
      >
        {selected ? (
          <TBDocumentViewer
            doc={selected}
            backLabel="Voltar à lista"
            onBack={() => setSelected(null)}
            onClose={() => handleOpenChange(false)}
          />
        ) : (
          <div className="flex h-full flex-col bg-background">
            <header className="sticky top-0 z-10 flex items-start gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Apresentar documentos</div>
                <h2 className="truncate text-lg font-black">{motorcycleLabel ?? "Minha motocicleta"}</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenChange(false)}
                className="min-h-[40px] shrink-0"
                aria-label="Encerrar apresentação"
              >
                <X className="h-4 w-4" />
              </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              <div className="mx-auto max-w-2xl space-y-4 p-4">
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Estes documentos auxiliam na comprovação de origem e histórico da motocicleta.
                    <strong className="ml-1">Eles não substituem documentos oficiais</strong> exigidos pelas autoridades.
                  </p>
                </div>

                {q.isLoading && (
                  <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando documentos…
                  </div>
                )}

                {q.isError && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                    Não foi possível carregar os documentos. Tente novamente.
                  </div>
                )}

                {!q.isLoading && !q.isError && docs.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                    <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
                    <div className="mt-3 text-sm font-semibold">Nenhum documento cadastrado</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Cadastre a Nota Fiscal, o Recibo de Compra e Venda ou outros documentos de origem para poder apresentá-los rapidamente.
                    </p>
                    <Button asChild className="mt-4 min-h-[44px]" onClick={() => handleOpenChange(false)}>
                      <Link to="/motorcycles/$id" params={{ id: motorcycleId }}>
                        Cadastrar documento
                      </Link>
                    </Button>
                  </div>
                )}

                {docs.length > 0 && (
                  <ul className="space-y-2">
                    {docs.map((d) => {
                      const label = titleFor(d);
                      const icon = DOC_TYPE_ICON[d.doc_type] ?? "📄";
                      return (
                        <li key={d.id}>
                          <button
                            type="button"
                            onClick={() =>
                              setSelected({
                                id: d.id,
                                bucket: d.bucket,
                                storage_path: d.storage_path,
                                file_name: d.file_name,
                                mime_type: d.mime_type,
                                title: label,
                              })
                            }
                            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent/40 active:bg-accent/60"
                          >
                            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-lg">
                              <span aria-hidden>{icon}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="truncate text-sm font-semibold">{label}</div>
                                {d.is_origin_document && (
                                  <Badge variant="outline" className="shrink-0 border-primary/40 text-[10px] text-primary">
                                    Origem
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                                {d.doc_date && <span>{formatDate(d.doc_date)}</span>}
                                {d.issuer && <span className="truncate">· {d.issuer}</span>}
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>Os arquivos permanecem privados. Ao tocar em "Visualizar", geramos um acesso temporário de 5 minutos apenas para esta sessão.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}