import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { Search, HelpCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/faq")({
  head: () => ({
    meta: [
      { title: "Perguntas frequentes — TrailBook" },
      { name: "description", content: "Dúvidas comuns sobre cadastro, motocicleta, Recibo, Passaporte Digital, Selos e segurança." },
    ],
  }),
  component: FAQPage,
});

type QA = { q: string; a: string };
type Section = { id: string; title: string; items: QA[] };

const SECTIONS: Section[] = [
  {
    id: "cadastro",
    title: "Cadastro",
    items: [
      { q: "Por que preciso informar meu CPF?", a: "O CPF garante que cada motocicleta tenha um dono real e único, evitando cadastros duplicados e dando validade jurídica aos documentos (como o Recibo de Compra e Venda)." },
      { q: "Posso alterar meu CPF?", a: "Depois de validado, o CPF só pode ser alterado por meio de um chamado no suporte, para proteger seu histórico e evitar fraudes." },
      { q: "Como atualizar meu cadastro?", a: "Vá em Configurações → Dados do perfil. Você atualiza nome, telefone, endereço e outras informações a qualquer momento." },
      { q: "Quais dados são obrigatórios?", a: "Nome completo, CPF, data de nascimento, telefone e e-mail. Endereço é necessário para gerar documentos oficiais." },
    ],
  },
  {
    id: "moto",
    title: "Motocicleta",
    items: [
      { q: "O que é Documento de Origem?", a: "É o documento que comprova como a motocicleta chegou até você: Nota Fiscal (moto nova) ou Recibo de Compra e Venda (moto usada)." },
      { q: "Posso anexar Nota Fiscal?", a: "Sim. A Nota Fiscal é aceita como Documento de Origem para motos compradas em concessionária ou de pessoa jurídica." },
      { q: "Posso anexar Recibo de Compra e Venda?", a: "Sim. Para motos compradas de outra pessoa física, o Recibo assinado vale como Documento de Origem." },
      { q: "Posso trocar o Documento de Origem?", a: "Sim. Você pode enviar um novo documento a qualquer momento — o anterior é mantido no histórico, nunca apagado." },
      { q: "O histórico é apagado quando substituo um documento?", a: "Nunca. O TrailBook preserva integralmente o histórico. O documento antigo continua registrado, apenas deixa de ser o \"atual\"." },
      { q: "Como funciona a preservação do histórico?", a: "Toda substituição só rebaixa o documento anterior de \"atual\" para \"histórico\". Arquivo, autor, data e trilha de auditoria permanecem intactos." },
    ],
  },
  {
    id: "recibo",
    title: "Recibo de Compra e Venda",
    items: [
      { q: "O que é o Recibo de Compra e Venda?", a: "É um documento oficial gerado pelo TrailBook para registrar a negociação de uma motocicleta entre comprador e vendedor." },
      { q: "Quando devo utilizar?", a: "Sempre que vender ou comprar uma motocicleta usada. Ele documenta valor, forma de pagamento, data e partes envolvidas." },
      { q: "Como gerar?", a: "Na Central da Moto, toque em \"Gerar Recibo\" e preencha os dados do comprador e da negociação." },
      { q: "Como imprimir?", a: "Após gerar, você recebe um PDF pronto para imprimir e assinar." },
      { q: "Como anexar o documento assinado?", a: "Depois de assinado, use a opção \"Anexar recibo assinado\" no mesmo fluxo — ele fica registrado como comprovante." },
      { q: "E quando o comprador também é usuário do TrailBook?", a: "O sistema identifica o comprador pelo CPF e envia uma solicitação para ele aceitar dentro do próprio TrailBook, sem precisar imprimir." },
      { q: "E quando o comprador é externo?", a: "Você pode gerar o recibo normalmente, imprimir, colher a assinatura e anexar o documento assinado ao histórico." },
    ],
  },
  {
    id: "passaporte",
    title: "Passaporte Digital",
    items: [
      { q: "O que é o Passaporte Digital?", a: "É uma visão pública e confiável da sua motocicleta: modelo, ano, estado de conservação, Selos conquistados e resumo do histórico." },
      { q: "Quem pode visualizar?", a: "Qualquer pessoa com quem você compartilhar o link. Você controla quando gerar e quando desativar." },
      { q: "O que é compartilhado?", a: "Apenas informações públicas: dados da moto, Selos e resumo. Documentos privados, valores e dados pessoais não aparecem." },
      { q: "Meus documentos ficam públicos?", a: "Não. Documentos como Nota Fiscal, Recibo e comprovantes ficam sempre protegidos e visíveis somente para você." },
    ],
  },
  {
    id: "selos",
    title: "Selos de Qualidade",
    items: [
      { q: "O que significam?", a: "Os Selos mostram, de forma visual, que a sua motocicleta tem histórico comprovado — origem, documentação, manutenções e cadeia de propriedade." },
      { q: "Como conquistar?", a: "Os Selos são conquistados automaticamente conforme você cumpre os critérios. Não existe botão para \"ganhar\" um selo." },
      { q: "O que é Histórico Completo?", a: "É o selo agregador: sua moto tem origem comprovada, documentação em dia e cadeia de propriedade íntegra." },
      { q: "Por que um selo desapareceu?", a: "Se uma condição deixou de ser atendida (por exemplo, uma manutenção venceu), o selo é retirado automaticamente. Basta regularizar para reconquistar." },
    ],
  },
  {
    id: "seguranca",
    title: "Segurança e privacidade",
    items: [
      { q: "Quem pode visualizar meus documentos?", a: "Apenas você. Compartilhamento só acontece por Passaporte Digital (dados públicos) ou Recibo (partes da negociação)." },
      { q: "Como funciona a LGPD?", a: "Seus dados são tratados conforme a LGPD: você pode consultar, atualizar e solicitar exclusão a qualquer momento pelo suporte." },
    ],
  },
];

function FAQPage() {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return SECTIONS;
    return SECTIONS
      .map((s) => ({ ...s, items: s.items.filter((it) => it.q.toLowerCase().includes(term) || it.a.toLowerCase().includes(term)) }))
      .filter((s) => s.items.length > 0);
  }, [q]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Perguntas frequentes"
        description="Respostas rápidas sobre cadastro, moto, Recibo, Passaporte e Selos."
      />

      <div className="rounded-2xl border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por palavra-chave"
            className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          to="/como-funciona"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent/40"
        >
          <HelpCircle className="h-3.5 w-3.5" /> Ver como o TrailBook funciona
        </Link>
        <Link
          to="/help"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent/40"
        >
          Não achei minha dúvida — falar com o suporte
        </Link>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma pergunta encontrada para "{q}".
        </div>
      )}

      {filtered.map((section) => (
        <section key={section.id} id={section.id}>
          <h2 className="mb-2 font-display text-base font-bold sm:text-lg">{section.title}</h2>
          <Accordion type="multiple" className="rounded-2xl border border-border bg-card/40 px-3">
            {section.items.map((it, i) => (
              <AccordionItem key={i} value={`${section.id}-${i}`} className="border-border">
                <AccordionTrigger className="text-left text-sm">{it.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{it.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}
    </div>
  );
}