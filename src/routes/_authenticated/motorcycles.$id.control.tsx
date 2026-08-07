import { createFileRoute } from "@tanstack/react-router";
import { MotoControlCenter } from "@/components/MotoControlCenter";

const VALID_TABS = [
  "geral",
  "checkup",
  "componentes",
  "atividade",
  "documentos",
  "historico",
] as const;
type ControlTab = (typeof VALID_TABS)[number];

export const Route = createFileRoute("/_authenticated/motorcycles/$id/control")({
  head: () => ({ meta: [{ title: "Centro de Controle — TrailBook" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    action: search.action === "registrar" ? ("registrar" as const) : undefined,
    tab: VALID_TABS.includes(search.tab as ControlTab) ? (search.tab as ControlTab) : undefined,
  }),
  component: MotoControlCenterPage,
});

function MotoControlCenterPage() {
  const { id } = Route.useParams();
  const { action, tab } = Route.useSearch();
  return <MotoControlCenter id={id} autoOpenAction={action} initialTab={tab} />;
}
