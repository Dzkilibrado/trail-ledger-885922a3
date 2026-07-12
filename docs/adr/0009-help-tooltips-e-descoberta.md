# ADR 0009 — Help Tooltips e Princípio da Descoberta em Um Toque

**Status:** Aceito · v1.0 · 2026-07-12
**Fase relacionada:** UX v1.5.1

## Contexto

A entrega UX v1.5 introduziu o componente `HelpTooltip`, a FAQ, o guia
"Como funciona" e o `WelcomeTour`. Faltava definir **onde** e **como** os
tooltips devem ser aplicados de forma consistente em todo o TrailBook, e
registrar o princípio permanente de descoberta que rege a UX daqui em
diante.

## Decisão

### 1. Princípio oficial de UX

> "O usuário deve conseguir compreender qualquer funcionalidade do
> TrailBook em até um toque."

Sempre que existir um termo que possa gerar dúvida, adota-se **uma**
destas duas soluções:

1. Apresentar um `HelpTooltip` ao lado do termo; ou
2. Renomear o termo para algo mais intuitivo.

Se o usuário precisar perguntar o significado de um botão ou
funcionalidade, a UX precisa melhorar — não o suporte.

### 2. Componente único

Todo o sistema usa exclusivamente `src/components/HelpTooltip.tsx`.
Não criar implementações paralelas em outros módulos.

### 3. Fonte única de textos

Todos os textos de ajuda vivem em `src/lib/help/texts.ts` (registry
`HELP`). Isso garante linguagem consistente, revisão centralizada e
reuso.

### 4. Onde aplicar

Tooltips devem existir **apenas onde agreguem valor real**. Não
transformar a interface em um campo minado de ícones de ajuda.

Áreas cobertas na Fase 1.5.1:

- **Início (Dashboard):** Atalhos, Documento de origem pendente.
- **Central da Moto:** Selos de Qualidade (via `BadgeSection`),
  Documento de origem (via banner reutilizado).
- **Passaporte Digital:** Passaporte, Compartilhamento, Pendências,
  Selo TrailBook Certified, Histórico de propriedade, Saúde, Linha
  do tempo.
- **Documentos:** Central de Documentos, Documento de origem
  (banner).
- **Recibo de Compra e Venda:** Fluxo, Comprador TrailBook,
  Comprador externo.
- **Cadastro (`complete-profile`):** CPF, Celular, WhatsApp, Estado
  e Cidade — cada campo indica que a informação será reutilizada.
- **Selos:** cada selo já possui `BadgeTooltip` próprio (significado,
  critérios atendidos e pendentes) — atende ao requisito de tooltip
  por selo.

### 5. Regras de comportamento (obrigatórias)

- Abrir por toque no Mobile (Popover, não Tooltip puro).
- Sempre permanecer dentro da viewport (`collisionPadding: 8`).
- Texto curto e amigável — sem jargão técnico.
- Nunca ocupar a tela inteira.
- Nunca bloquear a navegação.
- Fechar com toque fora, `Esc` ou novo toque no ícone.
- Foco visível (`focus-visible:ring`) para acessibilidade.
- Respeitar modo claro e escuro (via tokens semânticos).

### 6. Reservado

O selo **"Verificado pelo TrailBook"** é reservado para uma futura fase
de validação humana/curadoria oficial. O tooltip explica isso ao
usuário para não gerar expectativa de que basta "clicar em algum lugar"
para obtê-lo.

## Consequências

- Toda nova funcionalidade que introduzir um termo novo **deve** ser
  entregue com um `HelpTooltip` correspondente ou com um nome
  autoexplicativo.
- A homologação (ADR 0008) passa a exigir, na etapa de Comunicação, a
  verificação de tooltips onde couber.
- FAQ e suporte deixam de ser a primeira porta — passam a ser
  complementares.

## Alternativas descartadas

- **Tooltip puro (Radix `Tooltip`):** rejeitada — abre apenas por hover
  e não funciona bem em toque.
- **Modal de ajuda por seção:** rejeitada — interrompe o fluxo, não
  cabe em Mobile.
- **Ícone de ajuda em todo campo:** rejeitada — polui a interface.