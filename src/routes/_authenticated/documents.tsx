import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { FileText, Bike, ChevronRight, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [{ title: "Documentos da Moto — TrailBook" }] }),
  component: DocumentsHub,
});

function DocumentsHub() {
  const q = useQuery({
    queryKey: ["docs-hub"],
    queryFn: async () => {
      const { data: motos } = await supabase.from("motorcycles")
        .select("id, brand, model, year, nickname, trailbook_id, main_photo_bucket, main_photo_path")
        .order("created_at", { ascending: false });
      const { data: docs } = await supabase.from("motorcycle_documents" as never)
        .select("motorcycle_id, doc_type, is_current, deleted_at, updated_at");
      const rows = (docs ?? []) as unknown as Array<{
        motorcycle_id: string; doc_type: string; is_current: boolean;
        deleted_at: string | null; updated_at: string;
      }>;
      const byMoto: Record<string, { total: number; hasInvoice: boolean; last: string | null }> = {};
      for (const d of rows) {
        if (!d.is_current || d.deleted_at) continue;
        const e = (byMoto[d.motorcycle_id] ??= { total: 0, hasInvoice: false, last: null });
        e.total++;
        if (d.doc_type === "invoice") e.hasInvoice = true;
        if (!e.last || d.updated_at > e.last) e.last = d.updated_at;
      }
      return (motos ?? []).map((m) => ({ ...m, stats: byMoto[m.id] ?? { total: 0, hasInvoice: false, last: null } }));
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="📂 Minha Documentação"
        subtitle="Organize aqui todos os documentos importantes da sua motocicleta. Eles ficam protegidos, disponíveis sempre que você precisar e fazem parte do histórico permanente da moto."
      />

      {q.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <div className="surface-elevated grid place-items-center rounded-2xl p-10 text-center">
          <Bike className="h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Cadastre uma motocicleta para começar a documentar.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(q.data ?? []).map((m) => (
            <Link key={m.id} to="/documents/$id" params={{ id: m.id }}
                  className="surface-elevated flex items-center gap-3 rounded-2xl border border-border/70 p-4 transition hover:border-primary/50">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">
                  {m.nickname ?? `${m.brand} ${m.model}`} <span className="text-muted-foreground">· {m.year}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  <span className="font-mono">{m.trailbook_id ?? "—"}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px]">
                  <span className="rounded-md bg-muted px-1.5 py-0.5 font-bold">{m.stats.total} docs</span>
                  {m.stats.hasInvoice && <span className="flex items-center gap-1 text-emerald-400"><ShieldCheck className="h-3 w-3" /> NF</span>}
                  {m.stats.last && <span className="text-muted-foreground">· atualizado em {new Date(m.stats.last).toLocaleDateString("pt-BR")}</span>}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}