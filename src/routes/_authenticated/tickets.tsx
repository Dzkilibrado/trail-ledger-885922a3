import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/tickets")({
  component: TicketsLayout,
});

function TicketsLayout() {
  return <Outlet />;
}