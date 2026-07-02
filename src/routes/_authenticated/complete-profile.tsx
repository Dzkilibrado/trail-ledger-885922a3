import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { isValidCPF, maskCPF, maskPhone, onlyDigits } from "@/lib/br-validators";

export const Route = createFileRoute("/_authenticated/complete-profile")({
  head: () => ({ meta: [{ title: "Completar cadastro — TrailBook" }] }),
  component: CompleteProfilePage,
});

function CompleteProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [full, setFull] = useState({ fullName: "", cpf: "", birthDate: "", phone: "" });

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { navigate({ to: "/auth" }); return; }
      const { data: p } = await supabase.from("profiles").select("full_name, cpf, birth_date, phone").eq("id", u.user.id).maybeSingle();
      if (p?.cpf) { navigate({ to: "/dashboard" as string }); return; }
      setFull({
        fullName: p?.full_name ?? (u.user.user_metadata?.full_name as string) ?? "",
        cpf: "", birthDate: p?.birth_date ?? "", phone: p?.phone ?? "",
      });
      setChecking(false);
    })();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!full.fullName.trim()) return toast.error("Informe seu nome completo");
    if (!isValidCPF(full.cpf)) return toast.error("CPF inválido");
    if (!full.birthDate) return toast.error("Informe a data de nascimento");
    if (onlyDigits(full.phone).length < 10) return toast.error("Celular inválido");
    setLoading(true);
    const { error } = await supabase.rpc("complete_signup_cpf", {
      _cpf: onlyDigits(full.cpf),
      _birth_date: full.birthDate,
      _phone: full.phone,
      _full_name: full.fullName.trim(),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cadastro concluído!");
    navigate({ to: "/dashboard" as string });
  }

  if (checking) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-2xl font-bold mb-1">Complete seu cadastro</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Para garantir a unicidade da sua conta no TrailBook, precisamos de alguns dados adicionais.
      </p>
      <form className="space-y-4 surface-elevated rounded-2xl p-6" onSubmit={submit}>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Nome completo</Label>
          <Input value={full.fullName} onChange={(e) => setFull({ ...full, fullName: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">CPF</Label>
            <Input inputMode="numeric" placeholder="000.000.000-00" maxLength={14}
              value={full.cpf} onChange={(e) => setFull({ ...full, cpf: maskCPF(e.target.value) })} required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Nascimento</Label>
            <Input type="date" value={full.birthDate} onChange={(e) => setFull({ ...full, birthDate: e.target.value })} required />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Celular</Label>
          <Input inputMode="tel" placeholder="(11) 99999-9999" maxLength={16}
            value={full.phone} onChange={(e) => setFull({ ...full, phone: maskPhone(e.target.value) })} required />
        </div>
        <Button disabled={loading} type="submit" className="w-full btn-glow">Concluir cadastro</Button>
      </form>
    </div>
  );
}