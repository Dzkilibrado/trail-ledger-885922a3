import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { ComponentsList } from "@/components/components/ComponentsList";

export const Route = createFileRoute("/_authenticated/motorcycles/$id/components")({
  head: () => ({ meta: [{ title: "Componentes — TrailBook" }] }),
  component: ComponentsPage,
});

function ComponentsPage() {
  const { id } = Route.useParams();
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null));
  }, []);

  const moto = useQuery({
    queryKey: ["motorcycle", id],
    queryFn: async () =>
      (await supabase.from("motorcycles").select("*").eq("id", id).single()).data,
  });

  if (!moto.data) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="surface-elevated h-40 animate-pulse rounded-2xl" />
      </div>
    );
  }
  const m = moto.data;
  const isOwner = !!uid && (m as any).owner_id === uid;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <PageHeader
        title="Componentes"
        crumbs={[
          { label: "Motos", to: "/motorcycles" },
          { label: m.nickname || m.model, to: `/motorcycles/${m.id}` },
          { label: "Componentes" },
        ]}
        description="Toque em qualquer componente para ver o estado, histórico e registrar manutenção."
      />
      <ComponentsList moto={m as any} isOwner={isOwner} />
    </div>
  );
}
