import { createFileRoute } from "@tanstack/react-router";
import { MotoControlCenter } from "@/components/MotoControlCenter";

export const Route = createFileRoute("/_authenticated/motorcycles/$id/control")({
  head: () => ({ meta: [{ title: "Centro de Controle — TrailBook" }] }),
  component: MotoControlCenterPage,
});

function MotoControlCenterPage() {
  const { id } = Route.useParams();
  return <MotoControlCenter id={id} />;
}