import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Settings, User, Crown, HelpCircle, Lock, BookOpen, Sparkles, LifeBuoy } from "lucide-react";
import { useOpenWelcomeTour } from "@/components/onboarding/WelcomeTour";
import { APP_VERSION, BUILD_ID, BUILD_AT, shortBuildId } from "@/lib/version/build-info";
import { toast } from "sonner";

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
        <Card icon={Lock} title="Segurança da conta" desc="Altere sua senha de acesso ao TrailBook." to="/reset-password" cta="Alterar senha" />
        <Card icon={BookOpen} title="Como o TrailBook funciona" desc="Veja o passo a passo do sistema." to="/como-funciona" cta="Ver passo a passo" />
        <Card icon={HelpCircle} title="Perguntas frequentes" desc="Dúvidas comuns sobre cadastro, moto, Recibo, Passaporte e Selos." to="/faq" cta="Abrir FAQ" />
        <Card icon={Sparkles} title="Ver tour de boas-vindas" desc="Reveja a apresentação inicial do TrailBook a qualquer momento." cta="Rever tour" onClick={openTour} />
        <Card icon={LifeBuoy} title="Ajuda e suporte" desc="Fale com o time TrailBook pela Central de Chamados." to="/tickets" cta="Abrir chamado" />
      </section>
      <VersionFooter />
    </div>
  );
}

function VersionFooter() {
  const publishedAt = (() => {
    try {
      return new Date(BUILD_AT).toLocaleString("pt-BR");
    } catch {
      return BUILD_AT;
    }
  })();
  const copy = () => {
    const txt = `TrailBook ${APP_VERSION} · build ${BUILD_ID} · publicado em ${publishedAt}`;
    try {
      navigator.clipboard?.writeText(txt);
      toast.success("Informações copiadas.");
    } catch {
      /* noop */
    }
  };
  return (
    <footer className="mt-4 rounded-2xl border border-border bg-card/40 p-4 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-foreground">TrailBook</div>
          <div>
            Versão {APP_VERSION} · Build <span className="font-mono">{shortBuildId(BUILD_ID)}</span>
          </div>
          <div className="text-xs">Publicado em {publishedAt}</div>
        </div>
        <Button size="sm" variant="ghost" onClick={copy}>Copiar informações</Button>
      </div>
    </footer>
  );
}