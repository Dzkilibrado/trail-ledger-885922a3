import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { HealthOverview } from "@/components/health/HealthOverview";

export const Route = createFileRoute("/_authenticated/motorcycles/$id/health")({
  head: () => ({ meta: [{ title: "Saúde da moto — TrailBook" }] }),
  component: HealthPage,
});

function HealthPage() {
  const { id } = Route.useParams();
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null)); }, []);

  const moto = useQuery({
    queryKey: ["motorcycle", id],
    queryFn: async () => (await supabase.from("motorcycles").select("*").eq("id", id).single()).data,
  });

  if (!moto.data) {
    return <div className="mx-auto max-w-2xl"><div className="surface-elevated h-40 animate-pulse rounded-2xl" /></div>;
  }
  const m = moto.data;
  const isOwner = !!uid && (m as any).owner_id === uid;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <PageHeader
        title="Saúde da moto"
        crumbs={[
          { label: "Motos", to: "/motorcycles" },
          { label: m.nickname || m.model, to: `/motorcycles/${m.id}` },
          { label: "Saúde" },
        ]}
        description="Check-up rápido: veja o que está pronto, o que merece atenção e o que precisa ser resolvido."
      />
      <HealthOverview moto={m as any} isOwner={isOwner} />
    </div>
  );
}