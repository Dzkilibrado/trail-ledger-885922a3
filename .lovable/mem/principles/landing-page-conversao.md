---
name: Landing Page — conversão e divulgação progressiva
description: Regras permanentes da landing pública: converter visitantes, mobile-first, curta, sem ensinar todas as funcionalidades.
type: preference
---

## Princípio

"A Landing Page do TrailBook tem como missão principal converter
visitantes em usuários cadastrados. Ela desperta interesse, transmite
confiança e explica a proposta de valor rapidamente. Não deve ensinar
todas as funcionalidades — os detalhes são apresentados
progressivamente, apenas quando o visitante demonstrar interesse.
A Landing Page deve permanecer curta, objetiva, moderna e otimizada
para smartphones."

## Estrutura oficial (`src/routes/index.tsx`)

1. Hero (CTA "Criar conta" + "Entrar")
2. Benefícios (máx. 5 cards)
3. Como funciona (máx. 4 passos)
4. Carrossel do aplicativo (máx. 4 telas, scroll-snap, sem autoplay/áudio)
5. FAQ resumida (5 perguntas + link para FAQ completa)
6. CTA final
7. Rodapé mínimo

## Proibições

- Vídeo institucional, autoplay, tour animado, sequência automática de frames.
- Rodapé multi-coluna extenso em mobile.
- Repetição de conteúdo do app (ensino fica no onboarding/`/como-funciona`/FAQ/HelpTooltips).
- Bibliotecas pesadas de carrossel — usar scroll-snap nativo.
- Modal para conteúdo longo.

## Como aplicar

- Nova seção só entra se passar pelas 3 perguntas de UX oficial + Regra
  de Qualidade (ADR 0008).
- Sempre desenhar em ≤ 390px primeiro; só então adaptar desktop.
- Detalhes vão para páginas dedicadas ou "Saiba mais", nunca inline na
  landing.

## Referência

- ADR 0013 (`docs/adr/0013-landing-page-conversao.md`).
- ADR 0004 (Mobile Native First).
- ADR 0010 (Descoberta Progressiva) — mesma família conceitual.