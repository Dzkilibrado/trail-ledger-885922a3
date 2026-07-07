import { createFileRoute } from "@tanstack/react-router";
import { Cockpit } from "@/components/cockpit/Cockpit";

export const Route = createFileRoute("/_authenticated/motorcycles/$id/")({
  head: () => ({ meta: [{ title: "Moto — TrailBook" }] }),
  component: MotoCockpitPage,
});

function MotoCockpitPage() {
  const { id } = Route.useParams();
  return <Cockpit motoId={id} />;
}
