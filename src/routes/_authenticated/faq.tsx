import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { Search } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Article = Database["public"]["Tables"]["help_articles"]["Row"];

export const Route = (createFileRoute as any)("/_authenticated/faq")({
  component: FAQ,
});

// ── Fallback hardcoded (usado se KB não carregar) ──────────────
const FAQ_FALLBACK = [
  { id: "cadastro", title: "Cadastro", items: [
    { q: "Por que preciso informar meu CPF?", a: "O CPF garante que cada motocicleta tenha um dono real e único, evitando cadastros duplicados e dando validade jurídica aos documentos como o Recibo de Compra e Venda." },
    { q: "Posso alterar meu CPF?", a: "Depois de validado, o CPF só pode ser alterado por meio de um chamado no suporte, para proteger seu histórico e evitar fraudes." },
    { q: "Como atualizar meu cadastro?", a: "Vá em Configurações → Dados do perfil. Você atualiza nome, telefone, endereço e outras informações a qualquer momento." },
    { q: "Quais dados são obrigatórios?", a: "Nome completo, CPF, data de nascimento, telefone e e-mail. Endereço é necessário para gerar documentos oficiais." },
  ]},
  { id: "moto", title: "Motocicleta", items: [
    { q: "O que é Documento de Origem?", a: "É o documento que comprova como a motocicleta chegou até você: Nota Fiscal (moto nova) ou Recibo de Compra e Venda (moto usada)." },
    { q: "Posso anexar Nota Fiscal?", a: "Sim. A Nota Fiscal é aceita como Documento de Origem para motos compradas em concessionária ou de pessoa jurídica." },
    { q: "Posso anexar Recibo de Compra e Venda?", a: "Sim. Para motos compradas de outra pessoa física, o Recibo assinado vale como Documento de Origem." },
    { q: "Posso trocar o Documento de Origem?", a: "Sim. Você pode enviar um novo documento a qualquer momento — o anterior é mantido no histórico, nunca apagado." },
    { q: "O histórico é apagado quando substituo um documento?", a: "Nunca. O TrailBook preserva integralmente o histórico. O documento antigo continua registrado, apenas deixa de ser o ativo." },
    { q: "Como funciona a preservação do histórico?", a: "Toda substituição só rebaixa o documento anterior de 'ativo' para 'histórico', sem deletar nenhum dado." },
  ]},
  { id: "recibo", title: "Recibo de Compra e Venda", items: [
    { q: "O que é o Recibo de Compra e Venda?", a: "É um documento oficial gerado pelo TrailBook para registrar a negociação de uma motocicleta entre comprador e vendedor." },
    { q: "Quando devo utilizar?", a: "Sempre que vender ou comprar uma motocicleta usada." },
    { q: "Como gerar?", a: "Na Central da Moto, acesse a opção de gerar Recibo. Preencha os dados e confirme." },
    { q: "Como imprimir?", a: "Após gerar, você recebe um PDF pronto para imprimir e assinar." },
    { q: "Como anexar o documento assinado?", a: "Depois de assinado, use a opção de anexar o documento assinado ao histórico da moto." },
    { q: "E quando o comprador também é usuário do TrailBook?", a: "O sistema identifica o comprador pelo CPF e envia solicitação para ele aceitar dentro do próprio TrailBook." },
    { q: "E quando o comprador é externo?", a: "Você gera o recibo, imprime, colhe a assinatura e anexa o documento assinado ao histórico." },
  ]},
  { id: "passaporte", title: "Passaporte Digital", items: [
    { q: "O que é o Passaporte Digital?", a: "É uma visão pública e confiável da sua motocicleta: modelo, ano, estado de conservação, Selos conquistados e resumo do histórico." },
    { q: "Quem pode visualizar?", a: "Qualquer pessoa com quem você compartilhar o link. Você controla quando gerar e quando desativar." },
    { q: "O que é compartilhado?", a: "Apenas informações públicas: dados da moto, Selos e resumo. Documentos privados e dados pessoais não aparecem." },
    { q: "Meus documentos ficam públicos?", a: "Não. Documentos como Nota Fiscal e Recibo ficam sempre protegidos e visíveis somente para você." },
  ]},
  { id: "selos", title: "Selos de Qualidade", items: [
    { q: "O que significam?", a: "Os Selos mostram, de forma visual, que a sua motocicleta tem histórico comprovado — origem, documentação, manutenções e cadeia de propriedade." },
    { q: "Como conquistar?", a: "Os Selos são conquistados automaticamente conforme você cumpre os critérios. Não existe botão para forçar um selo." },
    { q: "O que é Histórico Completo?", a: "É o selo agregador: sua moto tem origem comprovada, documentação em dia e cadeia de propriedade íntegra." },
    { q: "Por que um selo desapareceu?", a: "Se uma condição deixou de ser atendida, o selo é retirado automaticamente. Basta regularizar para reconquistar." },
  ]},
  { id: "seguranca", title: "Segurança e privacidade", items: [
    { q: "Quem pode visualizar meus documentos?", a: "Apenas você. Compartilhamento só acontece por Passaporte Digital (dados públicos) ou Recibo (partes da negociação)." },
    { q: "Como funciona a LGPD?", a: "Seus dados são tratados conforme a LGPD: você pode consultar, atualizar e solicitar exclusão a qualquer momento pelo suporte." },
  ]},
];

function FAQ() {
  const [search, setSearch] = useState("");

  const { data: kbArticles, isError } = useQuery({
    queryKey: ["faq_articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("help_articles")
        .select("id, title, summary, body_md, module_key, status")
        .eq("status", "published")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Article[];
    },
    staleTime: 5 * 60_000,
  });

  // Usar KB se disponível, fallback hardcoded se não
  const useKB = !!kbArticles && kbArticles.length > 0 && !isError;

  const filtered = useMemo(() => {
    if (!useKB) {
      // Fallback hardcoded
      if (!search.trim()) return FAQ_FALLBACK;
      const q = search.toLowerCase();
      return FAQ_FALLBACK
        .map((s) => ({ ...s, items: s.items.filter((i) => i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q)) }))
        .filter((s) => s.items.length > 0);
    }
    // KB
    if (!search.trim()) return kbArticles;
    const q = search.toLowerCase();
    return kbArticles.filter(
      (a) => a.title.toLowerCase().includes(q) || (a.summary ?? "").toLowerCase().includes(q)
    );
  }, [search, useKB, kbArticles]);

  return (
    <div className="pb-24">
      <PageHeader title="Perguntas frequentes" backTo="/dashboard" />
      <div className="px-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar dúvidas…"
            className="pl-9"
          />
        </div>

        {/* Renderização da KB */}
        {useKB && (
          <Accordion type="multiple" className="space-y-2">
            {(filtered as Article[]).map((a) => (
              <AccordionItem key={a.id} value={a.id} className="rounded-xl border border-border bg-card px-4">
                <AccordionTrigger className="text-sm font-medium py-3">{a.title}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground pb-3">
                  {a.summary}
                  {a.body_md && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-primary font-medium">Ver mais</summary>
                      <p className="mt-2 whitespace-pre-wrap text-xs">{a.body_md}</p>
                    </details>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        {/* Fallback hardcoded */}
        {!useKB && (
          <>
            {(filtered as typeof FAQ_FALLBACK).map((section) => (
              <div key={section.id}>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  {section.title}
                </h2>
                <Accordion type="multiple" className="space-y-2">
                  {section.items.map((item, i) => (
                    <AccordionItem key={i} value={`${section.id}-${i}`} className="rounded-xl border border-border bg-card px-4">
                      <AccordionTrigger className="text-sm font-medium py-3">{item.q}</AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground pb-3">{item.a}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </>
        )}

        {!useKB && (filtered as typeof FAQ_FALLBACK).length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Nenhuma dúvida encontrada.</p>
        )}
        {useKB && (filtered as Article[]).length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Nenhuma dúvida encontrada.</p>
        )}
      </div>
    </div>
  );
}
