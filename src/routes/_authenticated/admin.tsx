import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return <Outlet />;
}

export function AccessDenied() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center">
      <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
      <h2 className="mt-3 font-display text-lg font-semibold">Acesso restrito</h2>
      <p className="mt-1 text-sm text-muted-foreground">Esta área é exclusiva de administradores TrailBook.</p>
    </div>
  );
}