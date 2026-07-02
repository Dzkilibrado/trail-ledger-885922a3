import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bike,
  Shield,
  QrCode,
  Wrench,
  Activity,
  FileCheck2,
  Bell,
  FileText,
  Camera,
  TrendingUp,
  ArrowLeftRight,
  Users,
  DollarSign,
  Store,
  ChevronRight,
  Check,
  Lock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import heroImage from "@/assets/landing-hero.jpg";
import phoneImage from "@/assets/landing-phone.jpg";
import certificateImage from "@/assets/landing-certificate.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TrailBook — Gestão inteligente da sua moto off-road" },
      {
        name: "description",
        content:
          "O histórico da sua moto. A confiança da sua próxima negociação. Organize manutenções, documentos, inspeções e compartilhe um histórico confiável com TrailBook Certified.",
      },
      { property: "og:title", content: "TrailBook — Gestão inteligente da sua moto off-road" },
      {
        property: "og:description",
        content:
          "A plataforma inteligente para gestão do ciclo de vida da sua motocicleta off-road.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <Hero />
      <HowItWorks />
      <Lifecycle />
      <Benefits />
      <Features />
      <Audience />
      <ValueDrivers />
      <DocumentsVault />
      <SmartAgenda />
      <ConservationScore />
      <CertifiedSection />
      <SecuritySection />
      <Plans />
      <FAQ />
      <FinalCTA />
      <SiteFooter />
    </div>
  );
}

/* ============================================================ */
/*  HEADER                                                       */
/* ============================================================ */

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground btn-glow">
            <Bike className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight sm:text-xl">
            TrailBook
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link to="/auth" className="hidden sm:inline-flex">
            <Button variant="ghost" size="sm">Entrar</Button>
          </Link>
          <Link to="/auth">
            <Button size="sm" className="btn-glow">Criar conta</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}

/* ============================================================ */
/*  HERO                                                         */
/* ============================================================ */

function Hero() {
  return (
    <section className="surface-hero relative overflow-hidden">
      <div className="container mx-auto grid gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-24">
        <div className="flex flex-col justify-center gap-5 sm:gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Plataforma oficial off-road
          </span>
          <h1 className="font-display text-[2rem] font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Gestão inteligente do{" "}
            <span className="text-gradient-primary">ciclo de vida</span> da sua
            motocicleta off-road.
          </h1>
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
            Organize todo o histórico da sua moto em um único lugar. Controle
            horas, manutenções, documentos, inspeções e custos — e compartilhe
            um histórico confiável com o{" "}
            <span className="font-semibold text-foreground">TrailBook Certified</span>.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link to="/auth">
              <Button size="lg" className="btn-glow w-full sm:w-auto">
                Começar gratuitamente
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <a href="#funcionalidades" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Conhecer funcionalidades
              </Button>
            </a>
          </div>
          <p className="text-sm italic text-muted-foreground">
            “O histórico da sua moto. A confiança da sua próxima negociação.”
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground sm:text-sm">
            <span className="inline-flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Histórico assinado
            </span>
            <span className="inline-flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" /> Certificado com QR Code
            </span>
            <span className="inline-flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Índice de Conservação
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="surface-elevated overflow-hidden rounded-3xl">
            <img
              src={heroImage}
              alt="Motocicleta off-road ao lado de smartphone exibindo o TrailBook"
              width={1536}
              height={1152}
              className="h-auto w-full object-cover"
            />
          </div>
          <div className="absolute -bottom-4 -left-4 hidden rounded-2xl border border-border bg-card/90 p-3 shadow-elevated backdrop-blur-xl sm:block">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Índice de conservação
                </div>
                <div className="font-display text-xl font-bold">94/100</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  SECTION SHELL                                                */
/* ============================================================ */

function SectionHeader({
  eyebrow,
  title,
  desc,
  center = true,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  desc?: string;
  center?: boolean;
}) {
  return (
    <div className={`mb-10 max-w-2xl sm:mb-14 ${center ? "mx-auto text-center" : ""}`}>
      {eyebrow && (
        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary sm:text-xs">
          {eyebrow}
        </span>
      )}
      <h2 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-4xl">
        {title}
      </h2>
      {desc && (
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">{desc}</p>
      )}
    </div>
  );
}

/* ============================================================ */
/*  HOW IT WORKS                                                 */
/* ============================================================ */

const STEPS = [
  { n: "1", title: "Cadastre sua motocicleta", desc: "Modelo, ano, chassi, foto — tudo em minutos." },
  { n: "2", title: "Escolha um plano de manutenção", desc: "Presets inteligentes ou personalize o seu." },
  { n: "3", title: "Registre manutenções e documentos", desc: "Notas, garantias, inspeções e evidências." },
  { n: "4", title: "Receba alertas automáticos", desc: "Antes que a manutenção vire um problema." },
  { n: "5", title: "Compartilhe com o TrailBook Certified", desc: "Histórico confiável via QR Code público." },
];

function HowItWorks() {
  return (
    <section className="container mx-auto px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeader
        eyebrow="Como funciona"
        title={<>Cinco passos, uma <span className="text-gradient-primary">plataforma completa</span>.</>}
        desc="Do primeiro cadastro à venda com histórico confiável — o TrailBook acompanha cada etapa."
      />
      <ol className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((s) => (
          <li key={s.n} className="surface-elevated relative flex flex-col gap-3 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground font-display text-lg font-bold btn-glow">
                {s.n}
              </span>
              <h3 className="font-display text-base font-bold leading-tight sm:text-lg">
                {s.title}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">{s.desc}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ============================================================ */
/*  LIFECYCLE                                                    */
/* ============================================================ */

const LIFECYCLE = [
  { icon: Bike, label: "Cadastro" },
  { icon: Wrench, label: "Plano de manutenção" },
  { icon: FileText, label: "Documentação" },
  { icon: Camera, label: "Evidências" },
  { icon: TrendingUp, label: "Índice de conservação" },
  { icon: FileCheck2, label: "Certificado digital" },
  { icon: ArrowLeftRight, label: "Transferência" },
  { icon: Sparkles, label: "Nova história" },
];

function Lifecycle() {
  return (
    <section className="border-y border-border/60 bg-elevated/40">
      <div className="container mx-auto px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeader
          eyebrow="Muito mais do que um aplicativo"
          title={<>O TrailBook acompanha <span className="text-gradient-primary">toda a vida útil</span> da sua moto.</>}
          desc="Do primeiro giro à transferência para o próximo proprietário — todos os capítulos, no mesmo lugar."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-8">
          {LIFECYCLE.map((item, i) => (
            <div
              key={item.label}
              className="surface-elevated flex flex-col items-center gap-3 rounded-2xl p-4 text-center"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <div className="text-xs font-semibold leading-tight sm:text-sm">
                {item.label}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Etapa {i + 1}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  BENEFITS                                                     */
/* ============================================================ */

const BENEFITS = [
  { icon: Bell, title: "Nunca esqueça uma manutenção", desc: "Alertas automáticos por horas, km e tempo — o que vencer primeiro." },
  { icon: FileText, title: "Documentos organizados", desc: "Nota fiscal, garantia, manual e contratos sempre à mão." },
  { icon: TrendingUp, title: "Aumente o valor de revenda", desc: "Prove o cuidado com um histórico confiável e verificável." },
  { icon: QrCode, title: "Confiança em um QR Code", desc: "Compartilhe o histórico autorizado direto com o comprador." },
  { icon: Camera, title: "Registre a história com evidências", desc: "Fotos, laudos e vídeos anexados a cada evento." },
  { icon: Shield, title: "Preserve a história da sua moto", desc: "Um passaporte digital que atravessa proprietários." },
];

function Benefits() {
  return (
    <section className="container mx-auto px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeader
        eyebrow="Por que TrailBook"
        title={<>Menos preocupação. <span className="text-gradient-primary">Mais trilha.</span></>}
        desc="Benefícios reais que você sente do primeiro cadastro à venda da moto."
      />
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {BENEFITS.map((b) => (
          <div key={b.title} className="surface-elevated rounded-2xl p-5 sm:p-6">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
              <b.icon className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-bold leading-tight">{b.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{b.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================ */
/*  FEATURES                                                     */
/* ============================================================ */

const FEATURES = [
  { icon: Bike, title: "Cadastro inteligente" },
  { icon: Wrench, title: "Agenda inteligente" },
  { icon: FileText, title: "Minha documentação" },
  { icon: Camera, title: "Evidências" },
  { icon: TrendingUp, title: "Índice de conservação" },
  { icon: FileCheck2, title: "Certificado digital" },
  { icon: QrCode, title: "QR Code público" },
  { icon: DollarSign, title: "Gestão financeira" },
  { icon: Store, title: "Oficinas parceiras" },
  { icon: Users, title: "Histórico de proprietários" },
  { icon: ArrowLeftRight, title: "Transferência de propriedade" },
  { icon: Lock, title: "Segurança em camadas" },
];

function Features() {
  return (
    <section id="funcionalidades" className="border-y border-border/60 bg-elevated/40">
      <div className="container mx-auto px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeader
          eyebrow="Funcionalidades"
          title={<>Tudo o que sua moto <span className="text-gradient-primary">precisa em um só lugar</span>.</>}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="surface-elevated group flex items-center gap-3 rounded-xl p-4 transition-colors hover:border-primary/40"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-sm font-semibold leading-tight">
                {f.title}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  AUDIENCE                                                     */
/* ============================================================ */

const AUDIENCE = [
  { icon: Bike, title: "Proprietários", desc: "Organize toda a vida da sua motocicleta em um único lugar." },
  { icon: Users, title: "Compradores", desc: "Consulte um histórico confiável antes de fechar negócio." },
  { icon: Store, title: "Oficinas", desc: "Registre serviços e fortaleça a credibilidade da sua marca." },
  { icon: Sparkles, title: "Colecionadores", desc: "Preserve a história completa da moto por muitos anos." },
];

function Audience() {
  return (
    <section className="container mx-auto px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeader
        eyebrow="Para quem é o TrailBook"
        title={<>Feito para quem <span className="text-gradient-primary">vive off-road</span>.</>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {AUDIENCE.map((a) => (
          <div key={a.title} className="surface-elevated rounded-2xl p-5 sm:p-6">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
              <a.icon className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-bold">{a.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{a.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================ */
/*  VALUE DRIVERS                                                */
/* ============================================================ */

const VALUES = [
  "Histórico documentado",
  "Revisões registradas",
  "Documentação organizada",
  "Certificado Digital",
  "Índice de Conservação",
  "Histórico de proprietários",
];

function ValueDrivers() {
  return (
    <section className="border-y border-border/60 bg-elevated/40">
      <div className="container mx-auto px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeader
          eyebrow="Valorização"
          title={<>O que faz uma moto <span className="text-gradient-primary">valer mais</span>?</>}
          desc="O TrailBook reúne todos os fatores que aumentam o valor percebido da sua motocicleta."
        />
        <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2">
          {VALUES.map((v) => (
            <div
              key={v}
              className="surface-elevated flex items-center gap-3 rounded-xl px-4 py-3"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Check className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold">{v}</span>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground sm:text-base">
          O TrailBook reúne tudo isso em <span className="text-foreground font-semibold">um único lugar</span>.
        </p>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  DOCUMENTS VAULT                                              */
/* ============================================================ */

function DocumentsVault() {
  const items = ["Nota Fiscal", "Garantia", "Manual", "Contratos", "Versionamento", "Auditoria", "Segurança"];
  return (
    <section className="container mx-auto grid gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-16">
      <div>
        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary sm:text-xs">
          Minha documentação
        </span>
        <h2 className="font-display text-2xl font-bold leading-tight sm:text-4xl">
          O <span className="text-gradient-primary">cofre digital</span> da sua motocicleta.
        </h2>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Todos os documentos importantes da sua moto centralizados, versionados
          e protegidos. Acesse quando quiser, compartilhe com quem precisar.
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-2 text-sm">
          {items.map((it) => (
            <li key={it} className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-primary" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="surface-elevated overflow-hidden rounded-3xl">
        <img
          src={phoneImage}
          alt="Aplicativo TrailBook em um smartphone"
          loading="lazy"
          width={1024}
          height={1280}
          className="h-auto w-full object-cover"
        />
      </div>
    </section>
  );
}

/* ============================================================ */
/*  SMART AGENDA                                                 */
/* ============================================================ */

function SmartAgenda() {
  const rows = [
    { label: "Horas de uso", value: "Auto" },
    { label: "Quilometragem", value: "Auto" },
    { label: "Inspeções", value: "Programadas" },
    { label: "Revisões", value: "Preditivas" },
    { label: "Desgaste de itens", value: "Estimado" },
    { label: "Próximas manutenções", value: "Alertas" },
  ];
  return (
    <section className="border-y border-border/60 bg-elevated/40">
      <div className="container mx-auto grid gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div className="order-2 lg:order-1">
          <div className="surface-elevated rounded-3xl p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="font-display text-lg font-bold">Agenda inteligente</div>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                Automático
              </span>
            </div>
            <ul className="divide-y divide-border/60">
              {rows.map((r) => (
                <li key={r.label} className="flex items-center justify-between py-3">
                  <span className="text-sm text-muted-foreground">{r.label}</span>
                  <span className="text-sm font-semibold">{r.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary sm:text-xs">
            Agenda inteligente
          </span>
          <h2 className="font-display text-2xl font-bold leading-tight sm:text-4xl">
            Antes que vire <span className="text-gradient-primary">problema</span>, vira alerta.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            O TrailBook acompanha horas, quilometragem, inspeções, revisões e
            desgaste — e gera alertas automáticos antes de cada manutenção
            crítica. Você anda tranquilo, a moto agradece.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  CONSERVATION SCORE                                           */
/* ============================================================ */

function ConservationScore() {
  return (
    <section className="container mx-auto px-4 py-16 sm:px-6 sm:py-24">
      <div className="surface-elevated relative overflow-hidden rounded-3xl p-6 sm:p-10">
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-2xl">
            <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary sm:text-xs">
              Índice de conservação
            </span>
            <h2 className="font-display text-2xl font-bold leading-tight sm:text-4xl">
              Quanto <span className="text-gradient-primary">melhor o histórico</span>, maior o valor da sua moto.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              O Índice de Conservação é calculado automaticamente com base em
              manutenções, documentos, evidências e cuidados registrados.
              Demonstre o zelo com a sua motocicleta em um número claro e
              verificável.
            </p>
          </div>
          <div className="mx-auto grid h-40 w-40 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 shadow-glow sm:h-48 sm:w-48">
            <div className="text-center">
              <div className="font-display text-5xl font-bold text-primary sm:text-6xl">94</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                de 100
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  CERTIFIED                                                    */
/* ============================================================ */

function CertifiedSection() {
  return (
    <section className="border-y border-border/60 bg-elevated/40">
      <div className="container mx-auto grid gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary sm:text-xs">
            TrailBook Certified
          </span>
          <h2 className="font-display text-2xl font-bold leading-tight sm:text-4xl">
            Um <span className="text-gradient-primary">certificado digital</span> que fecha negócio.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Gere um QR Code exclusivo com o histórico verificado da sua moto.
            Compartilhe com compradores, oficinas e seguradoras — com
            privacidade totalmente configurável por você.
          </p>
          <ul className="mt-6 space-y-2 text-sm">
            {[
              "QR Code exclusivo e verificável",
              "Consulta pública com link direto",
              "Privacidade configurável por seção",
              "Histórico assinado e imutável",
            ].map((it) => (
              <li key={it} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Link to="/auth">
              <Button size="lg" className="btn-glow w-full sm:w-auto">
                Criar meu certificado
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
        <div className="surface-elevated overflow-hidden rounded-3xl">
          <img
            src={certificateImage}
            alt="Exemplo do certificado digital TrailBook Certified"
            loading="lazy"
            width={1280}
            height={1024}
            className="h-auto w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  SECURITY                                                     */
/* ============================================================ */

const SECURITY = [
  { icon: Lock, title: "Storage privado", desc: "Documentos protegidos com URLs assinadas." },
  { icon: Users, title: "CPF único", desc: "Uma identidade, um proprietário, um passaporte." },
  { icon: FileCheck2, title: "Auditoria imutável", desc: "Cada alteração registrada e verificável." },
  { icon: Shield, title: "Controle de acesso", desc: "Você decide o que é público e o que é privado." },
  { icon: Activity, title: "Histórico imutável", desc: "Eventos preservados ao longo do tempo." },
  { icon: QrCode, title: "Proteção de dados", desc: "Conformidade com boas práticas de LGPD." },
];

function SecuritySection() {
  return (
    <section className="container mx-auto px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeader
        eyebrow="Segurança"
        title={<>Feito para <span className="text-gradient-primary">durar décadas</span>.</>}
        desc="Segurança em camadas — do banco de dados à exibição no seu celular."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECURITY.map((s) => (
          <div key={s.title} className="surface-elevated rounded-2xl p-5">
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
              <s.icon className="h-5 w-5" />
            </div>
            <h3 className="font-display text-base font-bold">{s.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================ */
/*  PLANS                                                        */
/* ============================================================ */

const PLANS_CARDS = [
  {
    name: "Free",
    price: "Grátis",
    tagline: "Para começar o histórico da sua moto",
    features: ["1 moto cadastrada", "Linha do tempo completa", "Agenda inteligente", "1 certificado ativo"],
    highlight: false,
  },
  {
    name: "Premium",
    price: "Em breve",
    tagline: "Para quem cuida de várias motos",
    features: ["Motos ilimitadas", "Certificados ilimitados", "Exportação em PDF", "Prioridade no suporte"],
    highlight: true,
  },
  {
    name: "Oficina",
    price: "Em breve",
    tagline: "Para oficinas certificadas",
    features: ["Tudo do Premium", "Selo TrailBook Verified", "Branding nos certificados", "Painel multi-cliente"],
    highlight: false,
  },
];

function Plans() {
  return (
    <section className="border-y border-border/60 bg-elevated/40">
      <div className="container mx-auto px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeader
          eyebrow="Planos"
          title={<>Comece grátis. <span className="text-gradient-primary">Evolua quando quiser.</span></>}
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {PLANS_CARDS.map((p) => (
            <div
              key={p.name}
              className={`surface-elevated relative flex flex-col gap-5 rounded-2xl p-6 ${p.highlight ? "ring-2 ring-primary" : ""}`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                  Mais popular
                </span>
              )}
              <div>
                <div className="font-display text-2xl font-bold">{p.name}</div>
                <p className="text-sm text-muted-foreground">{p.tagline}</p>
              </div>
              <div className="font-display text-3xl font-bold text-primary">{p.price}</div>
              <ul className="flex-1 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="mt-auto">
                <Button
                  className="w-full"
                  variant={p.highlight ? "default" : "outline"}
                >
                  Começar
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  FAQ                                                          */
/* ============================================================ */

const FAQS = [
  {
    q: "Minha moto precisa ter documento?",
    a: "Não. Você pode cadastrar motos de trilha, competição, coleção ou uso recreativo — com ou sem documento.",
  },
  {
    q: "Posso cadastrar motos de competição?",
    a: "Sim. O TrailBook foi feito para motos off-road, incluindo motocross, enduro e trilha esportiva.",
  },
  {
    q: "O certificado é público?",
    a: "Você decide. O TrailBook Certified permite configurar quais seções ficam visíveis para consulta pública.",
  },
  {
    q: "Posso ocultar informações sensíveis?",
    a: "Sim. A privacidade é configurável por seção — histórico, documentos, custos, evidências e mais.",
  },
  {
    q: "Posso cadastrar mais de uma moto?",
    a: "No plano Free você cadastra 1 moto. Nos planos Premium e Oficina, o cadastro é ilimitado.",
  },
];

function FAQ() {
  return (
    <section className="container mx-auto px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeader
        eyebrow="Perguntas frequentes"
        title={<>Ainda com <span className="text-gradient-primary">dúvidas</span>?</>}
      />
      <div className="mx-auto max-w-3xl">
        <Accordion type="single" collapsible className="surface-elevated rounded-2xl px-5">
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-border/60 last:border-b-0">
              <AccordionTrigger className="text-left font-semibold">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  FINAL CTA                                                    */
/* ============================================================ */

function FinalCTA() {
  return (
    <section className="container mx-auto px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="surface-elevated relative overflow-hidden rounded-3xl p-8 text-center sm:p-14">
        <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(600px_300px_at_50%_-20%,oklch(0.72_0.19_50/0.35),transparent_60%)]" />
        <div className="relative">
          <h2 className="font-display text-2xl font-bold leading-tight sm:text-4xl">
            O histórico da sua moto.{" "}
            <span className="text-gradient-primary">A confiança da sua próxima negociação.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Crie sua conta gratuitamente e comece a construir o passaporte
            digital da sua motocicleta em minutos.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/auth" className="w-full sm:w-auto">
              <Button size="lg" className="btn-glow w-full sm:w-auto">
                Começar gratuitamente
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <a href="#funcionalidades" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Ver funcionalidades
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  FOOTER                                                       */
/* ============================================================ */

function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="container mx-auto grid gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Bike className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-bold">TrailBook</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            A plataforma inteligente para gestão do ciclo de vida da sua
            motocicleta off-road.
          </p>
        </div>
        <div>
          <div className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Plataforma
          </div>
          <ul className="space-y-2 text-sm">
            <li><a href="#funcionalidades" className="hover:text-primary">Funcionalidades</a></li>
            <li><Link to="/auth" className="hover:text-primary">Criar conta</Link></li>
            <li><Link to="/auth" className="hover:text-primary">Entrar</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Legal
          </div>
          <ul className="space-y-2 text-sm">
            <li><span className="text-muted-foreground">Política de Privacidade</span></li>
            <li><span className="text-muted-foreground">Termos de Uso</span></li>
            <li><span className="text-muted-foreground">Contato</span></li>
          </ul>
        </div>
        <div>
          <div className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Versão
          </div>
          <div className="text-sm text-muted-foreground">
            TrailBook v1.1
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            © {new Date().getFullYear()} TrailBook · Todos os direitos reservados
          </div>
        </div>
      </div>
    </footer>
  );
}
