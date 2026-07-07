# ADR 0004 — Mobile Native First

- Status: Aceita
- Versão: v1.2.1
- Data: 2026-07-07

## Objetivo

Estabelecer oficialmente que o TrailBook é um sistema **projetado para uso
prioritariamente em dispositivos móveis**. Desktop existe apenas como apoio
para administração e desenvolvimento.

## Diretrizes Permanentes

1. Toda nova funcionalidade DEVE ser desenhada primeiro para smartphone
   (viewport ≤ 390px de largura).
2. Adaptação para Desktop só pode ocorrer **após** validação mobile.
3. Nenhuma funcionalidade pode depender de:
   - `:hover`
   - clique direito / menu de contexto
   - teclado físico ou atalhos
   - grandes áreas de tela
   - resoluções elevadas
4. A navegação deve ser confortável com apenas o polegar sempre que possível.
5. Nenhuma funcionalidade pode exigir zoom para ser utilizada.
6. Áreas de toque mínimas: 44×44 px (WCAG AA).
7. Textos primários ≥ 14px; nenhum truncamento em títulos principais.
8. Sheets/Drawers preferidos sobre Dialogs em telas de conteúdo.
9. Nenhum scroll horizontal em telas de conteúdo — tabelas devem virar cards
   em mobile.
10. Ícones sempre acompanhados de label acessível (`aria-label` ou texto
    visível) quando forem a única affordance de uma ação.

## Critério de Homologação

> Se qualquer tela funcionar melhor no Desktop do que no Mobile, a tela é
> considerada **NÃO homologada** — mesmo que não haja bug funcional.

A experiência mobile deve ser **sempre superior** à desktop.

## Regra dos 5 Segundos

Toda tela deve ser compreendida em menos de 5 segundos após aberta. Caso
contrário, deve ser simplificada antes da homologação.

## Impactos

- Design de componentes reutilizáveis parte de tokens mobile.
- Auditorias trimestrais devem revalidar TODAS as rotas em viewport
  390×844 (iPhone 13/14/15 padrão).
- Débito técnico de qualquer tela desktop-first entra no roadmap com
  prioridade alta.

## Riscos Conhecidos

- Telas administrativas (gestão de usuários, catálogo) podem exigir esforço
  maior para caber em mobile — aceitável, mas nunca justificativa para
  abandonar a diretriz.

## Próximas Evoluções

- Auditoria automatizada de viewport via Playwright em CI.
- Guia visual de tokens mobile no repositório de design.