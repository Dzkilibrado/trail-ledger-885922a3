import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bike, ShieldCheck, Wrench, Share2 } from "lucide-react";

const STORAGE_KEY = "tb_onboarding_v1_done";
const FORCE_KEY = "tb_onboarding_force_open";

const STEPS = [
  {
    icon: Bike,
    title: "Bem-vindo ao TrailBook",
    text: "O prontuário digital da sua motocicleta off-road. Aqui você organiza tudo em um só lugar.",
  },
  {
    icon: ShieldCheck,
    title: "Cadastre sua moto e o Documento de Origem",
    text: "Adicione sua motocicleta e anexe a Nota Fiscal ou Recibo de compra para comprovar a procedência.",
  },
  {
    icon: Wrench,
    title: "Registre manutenções e conquiste Selos",
    text: "Cada manutenção, foto e evento vira parte do histórico. Sua moto ganha Selos de Qualidade automaticamente.",
  },
  {
    icon: Share2,
    title: "Passaporte Digital e Recibo",
    text: "Compartilhe o Passaporte com compradores e oficinas. Gere Recibo de Compra e Venda quando for negociar.",
  },
];

export function useOpenWelcomeTour() {
  return () => {
    try { localStorage.setItem(FORCE_KEY, "1"); } catch { /* noop */ }
    window.dispatchEvent(new Event("tb:onboarding:open"));
  };
}

export function WelcomeTour() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const suppressAutoOpen = pathname === "/tickets" || pathname.startsWith("/tickets/") || pathname === "/messages" || pathname === "/notifications" || pathname === "/comunicacao";

  useEffect(() => {
    if (suppressAutoOpen) setOpen(false);
  }, [suppressAutoOpen]);

  useEffect(() => {
    let done = false;
    let force = false;
    try {
      done = localStorage.getItem(STORAGE_KEY) === "1";
      force = localStorage.getItem(FORCE_KEY) === "1";
    } catch { /* noop */ }
    if (force) {
      try { localStorage.removeItem(FORCE_KEY); } catch { /* noop */ }
      setStep(0);
      setOpen(true);
    } else if (!done && !suppressAutoOpen) {
      setStep(0);
      setOpen(true);
    }
    function onForce() {
      setStep(0);
      setOpen(true);
    }
    window.addEventListener("tb:onboarding:open", onForce);
    return () => window.removeEventListener("tb:onboarding:open", onForce);
  }, [suppressAutoOpen]);

  function finish() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* noop */ }
    setOpen(false);
  }

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  if (suppressAutoOpen) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) finish(); }}>
      <DialogContent className="max-w-md">
        <div className="grid place-items-center pt-2">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
            <s.icon className="h-7 w-7" />
          </div>
        </div>
        <DialogTitle className="mt-3 text-center text-lg">{s.title}</DialogTitle>
        <DialogDescription className="text-center text-sm text-muted-foreground">
          {s.text}
        </DialogDescription>
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"}`}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={finish}>Pular</Button>
          {isLast ? (
            <Button onClick={finish}>Começar</Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)}>Próximo</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}