---
name: Sucesso só após sincronia da UI
description: Nenhuma mensagem de sucesso pode ser apresentada antes que a interface reflita completamente o novo estado da operação. Toda mutação assíncrona deve confirmar backend, sincronizar componentes e só então informar sucesso.
type: preference
---

**Princípio permanente do TrailBook** (vigente a partir de v1.6.1, ADR 0011).

## Regra
Nenhuma mensagem de sucesso (`toast.success`, banner "concluído",
`TBSuccessState`, etc.) pode ser apresentada ao usuário **antes** que a
interface reflita completamente o novo estado da operação.

## Ordem obrigatória
1. Usuário dispara a ação.
2. Backend grava e **retorna o registro atualizado** (não apenas `{ok:true}`).
3. Cliente aplica o estado retornado como fonte única (`setState` / cache).
4. `await` de todas as `invalidateQueries` que alimentam telas correlatas
   (Central, Passaporte, Timeline, Indicadores, listas, contadores).
5. Interface reflete o novo estado (botões somem, status muda, chips atualizam).
6. **Só então** o toast/mensagem de sucesso é exibido.

## Consequências operacionais
- Toda mutação de escrita em `createServerFn` deve terminar com
  `.update(...).eq(...).select(...).single()` (ou equivalente) e retornar a
  linha atualizada. Sem `.select()`, a RLS pode filtrar 0 linhas
  silenciosamente — o cliente exibiria "sucesso" com estado inalterado.
- Quando 0 linhas voltarem do `.select().single()`, tratar como erro de
  negócio: "Operação não persistida — estado mudou. Recarregue e tente novamente."
- `invalidateQueries` **deve ser aguardado** (`await Promise.all([...])`)
  antes do toast quando outros consumidores mostram o mesmo estado.
- Nunca aplicar optimistic updates em fluxos onde a divergência entre
  UI e backend gera confusão de estado (aceites, transferências,
  conclusões, pagamentos).

## Aplicabilidade
Vale para todos os fluxos assíncronos, especialmente:
- Recibo Inteligente (anexar assinado, aceite, concluir, cancelar).
- Transferência de propriedade (aprovar/recusar/cancelar).
- Alteração de CPF via Suporte (aprovar/rejeitar).
- Emissão de certificados, planos, componentes.
- Tickets, mensagens e qualquer operação que altera badge/contador visível.

## Origem
Regressão observada em v1.6: aceite de Recibo exibia toast "Aceite
registrado" mesmo quando a interface continuava em "Aguardando aceite /
pendente / botão Aceitar visível". Causa raiz: `.update()` sem `.select()`
em `acceptSignedReceipt` — a RLS pode aceitar a operação com 0 linhas
afetadas sem erro. Corrigido junto com a introdução deste princípio.
