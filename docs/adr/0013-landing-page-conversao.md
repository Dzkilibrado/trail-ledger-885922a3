# ADR 0013 — Landing Page: conversão e divulgação progressiva

**Status:** Aceito · v1.6.5 · 2026-07-13

## Contexto

A landing pública havia crescido para 19 seções (~1.060 linhas), com muita
repetição de conteúdo e forte carga de leitura no mobile — plataforma
prioritária do TrailBook. O objetivo do site institucional é conversão,
não ensino de funcionalidades.

## Decisão

### Princípio permanente

> "A Landing Page do TrailBook tem como missão principal converter
> visitantes em usuários cadastrados. Ela desperta interesse, transmite
> confiança e explica a proposta de valor rapidamente. Não deve ensinar
> todas as funcionalidades — os detalhes são apresentados
> progressivamente, apenas quando o visitante demonstrar interesse. A
> Landing Page deve permanecer curta, objetiva, moderna e otimizada
> para smartphones."

### Regras

- **Divulgação progressiva:** landing vende a ideia; o app ensina o uso
  (onboarding, "Como funciona", FAQ, HelpTooltips, Novidades).
- **Estrutura oficial** (`src/routes/index.tsx`):
  1. Hero (CTA "Criar conta" + "Entrar")
  2. Benefícios (5 cards)
  3. Como funciona (4 passos)
  4. Carrossel do aplicativo (máx. 4 telas, scroll-snap horizontal,
     sem autoplay, sem áudio, sem obrigatoriedade)
  5. FAQ resumida (5 perguntas)
  6. CTA final
  7. Rodapé mínimo
- **Mobile-first:** desenhado primeiro para ≤ 390px; nada de textos
  longos, hover como única affordance, ou dependência de tela grande.
- **Sem vídeo/autoplay/tour animado** na landing (revisitável em
  futura ADR se houver evidência de conversão).
- **Performance:** apenas hero com `fetchPriority="high"`; demais imagens
  `loading="lazy"`. Nenhuma biblioteca de carrossel — scroll-snap nativo.
- **Acessibilidade:** carrossel com `role="region"`,
  `aria-roledescription="carrossel"`, indicador "X de N" com `aria-live`,
  botões prev/next com `aria-label`, foco visível herdado do design
  system.

### Fora do escopo desta ADR

Regras de negócio, migrations, RLS, fluxos homologados. Nenhuma
alteração no aplicativo autenticado.

## Consequências

- Redução de ~19 seções para 6 no `<main>`; página cabe em poucas
  telas de rolagem em mobile.
- Manutenção da landing simplificada — cada nova seção precisa passar
  pelas 3 perguntas de UX oficial + Regra de Qualidade (ADR 0008).
- Detalhamento longo (Lifecycle, ValueDrivers, DocumentsVault,
  SmartAgenda, ConservationScore, Certified, Security, Plans,
  BrandStory, MissionVision, BrandValues) sai do site institucional;
  quando necessário, migra para páginas dedicadas em `/como-funciona`,
  `/faq` ou material fora do fluxo de conversão.