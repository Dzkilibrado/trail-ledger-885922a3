import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Building2, ShieldCheck, Phone, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { brl } from "@/lib/trailbook";

export const Route = createFileRoute("/_authenticated/workshops")({
  head: () => ({ meta: [{ title: "Oficinas — TrailBook" }] }),
  component: Workshops,
});

function Workshops() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["workshops"],
    queryFn: async () => (await supabase.from("workshops").select("*").order("name")).data ?? [],
  });

  const events = useQuery({
    queryKey: ["events", "with-workshop"],
    queryFn: async () => (await supabase.from("events").select("id, workshop_id, motorcycle_id, cost, occurred_at").not("workshop_id", "is", null)).data ?? [],
  });

  // KPIs por oficina
  const stats = (data ?? []).map((w) => {
    const evs = (events.data ?? []).filter((e) => e.workshop_id === w.id);
    const motoIds = new Set(evs.map((e) => e.motorcycle_id));
    const last = evs.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())[0];
    return {
      workshop: w,
      services: evs.length,
      bikes: motoIds.size,
      revenue: evs.reduce((s, e) => s + (Number(e.cost) || 0), 0),
      lastService: last?.occurred_at as string | undefined,
    };
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("workshops").insert({
      name: String(fd.get("name")),
      cnpj: String(fd.get("cnpj") || "") || null,
      city: String(fd.get("city") || "") || null,
      state: String(fd.get("state") || "") || null,
      phone: String(fd.get("phone") || "") || null,
      owner_user_id: u.user!.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Oficina cadastrada");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["workshops"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Oficinas parceiras"
        description="Cadastre oficinas para vincular aos eventos de manutenção e enriquecer o histórico da motocicleta."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="btn-glow"><Plus className="h-4 w-4" /> Nova oficina</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar oficina</DialogTitle></DialogHeader>
            <form onSubmit={onSubmit} className="space-y-3">
              <Field label="Nome"><Input name="name" required /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="CNPJ"><Input name="cnpj" /></Field>
                <Field label="Telefone"><Input name="phone" /></Field>
                <Field label="Cidade"><Input name="city" /></Field>
                <Field label="UF"><Input name="state" maxLength={2} /></Field>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1 btn-glow">Salvar oficina</Button>
              </div>
            </form>
          </DialogContent>
          </Dialog>
        }
      />
      {isLoading ? <div className="text-muted-foreground">Carregando…</div> : data && data.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {stats.map(({ workshop: w, services, bikes, revenue, lastService }) => (
            <div key={w.id} className="surface-elevated rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold">{w.name}</div>
                    {w.verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                        <ShieldCheck className="h-3 w-3" /> {w.verified_label || "TrailBook Verified"}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {(w.city || w.state) && (
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {[w.city, w.state].filter(Boolean).join(" · ")}</span>
                    )}
                    {w.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {w.phone}</span>}
                    {w.cnpj && <span>CNPJ {w.cnpj}</span>}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Stat label="Serviços" value={String(services)} />
                <Stat label="Motos" value={String(bikes)} />
                <Stat label="Movimento" value={revenue > 0 ? brl(revenue) : "—"} />
              </div>
              {lastService && (
                <div className="mt-3 text-[11px] text-muted-foreground">
                  Último serviço: {new Date(lastService).toLocaleDateString("pt-BR")}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="surface-elevated rounded-2xl p-10 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 font-display text-lg font-bold">Nenhuma oficina cadastrada</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre as oficinas que prestam serviço nas suas motos. Eventos vinculados a uma oficina parceira ganham peso extra no índice de conservação.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-sm font-bold">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}