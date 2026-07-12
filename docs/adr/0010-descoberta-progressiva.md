# ADR 0010 — Princípio da Descoberta Progressiva

**Status:** Aceito · v1.0 · 2026-07-12
**Fase relacionada:** UX v1.5 (encerramento)

## Contexto

A Revisão de UX v1.5 padronizou linguagem (ADR 0008), Help Tooltips
e descoberta em um toque (ADR 0009). Faltava registrar como as
diferentes camadas de aprendizado do TrailBook se relacionam entre si
e como cada nova funcionalidade deve avaliar sua entrada nelas.

## Decisão

### Princípio

> "O TrailBook ensina suas funcionalidades de forma gradual. O usuário
> nunca recebe excesso de informação de uma única vez. A descoberta
> acontece em camadas."

### Camadas oficiais (nesta ordem)

1. **Interface limpa** — mostra apenas o essencial.
2. **Help Tooltip** — explica rapidamente um termo (ADR 0009).
3. **Página "Como funciona"** — mostra o fluxo completo.
4. **FAQ** — responde dúvidas específicas.
5. **Suporte** — última alternativa.

Cada camada só existe para o que a anterior não conseguiu resolver.

### Checklist obrigatório para toda funcionalidade nova

Antes de considerar uma entrega homologada, avaliar as 6 perguntas:

1. Precisa aparecer na **Home**?
2. Precisa entrar na **FAQ**?
3. Precisa aparecer no **onboarding** (`WelcomeTour`)?
4. Precisa de **Help Tooltip** (registry `HELP`)?
5. Precisa entrar em **"Como funciona"**?
6. Precisa aparecer em **Novidades** (`WhatsNewCard`/`WhatsNewDialog`)?

Qualquer resposta **SIM** vira item obrigatório da entrega — não é
"melhoria futura". O checklist é executado na etapa **Comunicação** da
Regra Permanente de Qualidade (ADR 0008).

## Consequências

- ADR 0008 passa a incluir explicitamente esse checklist na etapa
  Comunicação.
- Nenhuma funcionalidade nova pode ser homologada sem responder às 6
  perguntas por escrito.
- Suporte volta a ser exceção — sinal de que uma camada anterior falhou
  e precisa ser revista.

## Alternativas descartadas

- **Tutorial obrigatório por funcionalidade:** rejeitado — interrompe o
  fluxo e contradiz "interface ensina naturalmente".
- **Documentação como camada 1:** rejeitado — documentação é apoio
  interno, não substitui UX.