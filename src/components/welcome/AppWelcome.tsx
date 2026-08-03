import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bike, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useWelcomeBackground } from "./useWelcomeBackground";
import { getWelcomeGreeting, type WelcomeGreeting } from "./greeting";

/**
 * Tela de Boas-vindas do TrailBook.
 * Primeira tela do aplicativo — mobile-first, sem rolagem, sem estética de site.
 * O site institucional vive em /site e evolui de forma independente.
 */
export function AppWelcome({ canSignUp = true }: { canSignUp?: boolean }) {
  const { image, animate } = useWelcomeBackground();
  const [greeting, setGreeting] = useState<WelcomeGreeting | null>(null);

  useEffect(() => {
    setGreeting(getWelcomeGreeting());
  }, []);

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      {/* Fundo dinâmico — imagem sorteada e fixada por sessão */}
      <div className="absolute inset-0 -z-10 bg-background">
        {image ? (
          <img
            key={image.id}
            src={image.src}
            alt={image.alt}
            width={768}
            height={1344}
            fetchPriority="high"
            decoding="async"
            className={cn(
              "h-full w-full object-cover opacity-0 transition-opacity duration-700",
              "[animation-fill-mode:forwards]",
              animate && "animate-ken-burns",
            )}
            onLoad={(e) => e.currentTarget.classList.remove("opacity-0")}
          />
        ) : null}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/60 to-background"
        />
      </div>

      <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-end px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="animate-fade-in">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/40 bg-primary/15 backdrop-blur-sm">
            <Bike className="h-7 w-7 text-primary" aria-hidden />
          </div>

          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight">TrailBook</h1>
          <p className="mt-1 text-sm font-medium text-primary">
            O Especialista Digital em Saúde da Motocicleta
          </p>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Acompanhe manutenções, documentos e o histórico completo da sua moto
            off-road em um só lugar.
          </p>

          <div className="mt-6 min-h-[3.25rem]" aria-live="polite">
            {greeting ? (
              <>
                <p className="text-base font-semibold text-foreground">{greeting.title}</p>
                <p className="text-sm text-muted-foreground">{greeting.line}</p>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-3">
          <Button asChild size="lg" className="min-h-[52px] w-full rounded-xl text-base font-semibold">
            <Link to="/auth" search={{ tab: "signin" as const, recuperar: undefined }}>
              Entrar
            </Link>
          </Button>

          {canSignUp ? (
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-h-[52px] w-full rounded-xl border-foreground/25 bg-background/40 text-base font-semibold backdrop-blur-sm"
            >
              <Link to="/auth" search={{ tab: "signup" as const, recuperar: undefined }}>
                Criar conta
              </Link>
            </Button>
          ) : null}

          <Link
            to="/auth"
            search={{ tab: "signin" as const, recuperar: true }}
            className="mx-auto inline-flex min-h-[44px] items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Esqueci minha senha
          </Link>
        </div>

        <Link
          to="/site"
          className="mx-auto mt-4 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Conheça o TrailBook
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </main>
    </div>
  );
}