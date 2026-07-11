import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Settings, User, Crown, HelpCircle, Bell, Lock, BookOpen, Sparkles } from "lucide-react";
import { useOpenWelcomeTour } from "@/components/onboarding/WelcomeTour";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações — TrailBook" }] }),
  component: SettingsPage,
});

function Card({ icon: Icon, title, desc, to, cta, onClick }: { icon: any; title: string; desc: string; to?: string; cta: string; onClick?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/40 p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
        {to ? (
          <Link to={to} className="mt-3 inline-block"><Button size="sm" variant="outline">{cta}</Button></Link>
        ) : (
          <Button size="sm" variant="outline" className="mt-3" onClick={onClick}>{cta}</Button>
        )}
      </div>
    </div>
  );
}

function SettingsPage() {
  const openTour = useOpenWelcomeTour();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold sm:text-2xl">Configurações</h1>
          <p className="text-sm text-muted-foreground">Ajuste sua conta, plano e preferências de acesso.</p>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2">
        <Card icon={User} title="Dados do perfil" desc="Nome, CPF, telefone e data de nascimento." to="/complete-profile" cta="Editar perfil" />
        <Card icon={Crown} title="Plano" desc="Veja seu plano atual e faça upgrade quando quiser." to="/plans" cta="Ver planos" />
        <Card icon={Bell} title="Notificações" desc="As notificações e mensagens do sistema ficam disponíveis na Central." to="/messages" cta="Abrir mensagens" />
        <Card icon={Lock} title="Segurança da conta" desc="Redefina sua senha por e-mail seguro." to="/help" cta="Central de ajuda" />
        <Card icon={BookOpen} title="Como o TrailBook funciona" desc="Veja o passo a passo do sistema." to="/como-funciona" cta="Ver passo a passo" />
        <Card icon={HelpCircle} title="Perguntas frequentes" desc="Dúvidas comuns sobre cadastro, moto, Recibo, Passaporte e Selos." to="/faq" cta="Abrir FAQ" />
        <Card icon={Sparkles} title="Ver tour de boas-vindas" desc="Reveja a apresentação inicial do TrailBook a qualquer momento." cta="Rever tour" onClick={openTour} />
        <Card icon={HelpCircle} title="Ajuda e suporte" desc="Abra um chamado ou fale com o time TrailBook." to="/help" cta="Preciso de ajuda" />
      </section>
    </div>
  );
}