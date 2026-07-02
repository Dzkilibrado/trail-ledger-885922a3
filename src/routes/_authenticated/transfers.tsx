import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft, Check, X, Inbox, Send, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/trailbook";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/transfers")({
  head: () => ({ meta: [{ title: "Transferências — TrailBook" }] }),
  component: TransfersPage,
});

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};
const STATUS_LABEL: Record<string, string> = { pending: "Pendente", approved: "Aprovada", rejected: "Recusada", cancelled: "Cancelada" };

function TransfersPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: async () => (await supabase.auth.getUser()).data.user });

  const transfers = useQuery({
    queryKey: ["transfers"],
    queryFn: async () => {
      const { data, error } = await supabase
        // Use the masked view so recipients don't receive the sender-typed `to_email`.
        .from("my_ownership_transfers" as never)
        .select("*, motorcycles(id, brand, model, nickname, trailbook_id)")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const uid = me.data?.id;
  const incoming = (transfers.data ?? []).filter((t: any) => t.to_user_id === uid);
  const outgoing = (transfers.data ?? []).filter((t: any) => t.from_user_id === uid);

  async function respond(id: string, approve: boolean) {
    const { error } = await supabase.rpc("respond_ownership_transfer", { _transfer_id: id, _approve: approve } as never);
    if (error) return toast.error(error.message);
    toast.success(approve ? "Transferência aprovada" : "Transferência recusada");
    qc.invalidateQueries({ queryKey: ["transfers"] });
    qc.invalidateQueries({ queryKey: ["motorcycles"] });
  }
  async function cancel(id: string) {
    const { error } = await supabase.rpc("cancel_ownership_transfer", { _transfer_id: id } as never);
    if (error) return toast.error(error.message);
    toast.success("Solicitação cancelada");
    qc.invalidateQueries({ queryKey: ["transfers"] });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Transferências de propriedade"
        description="O TrailBook ID e o histórico permanecem vinculados à motocicleta — não ao proprietário."
      />

      {/* How-to */}
      <div className="grid gap-4 md:grid-cols-2">
        <HowTo
          icon={Send}
          title="Para quem está vendendo"
          steps={[
            "Abra a moto e clique em Transferir",
            "Informe o e-mail do comprador",
            "Acompanhe nesta tela o status",
            "Cancele se necessário, enquanto pendente",
          ]}
        />
        <HowTo
          icon={Inbox}
          title="Para quem está comprando"
          steps={[
            "Receba a solicitação aqui em Recebidas",
            "Revise dados, histórico e índice de conservação",
            "Aceite ou recuse a transferência",
            "Aceita: a moto entra na sua garagem com todo o histórico",
          ]}
        />
      </div>

      <Section icon={Inbox} title="Recebidas" desc="Motos sendo transferidas para você">
        {incoming.length === 0 ? <Empty>Nenhuma solicitação recebida.</Empty> :
          incoming.map((t: any) => (
            <Card key={t.id} t={t}>
              {t.status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => respond(t.id, true)}><Check className="h-4 w-4" /> Aprovar</Button>
                  <Button size="sm" variant="outline" onClick={() => respond(t.id, false)}><X className="h-4 w-4" /> Recusar</Button>
                </div>
              )}
            </Card>
          ))}
      </Section>

      <Section icon={Send} title="Enviadas" desc="Solicitações que você criou">
        {outgoing.length === 0 ? <Empty>Nenhuma solicitação enviada.</Empty> :
          outgoing.map((t: any) => (
            <Card key={t.id} t={t}>
              {t.status === "pending" && (
                <Button size="sm" variant="outline" onClick={() => cancel(t.id)}><X className="h-4 w-4" /> Cancelar</Button>
              )}
              {t.status === "pending" && !t.to_user_id && (
                <span className="text-xs text-amber-400 flex items-center gap-1"><Mail className="h-3 w-3" /> Aguardando {t.to_email} criar conta no TrailBook</span>
              )}
            </Card>
          ))}
      </Section>

      <div className="surface-elevated rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        <ShieldCheck className="mb-1 inline h-3.5 w-3.5 text-primary" /> A transferência só é efetivada quando o destinatário aprova.
        O histórico de proprietários é registrado em auditoria imutável.
      </div>
    </div>
  );
}

function HowTo({ icon: Icon, title, steps }: { icon: any; title: string; steps: string[] }) {
  return (
    <div className="surface-elevated rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary"><Icon className="h-4 w-4" /></div>
        <h2 className="font-display font-bold">{title}</h2>
      </div>
      <ol className="mt-3 space-y-1.5 text-sm">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2 text-muted-foreground">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Section({ icon: Icon, title, desc, children }: { icon: any; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><h2 className="font-display text-lg font-bold">{title}</h2></div>
      <p className="text-xs text-muted-foreground">{desc}</p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Card({ t, children }: { t: any; children: React.ReactNode }) {
  const moto = t.motorcycles;
  return (
    <div className="surface-elevated flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{moto?.nickname || moto?.model || "Moto"}</span>
          {moto?.trailbook_id && <code className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px]">{moto.trailbook_id}</code>}
          <Badge variant="outline" className={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">Para {t.to_email} · {formatDate(t.requested_at)}{t.message ? ` · "${t.message}"` : ""}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="surface-elevated rounded-2xl p-6 text-center text-sm text-muted-foreground">{children}</div>;
}