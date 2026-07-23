# Evolução: MotorcycleReviewState

Consolidar a comunicação sobre a "revisão inicial" em um único estado
oficial, reutilizável por Dashboard, Cockpit, Passaporte, Saúde,
Agenda, Notificações e futuras integrações. Nenhuma mudança em
`evaluateSchedule`, TIL, recomposição, baseline ou fonte única — apenas
camada de comunicação.

## 1. Arquitetura

Nova camada isolada em `src/lib/review-state/`:

```text
src/lib/review-state/
  types.ts        enum + payloads + mensagens oficiais
  compute.ts      função pura computeReviewState(moto, schedules)
  index.ts        barrel
```

Regra: nada dentro dessa camada consulta banco. Recebe objetos já
carregados pelas telas (mesmo padrão da TIL). A TIL não é alterada — a
nova camada apenas *lê* moto + schedules e devolve um snapshot próprio.

## 2. Enum e snapshot

```ts
export type MotorcycleReviewState =
  | "unknown"
  | "baseline_only"
  | "partially_reviewed"
  | "fully_reviewed";

export interface ReviewStateSnapshot {
  state: MotorcycleReviewState;
  isPending: boolean;          // unknown | baseline_only | partially_reviewed
  isComplete: boolean;         // fully_reviewed
  confirmedCount: number;      // schedules com last_done_*
  totalCount: number;
  remainingCount: number;
  tone: "info" | "attention" | "good";
  title: string;               // curto (chip/badge)
  message: string;             // frase longa (card)
  cta: string | null;          // ex.: "Revisar agora"
}
```

## 3. Regras de transição (determinísticas)

Entradas consideradas:
- `moto.initial_review_done_at`
- `moto.condition`, `hours_initial`, `km_initial`
- `schedules[].last_done_at | last_done_hours | last_done_km`

Ordem de decisão:

1. `initial_review_done_at` presente -> `fully_reviewed`.
2. Moto **não** é usada (sem baseline e `condition !== "used"`) e nenhum
   schedule confirmado -> `unknown`.
3. Moto usada, `confirmedCount === 0` -> `baseline_only`.
4. `confirmedCount > 0` e `< totalCount` -> `partially_reviewed`.
5. `confirmedCount === totalCount && totalCount > 0` mas
   `initial_review_done_at` ainda nulo -> `partially_reviewed` (só vira
   `fully_reviewed` quando o marcador oficial é gravado pelo fluxo de
   conclusão — mantém consistência com a lógica já homologada).

Tons e CTAs por estado:
- `unknown` -> info, sem CTA.
- `baseline_only` -> attention, CTA "Revisar agora".
- `partially_reviewed` -> attention, CTA "Continuar revisão".
- `fully_reviewed` -> good, sem CTA.

## 4. Mensagens oficiais

Definidas em `types.ts` (fonte única — evita textos soltos):

- unknown: "Aguardando informações iniciais."
- baseline_only: "Estamos utilizando as horas e quilômetros informados
  no cadastro como ponto inicial do acompanhamento. Recomendamos
  confirmar a revisão inicial da motocicleta para que o histórico
  reflita o estado físico dos componentes."
- partially_reviewed: "Parte da revisão inicial já foi registrada.
  Ainda existem N componentes sem confirmação." (N interpolado)
- fully_reviewed: "Revisão inicial concluída. A partir deste momento o
  TrailBook acompanhará automaticamente os próximos vencimentos e o
  histórico de manutenção."

## 5. Retrocompatibilidade

`needsInitialReview()` continua exportado de
`InitialReviewPendingCard.tsx` e passa a ser um wrapper:

```ts
export const needsInitialReview = (m) =>
  computeReviewState({ moto: m, schedules: [] }).isPending
    && computeReviewState({ moto: m, schedules: [] }).state !== "unknown";
```

Nada quebra nas telas atuais; elas migram gradualmente.

## 6. Telas que passam a consumir o novo estado

- **Dashboard** (`routes/_authenticated/dashboard.tsx`): substitui a
  chamada direta a `needsInitialReview` por `computeReviewState` (usa
  schedules já carregados via `useMotorcycleEvidence`); renderiza o
  card âmbar quando `isPending`. "Tudo em dia" só quando `isComplete`
  e sem pendências.
- **Cockpit** (`components/cockpit/Cockpit.tsx` + `greeting.ts`):
  saudação usa `state` em vez do IF ad-hoc atual — mantém a mesma
  frase para `baseline_only`/`partially_reviewed`.
- **NextActionWidget**: quando `isPending`, `label`/`reason` vêm do
  snapshot em vez de string local.
- **Passaporte** (`motorcycles.$id.passport.tsx`): novo chip
  "Status do acompanhamento" com `title` do snapshot (transparência,
  não afeta selos).
- **Saúde** (`components/HealthPanel.tsx` ou `health/HealthOverview`):
  faixa informativa discreta quando `isPending`, com o texto
  "Indicadores calculados utilizando baseline informada no cadastro."
  Sem alterar notas/cores.
- **Agenda**: chip discreto no topo quando `isPending` (opcional,
  mesmo componente reutilizado).

Componente compartilhado novo:
`src/components/review-state/ReviewStateBadge.tsx` (chip) e
`ReviewStateNotice.tsx` (faixa informativa). Ambos consomem o
snapshot — zero lógica local.

## 7. Experiência após conclusão

No `InitialReviewSheet`, após `finish()` bem-sucedido e invalidação
das queries, abrir um `TBDialog` de sucesso:

- Título: "Revisão inicial concluída"
- Texto: mensagem oficial de `fully_reviewed`.
- Botão único: "Continuar" (fecha o dialog e o sheet).

Fluxo garante o princípio "Sucesso após sincronia" (ADR 0011): dialog
só abre depois do `await queryClient.invalidateQueries` das chaves
`motorcycle`, `schedules`, `events`.

## 8. Preparação para notificações futuras

`ReviewStateSnapshot` exporta `state`, `remainingCount` e `isPending`
— suficiente para futuras notificações ("Restam 3 componentes") sem
alterar a camada. Nenhuma notificação é criada agora.

## 9. Garantias

- Nenhuma alteração em: `evaluateSchedule`, `src/lib/til/*`,
  `activity-recalc`, `maintenance-engine`, RPCs, triggers, políticas.
- `needsInitialReview` continua funcionando (wrapper).
- Textos centralizados em um único arquivo (`types.ts`).
- Snapshot é função pura -> fácil de testar.

## 10. Entregáveis

1. `src/lib/review-state/{types,compute,index}.ts`
2. `src/components/review-state/{ReviewStateBadge,ReviewStateNotice}.tsx`
3. Dialog de sucesso em `InitialReviewSheet.tsx`
4. Migração de: Dashboard, Cockpit/greeting, NextActionWidget,
   Passaporte, Painel de Saúde
5. `needsInitialReview` convertido em wrapper
6. Atualização do CHANGELOG e do ADR (novo ADR curto "Estado oficial
   de revisão da motocicleta")

## Detalhes técnicos

- `computeReviewState` recebe `{ moto, schedules }` para evitar
  refetch; telas que já usam `useMotorcycleEvidence` reaproveitam.
- Um hook fino `useReviewState(motoId)` pode ser adicionado como
  atalho, apoiado em `useMotorcycleEvidence` (sem nova query).
- Dialog de sucesso usa `TBDialog` existente (respeita design system).
- Nenhum campo novo no banco.
