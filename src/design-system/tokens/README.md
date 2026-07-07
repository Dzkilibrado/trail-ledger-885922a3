# TrailBook Design Tokens

Fonte oficial dos padrões visuais do TrailBook.
Toda tela nova **deve** consumir os componentes de `@/design-system`.
Nenhum consumidor pode reimportar `@/components/ui/*` para reproduzir os padrões abaixo.

## Filosofia

- **Mobile Native First**: cada componente é desenhado no viewport 390×844 e depois escala.
- **Sem lógica**: o Design System é 100% presentational. Toda regra de negócio vive na TIL.
- **Tokens semânticos**: cores/gradientes/sombras via `src/styles.css` — nunca hex hardcoded.

## Espaçamento

Base 4px. Escala em Tailwind: `1, 2, 3, 4, 5, 6, 8, 12` → 4, 8, 12, 16, 20, 24, 32, 48px.

- Espaço entre campos de formulário: `gap-x-3 gap-y-3` (12px).
- Espaço entre seções: `space-y-6` (24px).
- Padding de card: `p-4 sm:p-5`.
- Padding de página mobile: `px-4 py-5`.

## Grid de formulário

```tsx
<TBFormGrid> {/* grid-cols-2 items-end gap-x-3 gap-y-3 sm:grid-cols-4 */}
  <TBFormField label="Horímetro (h)">...</TBFormField>
  ...
</TBFormGrid>
```

Regras:
- `items-end` garante alinhamento dos inputs mesmo se um label quebrar.
- Labels: `min-h-[1rem] truncate` — nunca quebram em duas linhas.
- Mobile 2 colunas, desktop 4 colunas.

## Alturas e área de toque

- **Input**: 44px (mobile), 40px (desktop).
- **Botão**: mínimo 44px de altura.
- **Alvo de toque**: mínimo 44×44px em qualquer elemento clicável.

## Tipografia

| Elemento          | Classe Tailwind                                                                 |
| ----------------- | ------------------------------------------------------------------------------- |
| Título de página  | `text-2xl font-black`                                                           |
| Título de seção   | `text-lg font-semibold`                                                         |
| Subtítulo         | `text-sm text-muted-foreground leading-relaxed`                                 |
| Label de campo    | `text-[11px] uppercase tracking-widest text-muted-foreground min-h-[1rem] truncate` |
| Texto de apoio    | `text-xs text-muted-foreground leading-relaxed`                                 |

## Raio de borda

- Cards: `rounded-2xl`
- Inputs / botões: `rounded-xl`
- Chips / badges: `rounded-full`

## Ícones (lucide-react)

- Em botão: 20px (`h-5 w-5`)
- Em chip: 16px (`h-4 w-4`)
- Em header: 24px (`h-6 w-6`)

## Severidade (TIL)

Estados semânticos mapeados 1:1 com a Saúde da Moto:

| Token       | Uso                                    |
| ----------- | -------------------------------------- |
| `excelente` | verde forte                            |
| `boa`       | verde suave                            |
| `atencao`   | âmbar                                  |
| `critica`   | vermelho                               |
| `info`      | azul (mensagens informativas)          |
| `neutro`    | cinza (sem informação / desativado)    |

## Overlays — quando usar cada um

- `TBBottomSheet` — **padrão no mobile** para qualquer conteúdo denso (formulários, detalhes).
- `TBDrawer` — desktop lateral (navegação secundária, filtros longos).
- `TBDialog` — apenas confirmações curtas (uma pergunta + 2 botões).

## Estados obrigatórios

Toda tela que carrega dados deve tratar:

- `TBLoadingState` — enquanto carrega.
- `TBEmptyState` — quando não há registros.
- `TBErrorState` — quando algo falha (com botão de retry).
- `TBSuccessState` / `TBInfoState` / `TBWarningState` — feedback pontual.

## Migração

A adoção é **incremental por área**, começando por `NewEventDialog` (piloto).
Ver `.lovable/plan.md` para o status por área.