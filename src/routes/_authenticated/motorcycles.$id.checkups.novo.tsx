import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { CheckupWizard } from "@/components/health/checkup/CheckupWizard";

export const Route = createFileRoute("/_authenticated/motorcycles/$id/checkups/novo")({
  head: () => ({
    meta: [
      { title: "Check-up Inteligente — TrailBook" },
      {
        name: "description",
        content: "Faça o Check-up da sua moto e emita o Laudo Inteligente TrailBook.",
      },
      { property: "og:title", content: "Check-up Inteligente — TrailBook" },
      {
        property: "og:description",
        content: "Análise guiada da saúde da moto com emissão de laudo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewCheckupPage,
});

function NewCheckupPage() {
  const { id } = Route.useParams();
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null));
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <PageHeader
        title="Check-up Inteligente"
        crumbs={[
          { label: "Motos", to: "/motorcycles" },
          { label: "Check-ups", to: `/motorcycles/${id}/checkups` },
          { label: "Novo" },
        ]}
        description="Em poucos passos você revisa os dados, vê o resultado e emite o laudo da sua moto."
      />
      <CheckupWizard motoId={id} uid={uid} />
    </div>
  );
}
