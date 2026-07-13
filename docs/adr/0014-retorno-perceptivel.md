# ADR 0014 — Retorno Perceptível a Toda Ação

**Status:** Aceito · **Data:** 2026-07-13 · **Sprint:** v1.6.7

## Contexto
Durante a homologação autenticada da Central de Atendimento e da Central de Comunicação foram identificados cliques sem qualquer retorno visível: botões "Notificações" abrindo a tela errada, links para rotas inexistentes, aninhamento inválido `<Link><Button/></Link>` que em alguns navegadores anula o evento, e páginas (ex.: Mensagens) sem opção clara de voltar.

## Decisão
Fica permanente o princípio: **nenhuma ação do usuário pode terminar sem retorno perceptível**. Toda interação deve produzir navegação, carregamento, confirmação, sucesso, erro ou feedback visual imediato.

## Consequências
- Botões que navegam adotam obrigatoriamente `<Button asChild><Link/></Button>`.
- Links devem apontar para rotas reais e existentes no `routeTree.gen.ts`.
- Toda página com fluxo próprio inclui `PageHeader` com "Voltar" contextual.
- Ações assíncronas usam skeleton/spinner/estado desabilitado durante execução.
- Falhas seguem ADR 0012 (erro com recuperação); sucessos seguem ADR 0011 (após sincronia).

## Complementa
- ADR 0011 (sucesso após sincronia)
- ADR 0012 (erro com recuperação)