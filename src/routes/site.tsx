import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bike,
  Shield,
  FileText,
  Handshake,
  Award,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { appUrl, appSignUpUrl } from "@/lib/external-links";
import { ExternalLink } from "@/components/ExternalLink";
import heroImage from "@/assets/landing-hero.jpg";
import phoneImage from "@/assets/landing-phone.jpg";
import certificateImage from "@/assets/landing-certificate.jpg";

export const Route = createFileRoute("/site")({
  head: () => ({
    meta: [
      { title: "TrailBook — O histórico completo da sua moto" },
      {
        name: "description",
        content:
          "Organize manutenções, documentos e proprietários em um Passaporte Digital que acompanha a sua motocicleta off-road.",
      },
      { property: "og:title", content: "TrailBook — O histórico completo da sua moto" },
      {
        property: "og:description",
        content:
          "Passaporte Digital, documentos organizados e Recibo de Compra e Venda em um só app.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero />
        <Benefits />
        <HowItWorks />
        <AppShowcase />
        <FAQ />
        <FinalCTA />
      </main>
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
      <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/site" className="flex min-w-0 items-center gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground btn-glow">
            <Bike className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">TrailBook</span>
        </Link>
        <nav className="flex items-center gap-2">
          <ExternalLink href={appUrl()}>
            <Button variant="ghost" size="sm" className="whitespace-nowrap text-sm font-medium">
              Abrir o aplicativo
            </Button>
          </ExternalLink>
          <ExternalLink href={appSignUpUrl()}>
            <Button size="sm" className="btn-glow whitespace-nowrap">
              Criar uma conta
            </Button>
          </ExternalLink>
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
      <div className="container mx-auto grid gap-8 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-20">
        <div className="flex flex-col justify-center gap-5">
          <h1 className="font-display text-[2rem] font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            O histórico completo da <span className="text-gradient-primary">sua moto</span>.
          </h1>
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
            Organize manutenções, documentos e proprietários em um Passaporte Digital que acompanha
            a motocicleta.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ExternalLink href={appSignUpUrl()} className="w-full sm:w-auto">
              <Button size="lg" className="btn-glow w-full sm:w-auto">
                Criar uma conta
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </ExternalLink>
            <ExternalLink href={appUrl()} className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Abrir o aplicativo
              </Button>
            </ExternalLink>
          </div>
        </div>

        <div className="relative">
          <div className="surface-elevated overflow-hidden rounded-3xl">
            <img
              src={heroImage}
              alt="Motocicleta off-road ao lado do aplicativo TrailBook"
              width={1536}
              height={1152}
              fetchPriority="high"
              className="h-auto w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  BENEFITS                                                     */
/* ============================================================ */

const BENEFITS = [
  {
    icon: FileText,
    title: "Histórico da motocicleta",
    desc: "Manutenções, documentos e eventos organizados em ordem cronológica.",
  },
  {
    icon: Bike,
    title: "Passaporte Digital",
    desc: "A identidade da sua moto, que atravessa proprietários e permanece com ela.",
  },
  {
    icon: Shield,
    title: "Documentos organizados",
    desc: "Nota fiscal, garantia e contratos sempre à mão, com privacidade que você controla.",
  },
  {
    icon: Handshake,
    title: "Recibo de Compra e Venda",
    desc: "Formalize a negociação com aceite do comprador direto no app.",
  },
  {
    icon: Award,
    title: "Selos de Qualidade",
    desc: "O cuidado com a sua moto vira reputação verificável.",
  },
];

function Benefits() {
  return (
    <section className="container mx-auto px-4 py-14 sm:px-6 sm:py-20">
      <SectionHeader
        eyebrow="Por que TrailBook"
        title={
          <>
            Tudo que sua moto precisa em <span className="text-gradient-primary">um só lugar</span>.
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BENEFITS.map((b) => (
          <div key={b.title} className="surface-elevated rounded-2xl p-5">
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
/*  HOW IT WORKS                                                 */
/* ============================================================ */

const STEPS = [
  { n: "1", title: "Cadastre sua moto", desc: "Modelo, ano e uma foto em minutos." },
  {
    n: "2",
    title: "Organize documentos e manutenções",
    desc: "Anexe notas, garantias e revisões.",
  },
  { n: "3", title: "Acompanhe o histórico", desc: "Timeline completa e Selos de Qualidade." },
  {
    n: "4",
    title: "Compartilhe o Passaporte Digital",
    desc: "Link seguro com o próximo proprietário.",
  },
];

function HowItWorks() {
  return (
    <section className="border-y border-border/60 bg-elevated/40">
      <div className="container mx-auto px-4 py-14 sm:px-6 sm:py-20">
        <SectionHeader
          eyebrow="Como funciona"
          title={
            <>
              Quatro passos e <span className="text-gradient-primary">pronto</span>.
            </>
          }
        />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="surface-elevated flex flex-col gap-3 rounded-2xl p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground font-display text-lg font-bold btn-glow">
                {s.n}
              </span>
              <h3 className="font-display text-base font-bold leading-tight">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  APP SHOWCASE — Carrossel horizontal com scroll-snap          */
/* ============================================================ */

const SLIDES = [
  {
    img: phoneImage,
    title: "Acompanhe a saúde da moto",
    desc: "Indicadores claros de manutenções, componentes e próximas ações.",
    alt: "Tela do aplicativo TrailBook mostrando a saúde da motocicleta",
  },
  {
    img: heroImage,
    title: "Organize documentos e manutenções",
    desc: "Tudo centralizado, com histórico preservado e privacidade sob seu controle.",
    alt: "Tela do aplicativo TrailBook com documentos e manutenções",
  },
  {
    img: certificateImage,
    title: "Compartilhe o Passaporte Digital",
    desc: "Um link seguro com o histórico verificado da sua moto.",
    alt: "Passaporte Digital do TrailBook com histórico verificado",
  },
];

function AppShowcase() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const goTo = useCallback((i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const slide = el.children[i] as HTMLElement | undefined;
    if (slide) slide.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / el.clientWidth);
      setIndex(Math.max(0, Math.min(SLIDES.length - 1, i)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className="container mx-auto px-4 py-14 sm:px-6 sm:py-20">
      <SectionHeader
        eyebrow="Veja o aplicativo"
        title={
          <>
            Feito para o <span className="text-gradient-primary">seu bolso</span>.
          </>
        }
      />

      <div className="relative mx-auto max-w-3xl">
        <div
          ref={scrollerRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          role="region"
          aria-roledescription="carrossel"
          aria-label="Telas do aplicativo TrailBook"
        >
          {SLIDES.map((s, i) => (
            <article
              key={s.title}
              className="surface-elevated flex w-full shrink-0 snap-start flex-col overflow-hidden rounded-3xl"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${SLIDES.length}`}
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-elevated">
                <img
                  src={s.img}
                  alt={s.alt}
                  loading={i === 0 ? "eager" : "lazy"}
                  width={1280}
                  height={960}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-5 sm:p-6">
                <h3 className="font-display text-lg font-bold leading-tight">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => goTo(Math.max(0, index - 1))}
              disabled={index === 0}
              aria-label="Slide anterior"
              className="h-11 w-11 rounded-full"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => goTo(Math.min(SLIDES.length - 1, index + 1))}
              disabled={index === SLIDES.length - 1}
              aria-label="Próximo slide"
              className="h-11 w-11 rounded-full"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-2" aria-hidden>
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ir para o slide ${i + 1}`}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === index ? "w-6 bg-primary" : "w-2 bg-muted",
                )}
              />
            ))}
          </div>

          <span className="text-xs font-semibold text-muted-foreground" aria-live="polite">
            {index + 1} de {SLIDES.length}
          </span>
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
    q: "O que é o TrailBook?",
    a: "Um aplicativo para organizar o histórico completo da sua motocicleta off-road — manutenções, documentos, proprietários e o Passaporte Digital.",
  },
  {
    q: "Meus documentos ficam privados?",
    a: "Sim. Você controla o que fica privado e o que pode ser compartilhado no Passaporte Digital.",
  },
  {
    q: "O que é o Passaporte Digital?",
    a: "É a identidade permanente da sua moto: acompanha a motocicleta ao longo dos anos, mesmo quando ela troca de proprietário.",
  },
  {
    q: "Como funciona o Recibo de Compra e Venda?",
    a: "Você gera o recibo dentro do app, o comprador aceita digitalmente e a transferência é registrada no histórico da moto.",
  },
  {
    q: "Posso usar o TrailBook para motos off-road?",
    a: "Sim. O TrailBook foi construído para motocicletas de trilha, enduro, motocross e coleção — com ou sem documento.",
  },
];

function FAQ() {
  return (
    <section className="border-y border-border/60 bg-elevated/40">
      <div className="container mx-auto px-4 py-14 sm:px-6 sm:py-20">
        <SectionHeader
          eyebrow="Perguntas frequentes"
          title={
            <>
              Dúvidas <span className="text-gradient-primary">mais comuns</span>.
            </>
          }
        />
        <div className="mx-auto max-w-3xl">
          <Accordion type="single" collapsible className="surface-elevated rounded-2xl px-5">
            {FAQS.map((f, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border-border/60 last:border-b-0"
              >
                <AccordionTrigger className="text-left font-semibold">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  FINAL CTA                                                    */
/* ============================================================ */

function FinalCTA() {
  return (
    <section className="container mx-auto px-4 py-14 sm:px-6 sm:py-20">
      <div className="surface-elevated relative overflow-hidden rounded-3xl p-8 text-center sm:p-14">
        <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(600px_300px_at_50%_-20%,oklch(0.72_0.19_50/0.35),transparent_60%)]" />
        <div className="relative">
          <h2 className="font-display text-2xl font-bold leading-tight sm:text-4xl">
            Comece a organizar a <span className="text-gradient-primary">história da sua moto</span>
            .
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground">Ainda não utiliza o TrailBook?</p>
              <ExternalLink href={appSignUpUrl()} className="w-full sm:w-auto">
                <Button size="lg" className="btn-glow w-full sm:w-auto">
                  Criar uma conta
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </ExternalLink>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground">Já possui uma conta?</p>
              <ExternalLink href={appUrl()} className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Abrir o aplicativo
                </Button>
              </ExternalLink>
            </div>
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
      <div className="container mx-auto flex flex-col gap-6 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Bike className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">TrailBook</span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <ExternalLink href={appUrl()} className="hover:text-foreground">
            Abrir o aplicativo
          </ExternalLink>
          <ExternalLink href={appSignUpUrl()} className="hover:text-foreground">
            Criar uma conta
          </ExternalLink>
          <span className="text-muted-foreground/70">Termos</span>
          <span className="text-muted-foreground/70">Privacidade</span>
          <span className="text-muted-foreground/70">Contato</span>
        </nav>
        <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} TrailBook</div>
      </div>
    </footer>
  );
}

/* ============================================================ */
/*  SECTION HEADER                                               */
/* ============================================================ */

function SectionHeader({ eyebrow, title }: { eyebrow?: string; title: React.ReactNode }) {
  return (
    <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-12">
      {eyebrow && (
        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary sm:text-xs">
          {eyebrow}
        </span>
      )}
      <h2 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-4xl">
        {title}
      </h2>
    </div>
  );
}
