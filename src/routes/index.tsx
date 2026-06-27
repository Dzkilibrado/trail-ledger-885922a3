import { createFileRoute, Link } from "@tanstack/react-router";
import { Bike, Shield, QrCode, Wrench, Activity, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TrailBook — Prontuário digital para motos off-road" },
      { name: "description", content: "O histórico completo da sua Honda CRF, Yamaha WR, KTM, GasGas ou Husqvarna em um só lugar. Manutenções, eventos, certificado digital com QR Code." },
      { property: "og:title", content: "TrailBook — Prontuário digital para motos off-road" },
      { property: "og:description", content: "O Carfax brasileiro para motos de trilha." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen surface-hero text-foreground">
      <header className="container mx-auto flex items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground btn-glow">
            <Bike className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">TrailBook</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/auth">
            <Button variant="ghost">Entrar</Button>
          </Link>
          <Link to="/auth">
            <Button className="btn-glow">Criar conta</Button>
          </Link>
        </nav>
      </header>

      <section className="container mx-auto grid gap-16 px-6 py-20 lg:grid-cols-2 lg:py-32">
        <div className="flex flex-col justify-center gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Carfax para motos off-road
          </span>
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            O prontuário <span className="text-gradient-primary">permanente</span> da sua moto de trilha.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Registre cada hora, cada km, cada manutenção. Construa um histórico confiável da sua Honda CRF, Yamaha WR, KTM, GasGas ou Husqvarna — e prove o cuidado na hora de vender.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/auth">
              <Button size="lg" className="btn-glow">Começar grátis</Button>
            </Link>
            <Button size="lg" variant="outline">Como funciona</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Histórico assinado</div>
            <div className="flex items-center gap-2"><QrCode className="h-4 w-4 text-primary" /> Certificado com QR Code</div>
            <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Índice de Conservação</div>
          </div>
        </div>

        <div className="surface-elevated relative overflow-hidden rounded-3xl p-1">
          <div className="rounded-[22px] bg-background p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Minha CRF 250F</div>
                <div className="font-display text-2xl font-bold">2024 · 87.4h</div>
              </div>
              <div className="rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">94/100</div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Horas", value: "87.4h" },
                { label: "Km", value: "612" },
                { label: "Eventos", value: "23" },
              ].map((m) => (
                <div key={m.label} className="rounded-xl border border-border bg-card p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{m.label}</div>
                  <div className="font-display text-lg font-bold">{m.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-3">
              {[
                { icon: Wrench, title: "Troca de óleo 10W40", meta: "82.0h · há 3 dias", color: "text-primary" },
                { icon: Activity, title: "Trilha Serra da Cantareira", meta: "+4.2h · 28 km", color: "text-foreground" },
                { icon: FileCheck2, title: "Revisão 80h — Oficina XR", meta: "Assinado digitalmente", color: "text-success" },
              ].map((e, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3">
                  <div className={`grid h-9 w-9 place-items-center rounded-lg bg-elevated ${e.color}`}>
                    <e.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{e.title}</div>
                    <div className="text-xs text-muted-foreground">{e.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto grid gap-6 px-6 pb-24 md:grid-cols-3">
        {[
          { icon: Activity, title: "Linha do tempo viva", desc: "Cada uso, manutenção, foto e documento em ordem cronológica." },
          { icon: Wrench, title: "Agenda inteligente", desc: "Alertas por horas, km ou dias — o que vencer primeiro." },
          { icon: QrCode, title: "Certificado público", desc: "Compartilhe o histórico autorizado com QR Code na venda." },
        ].map((f) => (
          <div key={f.title} className="surface-elevated rounded-2xl p-6">
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-bold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} TrailBook · Prontuário digital para motos off-road
      </footer>
    </div>
  );
}
