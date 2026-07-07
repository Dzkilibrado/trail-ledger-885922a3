# Fase 3 (v1.2) — TrailBook Cockpit + TrailBook Intelligence Layer (TIL)

Filosofia gravada em `mem://index.md` (Core) e ADR 0002 registrada. Este plano executa a nova arquitetura respeitando: mobile-first, Regra dos 30s, telas não calculam, personalização mínima.

> **Status:** Implementação concluída — aguardando homologação do usuário.
> Fase 1 (v1.0) e Fase 2 (v1.1) foram homologadas em rodadas anteriores; ver ADR 0001.

## 0. Entrega

Arquivos criados/alterados nesta rodada:

**TIL — `src/lib/til/`**
- `types.ts` — tipos do `CockpitSnapshot`.
- `health.ts` — score + frase única + tom (reutiliza `computeConservation`).
- `schedule.ts` — statuses via `priorityList` + próxima manutenção.
- `usage.ts` — horímetro/KM/última atividade/investido.
- `alerts.ts` — próximo alerta priorizado.
- `suggestions.ts` — `NextAction` (revisar plano, registrar manutenção, registrar atividade…).
- `index.ts` — fachada `computeCockpitSnapshot()`.

**Cockpit — `src/components/cockpit/`**
- `Cockpit.tsx` — layout mobile-first `max-w-2xl`, carrega dados e consulta a TIL.
- `widgets/HealthHeroWidget.tsx` — cartão-herói: score + frase + próxima manutenção.
- `widgets/QuickStatsWidget.tsx` — última atividade · horímetro · KM · próximo alerta.
- `widgets/NextActionWidget.tsx` — CTA único, contextual, aparece só se houver ação.

**Rotas**
- `src/routes/_authenticated/motorcycles.$id.tsx` — agora é layout `<Outlet/>`.
- `src/routes/_authenticated/motorcycles.$id.index.tsx` — `/motorcycles/$id` → Cockpit.
- `src/routes/_authenticated/motorcycles.$id.control.tsx` — `/motorcycles/$id/control` → Centro de Controle (detalhes completos preservados).
- `src/components/MotoControlCenter.tsx` — todo o conteúdo detalhado anterior extraído em componente reutilizável.

## 1. Escopo desta entrega

- Criar a **TIL** (`src/lib/til/`) como fonte única de cálculos.
- Substituir a tela de detalhe da moto pelo **Cockpit** enxuto.
- Mover o conteúdo detalhado atual para o **Centro de Controle** (tabs internas: Saúde, Manutenção, Agenda, Histórico, Documentação, Custos, Alertas).
- Personalização mínima: fixar favoritos, ocultar painel, restaurar padrão.
- Homologação (checklist da mensagem).

Fora de escopo: novos widgets (Oficina, Eventos, Seguro, IA), IA preditiva, push notifications.

## 2. Arquitetura

### 2.1 TIL — `src/lib/til/`

```text
src/lib/til/
  index.ts          getCockpit(motoId) → CockpitSnapshot
  types.ts          CockpitSnapshot, HealthStatus, NextAction, Alert, ...
  health.ts         computeHealth(moto, schedules, events) → { score, label }
  schedule.ts       computeSchedule(...)  → { next, upcoming, overdue }
  alerts.ts         computeAlerts(...)    → Alert[] priorizados
  usage.ts          computeUsage(...)     → { hoursTotal, kmTotal, lastEvent }
  costs.ts          computeCosts(...)     → { total, byCategory, byPeriod }
  suggestions.ts    computeNextAction(...) → NextAction | null
```

- Funções **puras**: recebem dados já carregados, retornam snapshot tipado.
- `getCockpit(motoId)` orquestra queries via TanStack Query (loader) e retorna o snapshot completo. Componentes só leem.
- 100% testável isoladamente.

### 2.2 Cockpit — `src/components/cockpit/`

```text
src/components/cockpit/
  Cockpit.tsx                    layout principal
  ControlCenter.tsx              tabs: Saúde/Manutenção/Agenda/Histórico/Doc/Custos/Alertas
  registry.ts                    registro de widgets
  widgets/
    HealthHeroWidget.tsx         cartão-herói: saúde + próxima manutenção + CTA
    QuickStatsWidget.tsx         última atividade · horímetro · KM · próximo alerta
    NextActionWidget.tsx         CTA contextual (aparece só se houver ação)
```

- Widget = `(snapshot) => JSX`. Sem fetch, sem cálculo.
- Mobile-first (375px): stack vertical, tipografia grande, áreas de toque ≥ 48px.
- Desktop: container centralizado max-w-2xl — sem virar dashboard largo.

### 2.3 Rotas

- `/_authenticated/motorcycles/$id` → **Cockpit** (novo padrão).
- `/_authenticated/motorcycles/$id/control` → Centro de Controle (tabs).
- Rotas antigas de plano/etc migram para tabs do Centro de Controle preservando URLs quando possível.

## 3. Passos de implementação

1. **TIL base**: criar `src/lib/til/*` com tipos e funções puras. Reutilizar `activity-recalc` e `maintenance-catalog` já existentes. Retornar snapshot.
2. **Loader/hook**: `useCockpit(motoId)` via TanStack Query + `ensureQueryData` no loader.
3. **HealthHeroWidget**: hierarquia visual clara (score grande, frase única, CTA único).
4. **QuickStatsWidget**: 4 métricas em linha (mobile: 2x2, desktop: 1x4).
5. **NextActionWidget**: renderiza apenas se `snapshot.nextAction` existir.
6. **Cockpit.tsx**: compõe os 3 widgets acima, sem mais nada.
7. **ControlCenter.tsx**: tabs internas (shadcn Tabs) preservando conteúdo atual da tela de detalhe.
8. **Migração da rota** `/motorcycles/$id`: passa a renderizar `Cockpit`. Conteúdo antigo vai para `.../control`.
9. **Personalização mínima**: menu com "Fixar favorito", "Ocultar painel", "Restaurar padrão" persistido em `localStorage` por moto.
10. **Homologação**: rodar `tsgo`, verificar console, Playwright em 375px e desktop, validar checklist.

## 4. Design tokens

- Nenhuma cor nova hardcoded. Usar semantic tokens já existentes (`--primary`, `--muted`, etc.).
- Muito espaço em branco: padding generoso, hierarquia por tamanho de fonte, não por cor.
- Máximo 1 cor de destaque por tela (o CTA principal).

## 5. Homologação (checklist oficial)

- ✓ Interface continua simples (≤ 3 blocos no Cockpit).
- ✓ Poucos elementos visuais.
- ✓ Nenhuma informação duplicada entre Cockpit e Centro de Controle.
- ✓ Mobile confortável (375px, áreas de toque ≥ 48px, sem scroll horizontal).
- ✓ Desktop organizado (container centrado, sem virar dashboard).
- ✓ Performance preservada (snapshot memoizado via TanStack Query).
- ✓ Console limpo.
- ✓ `tsgo --noEmit` limpo.
- ✓ Regra dos 30s validada num cenário real.

## 6. Riscos / mitigações

- **Regressão de informação**: Centro de Controle preserva 100% do detalhe atual.
- **Tentação de reintroduzir cards**: filtro obrigatório "isso simplifica?" antes de qualquer adição.
- **Custo de cálculo**: TIL memoizada por moto; recomposição já é O(n) em eventos.

## 7. Entregáveis

- `src/lib/til/*` (7 arquivos).
- `src/components/cockpit/*` + widgets (5 arquivos).
- Rota `.../control` com tabs.
- Rota `$id` renderizando o Cockpit.
- Atualização de `.lovable/plan.md` com Fase 3.
- Homologação registrada.

Confirmar para eu iniciar a implementação exatamente nesta ordem.