import type { CockpitSnapshot } from "@/lib/til";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { NewEventDialog } from "@/components/NewEventDialog";
import type { Database } from "@/integrations/supabase/types";

type Moto = Database["public"]["Tables"]["motorcycles"]["Row"];

export function NextActionWidget({
  snapshot,
  moto,
}: {
  snapshot: CockpitSnapshot;
  moto: Moto;
}) {
  const action = snapshot.nextAction;
  if (!action) return null;

  return (
    <section
      aria-label="Próxima ação sugerida"
      className="surface-elevated rounded-2xl p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Sugestão do TrailBook
          </div>
          <div className="text-sm text-muted-foreground">{action.reason}</div>
        </div>
        <div className="shrink-0">
          {action.kind === "review_plan" && (
            <Button asChild size="lg" className="btn-glow w-full sm:w-auto">
              <Link to="/motorcycles/$id/plan" params={{ id: moto.id }} search={{ first: true }}>
                {action.label}
              </Link>
            </Button>
          )}
          {action.kind === "register_maintenance" && (
            <NewEventDialog moto={moto} triggerLabel={action.label} />
          )}
          {action.kind === "register_activity" && (
            <NewEventDialog moto={moto} triggerLabel={action.label} />
          )}
          {(action.kind === "renew_document" || action.kind === "add_photo") && (
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link to="/motorcycles/$id/control" search={{}} params={{ id: moto.id }}>
                {action.label}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}