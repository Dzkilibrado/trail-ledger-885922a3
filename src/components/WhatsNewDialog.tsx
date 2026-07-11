import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Sparkles, FileSignature, ShieldCheck, Award, Share2, UserCheck } from "lucide-react";

const ITEMS = [
  {
    icon: FileSignature,
    title: "Recibo de Compra e Venda",
    text: "Gere e compartilhe um recibo oficial entre comprador e vendedor, com trilha de assinatura.",
  },
  {
    icon: ShieldCheck,
    title: "Documento de Origem",
    text: "Anexe Nota Fiscal ou Recibo original para comprovar a procedência da motocicleta.",
  },
  {
    icon: Award,
    title: "Selos de Qualidade",
    text: "Sua motocicleta ganha selos automaticamente conforme o histórico for sendo comprovado.",
  },
  {
    icon: Share2,
    title: "Passaporte Digital",
    text: "Compartilhe um resumo público e confiável da sua moto com compradores e oficinas.",
  },
  {
    icon: UserCheck,
    title: "Cadastro Completo",
    text: "Fluxo de cadastro mais claro, CPF validado uma única vez e alteração via suporte.",
  },
];

export function WhatsNewDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Novidades do TrailBook
          </DialogTitle>
          <DialogDescription>Um resumo do que chegou recentemente para você aproveitar melhor a sua moto.</DialogDescription>
        </DialogHeader>
        <ul className="mt-2 space-y-3">
          {ITEMS.map((it) => (
            <li key={it.title} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-xl border border-border bg-card/60 p-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <it.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold">{it.title}</div>
                <p className="text-xs text-muted-foreground">{it.text}</p>
              </div>
            </li>
          ))}
        </ul>
        <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button asChild>
            <Link to="/como-funciona">Ver como funciona</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}