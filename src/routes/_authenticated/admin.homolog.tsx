import { PageLineSkeleton } from "@/components/Skeletons";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, FlaskConical, RefreshCw, Trash2, Users, Bike } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AccessDenied } from "./admin";
import {
  seedHomologEnvironment,
  resetHomologEnvironment,
  listHomologSummary,
} from "@/lib/homolog.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/homolog")({
  head: () => ({ meta: [{ title: "Ambiente de Homologação — TrailBook" }] }),
  component: HomologAdmin,
});

function HomologAdmin() {
  const { isAdmin, loading } = useIsAdmin();
  const qc = useQueryClient();
  const list = useServerFn(listHomologSummary);
  const seed = useServerFn(seedHomologEnvironment);
  const reset = useServerFn(resetHomologEnvironment);
  const [confirmation, setConfirmation] = useState("");

  const summary = useQuery({
    queryKey: ["admin", "homolog", "summary"],
    enabled: isAdmin,
    queryFn: () => list(),
  });

  const seedMut = useMutation({
    mutationFn: () => seed(),
    onSuccess: (r) => {
      toast.success(
        `Ambiente pronto — ${r.report.users.length} contas, ${r.report.motorcycles.length} motos`,
      );
      qc.invalidateQueries({ queryKey: ["admin", "homolog", "summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMut = useMutation({
    mutationFn: () => reset({ data: { confirmation } }),
    onSuccess: (r) => {
      toast.success(`Reset concluído — ${r.deleted_motos} motos removidas`);
      setConfirmation("");
      qc.invalidateQueries({ queryKey: ["admin", "homolog", "summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <div className="text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return <AccessDenied />;

  const users = summary.data?.users ?? [];
  const motos = summary.data?.motorcycles ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ambiente Permanente de Homologação"
        description="Cenários fictícios para QA, regressão e validação de novas funcionalidades. Nunca usar dados reais."
      />

      <div className="surface-elevated rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" />
          <div className="text-sm">
            <p className="font-semibold text-amber-200">Ambiente separado dos dados reais</p>
            <p className="mt-1 text-muted-foreground">
              Todas as contas (@homolog.trailbook.test) e motos ([HOMOLOG]) ficam marcadas com{" "}
              <code className="rounded bg-muted/50 px-1">is_homologation = true</code>. Não confundir com o
              futuro Demo Mode (uso comercial). Consulte{" "}
              <a className="text-primary hover:underline" href="/docs/homologacao/README.md" target="_blank" rel="noreferrer">
                docs/homologacao
              </a>{" "}
              para a lista completa de cenários.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="surface-elevated rounded-2xl p-5">
          <div className="mb-3 flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            <h3 className="font-display font-semibold">Provisionar / Atualizar</h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Cria (ou atualiza) as 5 contas de homologação e 10 motocicletas fictícias.
            Idempotente — pode rodar quantas vezes quiser.
          </p>
          <Button onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
            <RefreshCw className={seedMut.isPending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            {seedMut.isPending ? "Provisionando…" : "Provisionar ambiente"}
          </Button>
        </div>

        <div className="surface-elevated rounded-2xl border border-destructive/30 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-destructive" />
            <h3 className="font-display font-semibold">Resetar dados</h3>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            Remove todas as motos de homologação (e dados associados via cascade). As contas são preservadas
            para o próximo seed.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder='Digite "RESETAR HOMOLOG"'
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
            <Button
              variant="destructive"
              onClick={() => resetMut.mutate()}
              disabled={resetMut.isPending || confirmation !== "RESETAR HOMOLOG"}
            >
              Resetar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-elevated rounded-2xl p-5">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-400" />
            <h3 className="font-display font-semibold">Contas ({users.length})</h3>
          </div>
          {summary.isLoading ? (
            <Skeleton className="h-32 rounded-lg" />
          ) : users.length === 0 ? (
            <EmptyLine text="Nenhuma conta de homologação. Clique em Provisionar ambiente." />
          ) : (
            <ul className="space-y-2">
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <div>
                    <div className="font-medium">{u.full_name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <Badge variant="outline">{u.plan}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface-elevated rounded-2xl p-5">
          <div className="mb-3 flex items-center gap-2">
            <Bike className="h-4 w-4 text-primary" />
            <h3 className="font-display font-semibold">Motocicletas ({motos.length})</h3>
          </div>
          {summary.isLoading ? (
            <Skeleton className="h-32 rounded-lg" />
          ) : motos.length === 0 ? (
            <EmptyLine text="Nenhuma moto de homologação ainda." />
          ) : (
            <ul className="space-y-2">
              {motos.map((m) => (
                <li key={m.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{m.nickname}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.brand} {m.model} · {m.year_model}
                    </div>
                  </div>
                  <Badge variant={m.status === "archived" ? "secondary" : "outline"}>{m.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{text}</p>;
}