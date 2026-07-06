import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlan } from "@/hooks/usePlan";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { User, Mail, Phone, IdCard, Calendar, Pencil, Crown, Shield } from "lucide-react";
import { maskCPF, maskPhone } from "@/lib/br-validators";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Perfil — TrailBook" }] }),
  component: ProfilePage,
});

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-semibold text-foreground">{value || "—"}</div>
      </div>
    </div>
  );
}

function ProfilePage() {
  const { plan } = usePlan();
  const { isAdmin } = useIsAdmin();
  const q = useQuery({
    queryKey: ["profile", "full"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, phone, cpf, birth_date, avatar_url")
        .eq("id", u.user.id)
        .maybeSingle();
      return data;
    },
  });
  const p = q.data;
  const initials = (p?.full_name || p?.email || "?")
    .split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "?";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {p?.avatar_url ? (
            <img src={p.avatar_url} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-primary/30" />
          ) : (
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary/15 text-lg font-bold text-primary ring-2 ring-primary/30">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-bold sm:text-2xl">{p?.full_name || "Meu perfil"}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${isAdmin ? "bg-emerald-500/15 text-emerald-400" : "bg-foreground/10 text-foreground/70"}`}>
                {isAdmin ? (<><Shield className="mr-1 inline h-3 w-3" /> Administrador</>) : "Usuário"}
              </span>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                <Crown className="mr-1 inline h-3 w-3" /> {plan.label}
              </span>
            </div>
          </div>
        </div>
        <Link to="/complete-profile"><Button variant="outline" size="sm"><Pencil className="h-4 w-4" /> Editar</Button></Link>
      </header>

      <section className="grid gap-3 md:grid-cols-2">
        <Row icon={User} label="Nome completo" value={p?.full_name ?? ""} />
        <Row icon={Mail} label="E-mail" value={p?.email ?? ""} />
        <Row icon={Phone} label="Telefone" value={p?.phone ? maskPhone(p.phone) : ""} />
        <Row icon={IdCard} label="CPF" value={p?.cpf ? maskCPF(p.cpf) : ""} />
        <Row icon={Calendar} label="Data de nascimento" value={p?.birth_date ?? ""} />
      </section>

      <section className="rounded-2xl border border-border bg-card/40 p-4">
        <div className="text-xs font-semibold text-muted-foreground">Atalhos</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <Link to="/settings"><Button variant="outline" className="w-full justify-start">Configurações</Button></Link>
          <Link to="/plans"><Button variant="outline" className="w-full justify-start">Ver Planos</Button></Link>
          <Link to="/help"><Button variant="outline" className="w-full justify-start">Central de Ajuda</Button></Link>
        </div>
      </section>
    </div>
  );
}