import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { UserPlus, Bike, ShieldCheck, Wrench, FileSignature, Share2, Award } from "lucide-react";

export const Route = createFileRoute("/_authenticated/como-funciona")({
  head: () => ({
    meta: [
      { title: "Como o TrailBook funciona — TrailBook" },
      { name: "description", content: "O fluxo do TrailBook em passos simples: cadastro, moto, origem, manutenções, recibo, passaporte e selos." },
    ],
  }),
  component: HowItWorks,
});

const STEPS = [
  { icon: UserPlus, title: "1. Complete seu cadastro", text: "Informe seus dados uma única vez. Eles são reutilizados em todo o TrailBook — você não precisa preencher de novo." },
  { icon: Bike, title: "2. Cadastre sua motocicleta", text: "Adicione marca, modelo, ano, hodômetro e horímetro. Se tiver foto, melhor ainda." },
  { icon: ShieldCheck, title: "3. Adicione o Documento de Origem", text: "Anexe a Nota Fiscal ou o Recibo de Compra e Venda para comprovar a procedência da moto." },
  { icon: Wrench, title: "4. Registre manutenções e eventos", text: "Toda troca de óleo, pneu, revisão ou reparo entra no histórico. Nada se perde." },
  { icon: FileSignature, title: "5. Gere Recibo de Compra e Venda", text: "Quando for vender ou comprar, gere um recibo oficial dentro do TrailBook, assine e anexe o documento." },
  { icon: Share2, title: "6. Compartilhe o Passaporte Digital", text: "Envie um link público e confiável com os dados da sua moto para compradores e oficinas." },
  { icon: Award, title: "7. Conquiste Selos de Qualidade", text: "Os Selos aparecem automaticamente conforme sua moto acumula histórico comprovado. Nenhum é dado manualmente." },
];

function HowItWorks() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Como o TrailBook funciona"
        description="Um passo de cada vez. Você pode fazer no seu ritmo."
      />

      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <s.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold sm:text-base">{s.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        Ficou com dúvida?{" "}
        <Link to="/faq" className="font-semibold text-primary hover:underline">Ver perguntas frequentes</Link>
        {" · "}
        <Link to="/help" className="font-semibold text-primary hover:underline">Falar com o suporte</Link>
      </div>
    </div>
  );
}