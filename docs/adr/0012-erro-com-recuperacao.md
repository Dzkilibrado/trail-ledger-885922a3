# ADR 0012 — Erro com Recuperação

**Status:** Aprovado — vigente a partir de v1.6.4 (2026-07-12)

## Contexto
O princípio "Sucesso só após sincronia da UI" (ADR 0011) resolveu o falso
positivo em fluxos assíncronos. Falta o oposto: quando o backend detecta
que o estado mudou entre o momento em que o usuário viu a tela e a
chegada da requisição, a UI mostrava mensagens técnicas ("Aceite não
persistido — recarregue a página") e obrigava o usuário a atualizar
manualmente. O usuário ficava preso em um estado inconsistente.

## Decisão
Estabelecer como princípio permanente complementar:

> **O TrailBook deve tentar se recuperar automaticamente de estados
> desatualizados antes de pedir qualquer ação manual ao usuário.**

Fluxo obrigatório em qualquer falha por conflito de estado / RLS "0 linhas" /
versão desatualizada / alteração concorrente:

1. Backend lança erro com prefixo estável `STALE_STATE:` (helper em
   `src/lib/errors/stale-state.ts`).
2. Frontend detecta o prefixo via `isStaleStateError()`.
3. Executa refetch da linha oficial e `await invalidateAll()` das queries
   correlatas — mesma disciplina da ADR 0011.
4. Só depois exibe mensagem amigável (`staleStateUserMessage()`) — sem
   linguagem técnica, sem culpar o usuário, sem exigir refresh manual.
5. Retry (quando oferecido) só é habilitado após a UI estar sincronizada,
   e deve ser idempotente (nenhum aceite, upload ou evento duplicado).

## Padrão oficial de mensagens
- **Negócio:** "Este recibo já foi atualizado por outra ação."
- **Recuperável (após sincronia):** "As informações mudaram durante
  \"<operação>\". Atualizamos a tela para você — revise o status e tente
  novamente, se necessário."
- **Técnico inesperado:** "Não foi possível concluir esta ação agora.
  Tente novamente em instantes." (+ código de suporte, quando aplicável).

Proibido mostrar stack trace, mensagem de banco, texto de RLS, código
interno ou detalhes de implementação. Esses dados vivem apenas no log
técnico com `support_code`, operação, entidade, status anterior/atual,
usuário mascarado e timestamp.

## Aplicação inicial
Recibo Inteligente (`EmitReceiptDialog`): `onAccept`, `onUploadSigned`,
`onComplete`, `onCancel` passam por `handleReceiptError()`. As três
funções `attachSignedReceipt`, `acceptSignedReceipt` e
`completeReceiptTransfer` emitem `STALE_STATE:` quando `.select().single()`
retorna 0 linhas.

## Aplicação futura
Padrão obrigatório em documentos, certificados, transferências, chamados,
perfil, uploads, manutenção, componentes, compartilhamentos,
arquivamento, restauração — qualquer operação com `update` no backend.

## Relação com outras ADRs
- Complementa ADR 0011 (Sucesso só após sincronia). Juntos formam o par
  permanente: **sucesso após sincronização + erro com recuperação
  automática**.
- Entra na etapa Final da ADR 0008 (Regra Permanente de Qualidade) como
  critério de homologação de qualquer fluxo assíncrono.

## Escopo fora
- Não altera RLS, migrations ou regras de negócio.
- Não introduz UI nova — apenas orquestração de erro + helper compartilhado.
