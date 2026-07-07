import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/motorcycles/$id")({
  component: () => <Outlet />,
});
