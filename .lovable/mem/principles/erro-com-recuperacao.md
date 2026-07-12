---
name: Erro com Recuperação
description: Falhas por estado desatualizado devem disparar sincronia automática (refetch + invalidate) antes de qualquer mensagem ao usuário. Nunca pedir refresh manual.
type: preference
---

**Princípio permanente do TrailBook** (vigente a partir de v1.6.4, ADR 0012).
Complementa `mem://principles/sucesso-apos-sincronia`.

## Regra
Quando uma operação assíncrona falhar por conflito de estado, alteração
concorrente, RLS filtrando 0 linhas ou versão desatualizada, o TrailBook
deve **se recuperar automaticamente** antes de exibir qualquer mensagem
ao usuário.

## Ordem obrigatória
1. Backend detecta divergência e lança erro com prefixo `STALE_STATE:`
   (helper `staleStateError()` em `src/lib/errors/stale-state.ts`).
2. Frontend detecta via `isStaleStateError()`.
3. Executa refetch da entidade + `await` das `invalidateQueries`
   correlatas (mesma disciplina de ADR 0011).
4. UI reflete o estado real: botões incompatíveis somem, status atualiza.
5. Só então exibe `staleStateUserMessage(operation)` — amigável, sem
   linguagem técnica, sem exigir refresh manual.
6. Retry (quando oferecido) só habilita depois que a tela sincronizou e
   deve ser idempotente.

## Padrão de mensagens
- **Negócio:** "Este recibo já foi atualizado por outra ação."
- **Recuperável:** "As informações mudaram durante \"<operação>\".
  Atualizamos a tela para você — revise o status e tente novamente, se
  necessário."
- **Técnico inesperado:** "Não foi possível concluir esta ação agora.
  Tente novamente em instantes." (+ código de suporte quando aplicável)

Proibido: stack trace, mensagem de banco, texto de RLS, código interno,
detalhes de implementação. Esses dados ficam apenas no log com
`support_code`, operação, entidade, status antes/depois, usuário
mascarado e timestamp.

## Aplicabilidade
Todos os fluxos assíncronos com `update` no backend: Recibo (aceite,
anexo, conclusão, cancelamento, revogação, substituição), Transferência,
Documentos, Certificados, Chamados, Perfil, Uploads, Manutenção,
Componentes, Compartilhamentos, Arquivamento, Restauração.

## Origem
Sequência do ADR 0011: mesmo com sucesso sincronizado, quando o backend
detectava estado divergente o usuário via "Recarregue a página e tente
novamente" — mensagem técnica, sem sincronia automática. A recuperação
automática elimina essa fricção.
