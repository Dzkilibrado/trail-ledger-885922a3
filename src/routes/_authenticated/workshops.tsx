import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Building2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

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
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Oficinas</h1>
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
              <Button type="submit" className="w-full btn-glow">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? <div className="text-muted-foreground">Carregando…</div> : data && data.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((w) => (
            <div key={w.id} className="surface-elevated flex items-start gap-3 rounded-2xl p-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary"><Building2 className="h-5 w-5" /></div>
              <div>
                <div className="font-semibold">{w.name}</div>
                <div className="text-xs text-muted-foreground">{[w.city, w.state].filter(Boolean).join(" · ") || w.phone || w.cnpj}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="surface-elevated rounded-2xl p-10 text-center text-sm text-muted-foreground">Nenhuma oficina cadastrada.</div>
      )}
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