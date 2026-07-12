---
name: Padrão oficial de Help Tooltips
description: Como e onde aplicar HelpTooltip no TrailBook; componente único, registry único, comportamento mobile-safe.
type: preference
---

## Regra

- Componente único: `src/components/HelpTooltip.tsx`.
- Textos: SEMPRE via registry `HELP` em `src/lib/help/texts.ts`.
- Nunca criar variantes paralelas em outros módulos.

## Onde aplicar (Fase UX v1.5.1)

Dashboard (Atalhos, banner de origem), Central da Moto (Selos via
`BadgeSection`), Passaporte (Passaporte, Compartilhar, Pendências,
Selo Certified, Histórico, Saúde, Linha do tempo), Documentos
(Central de Documentos), Recibo (Fluxo, Comprador TB, Comprador
externo), Cadastro (CPF, Celular, WhatsApp, Estado/Cidade). Selos
individuais: cobertos pelo `BadgeTooltip` de cada chip.

## Como aplicar

**How to apply:** ao introduzir um termo novo, decidir entre
(a) renomear para algo óbvio, ou (b) adicionar `HelpTooltip`
importando `HELP` do registry. Nunca escrever texto inline no JSX.

## Comportamento obrigatório

- Popover (funciona em toque), não Tooltip puro.
- `collisionPadding: 8` — nunca sai da viewport.
- `w-[min(18rem,calc(100vw-1rem))]` — sempre cabe na tela.
- Fecha com toque fora, Esc ou novo toque no ícone.
- Foco visível para acessibilidade; respeita claro/escuro.

**Why:** princípio "descoberta em um toque" (ADR 0009). FAQ e
suporte são complementos, não a primeira porta.

## Reservado

"Verificado pelo TrailBook" fica reservado para curadoria oficial em
fase futura — não implementar autoconquista.

## Referência

- ADR 0009 (`docs/adr/0009-help-tooltips-e-descoberta.md`).
- ADR 0008 — etapa Comunicação verifica tooltips.