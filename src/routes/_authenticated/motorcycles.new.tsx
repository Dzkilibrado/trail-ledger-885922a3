import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRANDS, uploadFile } from "@/lib/trailbook";
import { toast } from "sonner";
import { usePlan } from "@/hooks/usePlan";
import { canCreateMotorcycle } from "@/lib/plans";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/motorcycles/new")({
  head: () => ({ meta: [{ title: "Nova moto — TrailBook" }] }),
  component: NewMotorcycle,
});

const schema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1).max(80),
  nickname: z.string().max(60).optional(),
  year_make: z.coerce.number().int().min(1950).max(2100).optional(),
  year_model: z.coerce.number().int().min(1950).max(2100).optional(),
  displacement: z.coerce.number().int().min(50).max(2000).optional(),
  control_type: z.enum(["hours", "km", "both"]),
  chassis: z.string().max(60).optional(),
  engine_number: z.string().max(60).optional(),
  plate: z.string().max(10).optional(),
  renavam: z.string().max(20).optional(),
  hours_total: z.coerce.number().min(0).default(0),
  km_total: z.coerce.number().min(0).default(0),
});

function NewMotorcycle() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const { plan } = usePlan();
  const motoCount = useQuery({
    queryKey: ["motorcycles", "count"],
    queryFn: async () => {
      const { count } = await supabase.from("motorcycles").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });
  const blocked = !canCreateMotorcycle(plan, motoCount.data ?? 0);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (blocked) { toast.error("Limite do plano atingido. Faça upgrade para cadastrar mais motos."); return; }
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;
      let main_photo_url: string | null = null;
      if (photo) {
        const up = await uploadFile("motorcycle-photos", photo, uid);
        main_photo_url = up.path;
      }
      const { data, error } = await supabase.from("motorcycles").insert({
        ...parsed.data,
        owner_id: uid,
        main_photo_url,
      }).select("id").single();
      if (error) throw error;
      toast.success("Moto cadastrada!");
      navigate({ to: "/motorcycles/$id", params: { id: data.id } });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao cadastrar");
    } finally { setLoading(false); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-2xl font-bold">Nova moto</h1>
      {blocked && (
        <div className="surface-elevated flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-sm">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            <span>Plano <strong>{plan.label}</strong> permite até {plan.limits.motorcycles} moto(s). Faça upgrade para continuar.</span>
          </div>
          <Link to="/plans"><Button size="sm" className="btn-glow">Ver planos</Button></Link>
        </div>
      )}
      <form onSubmit={onSubmit} className="surface-elevated space-y-5 rounded-2xl p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Marca" required>
            <Select name="brand" required>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{BRANDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Modelo" required><Input name="model" required placeholder="ex: CRF 250F" /></Field>
          <Field label="Apelido"><Input name="nickname" placeholder="ex: A vermelhinha" /></Field>
          <Field label="Cilindrada (cc)"><Input name="displacement" type="number" placeholder="250" /></Field>
          <Field label="Ano fabricação"><Input name="year_make" type="number" placeholder="2024" /></Field>
          <Field label="Ano modelo"><Input name="year_model" type="number" placeholder="2024" /></Field>
          <Field label="Tipo de controle">
            <Select name="control_type" defaultValue="hours">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="km">Quilometragem</SelectItem>
                <SelectItem value="both">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Chassi"><Input name="chassis" /></Field>
          <Field label="Nº motor"><Input name="engine_number" /></Field>
          <Field label="Placa"><Input name="plate" /></Field>
          <Field label="RENAVAM"><Input name="renavam" /></Field>
          <Field label="Horas atuais"><Input name="hours_total" type="number" step="0.1" defaultValue={0} /></Field>
          <Field label="Km atuais"><Input name="km_total" type="number" step="1" defaultValue={0} /></Field>
        </div>
        <Field label="Foto principal">
          <Input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </Field>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" className="btn-glow" disabled={loading || blocked}>{loading ? "Salvando…" : "Cadastrar moto"}</Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/motorcycles" })}>Cancelar</Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}{required && <span className="text-primary"> *</span>}
      </Label>
      {children}
    </div>
  );
}