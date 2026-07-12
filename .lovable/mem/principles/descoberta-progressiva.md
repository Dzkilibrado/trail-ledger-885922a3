---
name: Descoberta progressiva
description: O TrailBook ensina em camadas (interface → tooltip → como funciona → FAQ → suporte); checklist de 6 perguntas para toda funcionalidade nova.
type: preference
---

## Princípio

"O TrailBook ensina suas funcionalidades de forma gradual. O usuário
nunca recebe excesso de informação de uma única vez. A descoberta
acontece em camadas."

## Camadas (nesta ordem)

1. Interface limpa — mostra apenas o essencial.
2. `HelpTooltip` — explica rapidamente (ADR 0009).
3. Página `/como-funciona` — mostra o fluxo completo.
4. `/faq` — responde dúvidas específicas.
5. Suporte — última alternativa.

Cada camada só existe para o que a anterior não resolveu.

## Checklist obrigatório para funcionalidade nova

**How to apply:** antes de homologar, responder por escrito:

1. Precisa aparecer na Home?
2. Precisa entrar na FAQ (`/faq`)?
3. Precisa aparecer no onboarding (`WelcomeTour`)?
4. Precisa de `HelpTooltip` (registrar texto no `HELP`)?
5. Precisa entrar em "Como funciona" (`/como-funciona`)?
6. Precisa aparecer em Novidades (`WhatsNewCard`/`WhatsNewDialog`)?

Qualquer resposta SIM = item obrigatório da entrega, não "melhoria
futura". Executado na etapa Comunicação da Regra Permanente de
Qualidade (ADR 0008).

**Why:** o sistema deve ensinar naturalmente; o suporte é sinal de que
alguma camada falhou.

## Referência

- ADR 0010 (`docs/adr/0010-descoberta-progressiva.md`).
- ADR 0009 (Descoberta em um toque) — camada 2.
- ADR 0008 (Regra Permanente de Qualidade) — onde o checklist roda.