# ADR 0011 — Sucesso só após sincronia da UI

**Status:** Aprovado — vigente a partir de v1.6.1 (2026-07-12)

## Contexto
No fluxo de aceite do Recibo Inteligente foi observada uma divergência: o
toast "Aceite registrado" aparecia enquanto a interface continuava
mostrando "Aguardando aceite", "Comprador pendente" e o botão "Aceitar"
disponível. A causa raiz foi um `update()` sem `.select()` em
`acceptSignedReceipt` — o Postgres pode retornar sucesso mesmo com 0
linhas afetadas quando a RLS filtra a operação; o cliente exibia
"sucesso" com estado inalterado.

## Decisão
Estabelecer como princípio permanente:

> **Nenhuma mensagem de sucesso poderá ser apresentada ao usuário antes
> que a interface reflita completamente o novo estado da operação.**

Toda mutação assíncrona deve seguir a ordem:
1. usuário dispara → 2. backend grava e retorna registro atualizado →
3. cliente aplica o estado retornado → 4. `await invalidateQueries` →
5. UI reflete o novo estado → 6. toast de sucesso.

## Consequências
- `createServerFn` que altera estado retorna a linha atualizada via
  `.update(...).eq(...).select(...).single()`. Sem `.select()` a RLS
  pode silenciosamente rejeitar a operação.
- `0 linhas` retornadas viram erro de negócio explícito.
- `invalidateQueries` correlatas ao fluxo são aguardadas antes do toast.
- Optimistic updates são proibidos em fluxos onde divergência gera
  confusão (aceites, transferências, conclusões).

## Relação com outras ADRs
- Complementa ADR 0008 (Regra Permanente de Qualidade) na etapa Final.
- Aplica-se aos fluxos protegidos pela ADR 0001 (recomposição cronológica).

## Escopo fora
- Não altera RLS, migrations ou regras de negócio.
- Não introduz novos componentes de UI — apenas orquestração.
