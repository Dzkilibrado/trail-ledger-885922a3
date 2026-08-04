import { createFileRoute } from "@tanstack/react-router";
import { MotoControlCenter } from "@/components/MotoControlCenter";

export const Route = createFileRoute("/_authenticated/motorcycles/$id/control")({
  head: () => ({ meta: [{ title: "Centro de Controle — TrailBook" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    action: search.action === "registrar" ? ("registrar" as const) : undefined,
  }),
  component: MotoControlCenterPage,
});

function MotoControlCenterPage() {
  const { id } = Route.useParams();
  const { action } = Route.useSearch();
  return <MotoControlCenter id={id} autoOpenAction={action} />;
}
