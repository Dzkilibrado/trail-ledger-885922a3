import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsNewDialog } from "./WhatsNewDialog";

const STORAGE_KEY = "tb_whatsnew_v15_dismissed";

export function WhatsNewCard() {
  const [dismissed, setDismissed] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  function dismiss() {
    try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch { /* noop */ }
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 sm:p-5">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Ocultar novidades"
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 pr-8">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">Novidades do TrailBook</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Recibo, Documento de Origem, Selos, Passaporte Digital e melhorias no cadastro.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setOpen(true)}>Saiba mais</Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>Depois</Button>
          </div>
        </div>
      </div>
      <WhatsNewDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}