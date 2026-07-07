# TrailBook Design System — v1.3.0

Transformar a padronização de formulários em um Design System oficial e reutilizável, implantado de forma **incremental por área**, sem refatoração massiva. Objetivo: qualquer nova tela do TrailBook nasce usando os mesmos componentes, com identidade visual única e ergonomia Mobile Native First.

---

## Pilares

1. **Mobile Native First** — todo componente nasce no viewport 390×844, depois escala.
2. **TIL continua sendo a única fonte de lógica** — o DS é 100% presentational.
3. **shadcn como base** — não recriar primitivos, apenas encapsular em padrões TrailBook.
4. **Tokens semânticos** — nada de cores hardcoded; tudo via `src/styles.css`.
5. **Um componente = um padrão** — proibido variação isolada em telas.

---

## Estrutura de arquivos

```text
src/design-system/
├── tokens/                    # documentação viva dos tokens (MD)
│   └── README.md              # espaçamentos, alturas, área de toque, tipografia
├── primitives/                # blocos atômicos (envolvem shadcn)
│   ├── TBButton.tsx
│   ├── TBInput.tsx
│   ├── TBSelect.tsx
│   ├── TBTextarea.tsx
│   ├── TBBadge.tsx
│   ├── TBChip.tsx
│   └── TBIcon.tsx
├── inputs/                    # inputs especializados TrailBook
│   ├── TBNumberInput.tsx
│   ├── TBCurrencyInput.tsx
│   ├── TBDateInput.tsx
│   ├── TBHourmeterInput.tsx  # horímetro (H) c/ decimal
│   ├── TBOdometerInput.tsx   # KM
│   └── TBSearchInput.tsx
├── forms/
│   ├── TBFormField.tsx       # label + input + hint + erro (o "F" atual, oficial)
│   ├── TBFormGrid.tsx        # grid 2/4 col mobile-first, items-end
│   ├── TBFormSection.tsx     # título + descrição + slot
│   └── TBFormActions.tsx     # rodapé sticky mobile c/ CTA principal
├── layout/
│   ├── TBPageHeader.tsx      # título, subtítulo, ações
│   ├── TBSectionHeader.tsx
│   ├── TBCard.tsx            # base
│   ├── TBStatusCard.tsx      # com severidade (excelente/boa/atenção/crítica)
│   ├── TBInfoCard.tsx
│   ├── TBActionCard.tsx      # tap-target grande, mobile
│   ├── TBKpiCard.tsx
│   └── TBTimelineItem.tsx
├── overlays/
│   ├── TBDrawer.tsx          # side drawer desktop
│   ├── TBBottomSheet.tsx     # mobile-first (usar em vez de Dialog no mobile)
│   └── TBDialog.tsx          # apenas para confirmações curtas
├── feedback/
│   ├── TBEmptyState.tsx
│   ├── TBLoadingState.tsx    # skeleton + spinner variants
│   ├── TBErrorState.tsx
│   ├── TBSuccessState.tsx
│   ├── TBInfoState.tsx
│   └── TBWarningState.tsx
├── filters/
│   ├── TBFilterBar.tsx
│   └── TBFilterChip.tsx
└── index.ts                   # barrel export único: import { TBFormField } from '@/design-system'
```

Regra: nenhuma tela importa de `src/components/ui/*` diretamente para os padrões acima — sempre via `@/design-system`.

---

## Tokens oficiais (documentados em `tokens/README.md`)

- **Espaçamento base**: 4px. Escala: 4, 8, 12, 16, 20, 24, 32, 48.
- **Grid formulário mobile**: `grid-cols-2 gap-x-3 gap-y-3 items-end`; desktop `sm:grid-cols-4`.
- **Altura de campo**: 44px (mobile), 40px (desktop compacto).
- **Altura mínima de botão**: 44px (área de toque iOS/Android).
- **Área de toque mínima**: 44×44px.
- **Label**: `text-[11px] uppercase tracking-widest text-muted-foreground`, `min-h-[1rem] truncate`.
- **Título de página**: `text-2xl font-black`.
- **Título de seção**: `text-lg font-semibold`.
- **Subtítulo**: `text-sm text-muted-foreground leading-relaxed`.
- **Radius**: `rounded-2xl` cards, `rounded-xl` inputs, `rounded-full` chips/badges.
- **Cores**: 100% via tokens já definidos em `src/styles.css` (nenhum hardcode).
- **Ícones**: lucide-react, tamanho padrão 20px em botões, 16px em chips, 24px em headers.

Estados semânticos (badges/cards): `excelente`, `boa`, `atencao`, `critica`, `info`, `neutro` — mapeados 1:1 com a severidade da TIL.

---

## Fase 1 — Fundação (sem tocar telas)

1. Criar árvore `src/design-system/` + `index.ts`.
2. Extrair `F` (do `NewEventDialog`) como `TBFormField` oficial.
3. Escrever `tokens/README.md` com os padrões acima.
4. Criar primitivos e inputs especializados listados na árvore.
5. Criar overlays (`TBBottomSheet` prioritário — mobile).
6. Criar estados de feedback (`TBEmptyState`, `TBLoadingState`, `TBErrorState`).
7. `tsgo` limpo; nenhum consumidor ainda.

**Homologação**: revisão visual dos componentes em página de sandbox interna (não publicada).

---

## Fase 2 — Migração incremental (uma área por PR)

Ordem por impacto de UX (do mais crítico ao menos):

1. **NewEventDialog** (form principal — piloto da migração).
2. **Cockpit** (headers, KPIs, StatusCards).
3. **Saúde da Moto** + ComponentSheet.
4. **Plano de manutenção** (formulários de edição).
5. **Cadastro de moto** + edição.
6. **Timeline / detalhes de atividade**.
7. **Documentos, chamados**.
8. **Admin** (menor prioridade UX).

Para cada área: migrar → validar mobile 390 + desktop → homologar com o usuário → seguir.

---

## Fase 3 — Governança

- ADR **0005 — Design System TrailBook**: registra pilares, tokens, regra "não importar shadcn direto".
- `.lovable/plan.md`: adicionar seção "Design System v1.3.0" com status por área.
- Memória do projeto: regra permanente "novas telas usam `@/design-system`".

---

## Fora de escopo

- Não alterar lógica de negócio, TIL ou schema.
- Não redesenhar identidade visual (cores, tipografia já aprovadas ficam).
- Não migrar tudo em uma tacada — cada área é um passo aprovado.

---

## Entregável desta primeira rodada

Apenas a **Fase 1 (Fundação)**. Ao final, retorno com:
- árvore criada;
- lista de componentes prontos;
- link para `tokens/README.md`;
- typecheck limpo;
- proposta da primeira área para migrar na Fase 2 (sugestão: `NewEventDialog`).

Confirma que posso iniciar pela Fase 1?
