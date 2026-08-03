import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppWelcome } from "@/components/welcome/AppWelcome";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "TrailBook — O Especialista Digital em Saúde da Motocicleta" },
      {
        name: "description",
        content:
          "Entre no TrailBook e acompanhe manutenções, documentos e o histórico completo da sua moto off-road.",
      },
      {
        property: "og:title",
        content: "TrailBook — O Especialista Digital em Saúde da Motocicleta",
      },
      {
        property: "og:description",
        content:
          "Entre no TrailBook e acompanhe manutenções, documentos e o histórico completo da sua moto off-road.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WelcomeRoute,
});

function WelcomeRoute() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" as string, replace: true });
    });
  }, [navigate]);

  return <AppWelcome />;
}