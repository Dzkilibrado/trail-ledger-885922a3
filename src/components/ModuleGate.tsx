import { PageLineSkeleton } from "@/components/Skeletons";
import { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Lock, Wrench, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModule } from "@/hooks/useModules";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { formatDate } from "@/lib/trailbook";

interface Props {
  moduleKey: string;
  children: ReactNode;
}

export function ModuleGate({ moduleKey, children }: Props) {
  const { module: mod, status, loading } = useModule(moduleKey);
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();

  if (loading) return <PageLineSkeleton />;
  if (!mod) return <>{children}</>;

  // Admin always sees the module
  if (isAdmin) {
    return (
      <>
        {status !== "active" && (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            Visualizando como administrador — este módulo está com status <b>{status}</b> para usuários comuns.
          </div>
        )}
        {children}
      </>
    );
  }

  if (status === "maintenance") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-500/30 bg-card p-8 text-center shadow">
        <Wrench className="mx-auto h-10 w-10 text-amber-400" />
        <h2 className="mt-3 font-display text-xl font-bold">🚧 Módulo em manutenção</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {mod.maintenance_message ||
            "Estamos realizando melhorias nesta funcionalidade. Em breve ela estará novamente disponível."}
        </p>
        {mod.maintenance_until && (
          <p className="mt-2 text-xs text-muted-foreground">
            Previsão de retorno: <b>{formatDate(mod.maintenance_until)}</b>
          </p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button asChild>
            <Link to="/dashboard"><Home className="h-4 w-4" /> Página inicial</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (status === "disabled") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
        <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-3 font-display text-lg font-semibold">Módulo indisponível</h2>
        <p className="mt-1 text-sm text-muted-foreground">Esta funcionalidade não está disponível no momento.</p>
        <div className="mt-6">
          <Button asChild variant="outline">
            <Link to="/dashboard"><Home className="h-4 w-4" /> Ir para o início</Link>
          </Button>
        </div>
      </div>
    );
  }

  // active | beta → render
  return <>{children}</>;
}