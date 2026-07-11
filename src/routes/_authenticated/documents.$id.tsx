import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { MotorcycleDocuments } from "@/components/MotorcycleDocuments";
import { Skeleton } from "@/components/ui/skeleton";
import { Bike } from "lucide-react";

type DocsSearch = { kind?: "origin" };

export const Route = createFileRoute("/_authenticated/documents/$id")({
  head: () => ({ meta: [{ title: "Documentos — TrailBook" }] }),
  // Aceita ?kind=origin para abrir o fluxo de anexo do documento de origem.
  validateSearch: (raw: Record<string, unknown>): DocsSearch => {
    const kind = raw?.kind;
    return kind === "origin" ? { kind: "origin" } : {};
  },
  component: MotoDocs,
});

function MotoDocs() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const openOriginUpload = search.kind === "origin";
  const moto = useQuery({
    queryKey: ["moto-header", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("motorcycles")
        .select("id, nickname, brand, model, year_model, trailbook_id")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="📂 Minha Documentação"
        description="Cofre digital privado da sua motocicleta. Versionado, auditado e sempre disponível."
        crumbs={[{ label: "Documentos", to: "/documents" }, { label: "Moto" }]}
        backTo="/documents"
      />

      {moto.isLoading ? <Skeleton className="h-16 rounded-2xl" /> : moto.data && (
        <Link to="/motorcycles/$id" params={{ id }} className="surface-elevated flex items-center gap-3 rounded-2xl p-4 transition hover:border-primary/40">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Bike className="h-5 w-5" /></div>
          <div className="min-w-0">
            <div className="truncate font-semibold">
              {moto.data.nickname ?? `${moto.data.brand ?? ""} ${moto.data.model ?? ""}`.trim()} <span className="text-muted-foreground">· {moto.data.year_model}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">TrailBook ID · <span className="font-mono">{moto.data.trailbook_id ?? "—"}</span></div>
          </div>
        </Link>
      )}

      <MotorcycleDocuments motorcycleId={id} openOriginUpload={openOriginUpload} />
    </div>
  );
}