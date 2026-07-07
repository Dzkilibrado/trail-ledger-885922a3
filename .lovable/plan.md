
# Sub-fase B — Plano de Manutenção Editável

Aplicando as diretrizes que você acabou de aprovar. A palavra "plano" deixa de ser a porta de entrada: o usuário edita **componentes da moto**. O plano existe internamente, mas some do vocabulário da UX.

## 1. Nova experiência: Componentes, não "itens do plano"

Substituir o `ScheduleManager` (dialog "Plano de manutenção") por uma tela/aba **"Componentes"** dentro do Centro de Controle, agrupada por categoria.

```text
Motor
  ├─ 🛢  Óleo do motor        [em dia · faltam 8h]
  └─ 🌬  Filtro de ar          [atenção · faltam 200 km]
Freios
  └─ 🛑  Pastilhas dianteiras  [sem informação]
Suspensão
  └─ ⛓  Corrente               [vencido há 300 km]
```

- Cada linha é um **card de componente** com: ícone, nome, categoria, status (badge colorido), próxima ação (frase única vinda da TIL).
- Toque no card abre o **ComponentSheet** (Sheet mobile-first).
- Sem menções a "programação" ou "item do plano" na UI. Termos: **Componente**, **Manutenção**, **Histórico**.

## 2. ComponentSheet — identidade própria do componente

Um único Sheet (mobile-first, também usado no desktop) contendo:

- Cabeçalho: ícone grande, nome, categoria, badge de status.
- **Estado atual** (single-line phrase da TIL): "Faltam 8 h" / "Vencido há 300 km" / "Sem informação".
- **Última manutenção**: data, horímetro/km, oficina/observação (se houver).
- **Próxima prevista**: horas restantes, dias restantes, km restantes (o que se aplicar).
- **Histórico** deste componente: lista dos `maintenance_items` vinculados via `schedule_id`, ordenados por `occurred_at`.
- **Observações** (campo `notes` do schedule).
- Ações:
  - `Registrar manutenção` → abre `NewEventDialog` com o schedule já pré-selecionado.
  - `Editar componente` → abre `ComponentEditor` (nome, categoria, intervalos, severidade, fixar, ocultar).
  - `Marcar como não se aplica` / `Restaurar` (usa `status='not_applicable'`).

O ComponentEditor **é** o antigo "PlanItemEditor", mas nunca é apresentado como "editar plano".

## 3. Arquitetura preparada para crescer (sem implementar agora)

O `ComponentSheet` já reserva slots visualmente vazios (não renderizados quando sem dados) para futuras seções: manual técnico, torque recomendado, capacidade de óleo, fotos, vídeos, dicas, observações do fabricante. A camada de dados fica pronta via campos JSON já existentes no schedule (`notes`) + futuros JSONs em `maintenance_plan_items`; nenhuma coluna nova nesta sub-fase.

## 4. Wizard "Você comprou uma moto usada?" — formato entrevista

Substituir a página `/motorcycles/$id/plan?first=true` por um **InitialReviewSheet** conversacional:

```text
Passo 3 de 12

🛢  Óleo do motor

Você sabe quando foi trocado pela última vez?

  [ Sei informar ]   [ Não sei ]   [ Não se aplica ]
```

- **Sei informar** → mini-form (data, horímetro/km opcionais) → próximo componente.
- **Não sei** → grava `status='no_info'`, sem alerta futuro.
- **Não se aplica** → `status='not_applicable'`, some do cockpit.
- Progresso visual no topo. Botão "Terminar depois" a qualquer momento.
- No fim: atualiza `motorcycles.initial_review_done_at = now()`, dispara `recomposeTimeline`, some o banner "Ajuste o plano".

Opt-in (banner persistente na Cockpit até concluído), conforme decidido.

## 5. Facade TIL — nada calculado nas telas

Adicionar em `src/lib/til/`:

- `components.ts` — `computeComponentView(schedule, statuses, events)` retornando:
  ```ts
  { id, name, category, icon, statusTone, statusLabel,
    lastMaintenance: { date, hours, km, note } | null,
    nextPrevision: { hoursLeft, kmLeft, daysLeft } | null,
    history: Array<{ eventId, date, hours, km, note }> }
  ```
- `computeCockpitSnapshot` ganha `components: ComponentView[]` já ordenado por prioridade: **críticos → próximos → em dia → sem informação → não se aplica**.
- Nenhum componente de UI faz cálculo — só lê o snapshot.

Sub-fase C só consumirá esses dados.

## 6. Reordenação e personalização (mínima)

Conforme sua diretriz, o `ComponentEditor` expõe apenas:

- **Fixar componente** (`pinned=true`).
- **Ocultar componente** (`hidden=true`).
- **Restaurar padrão** (limpa `pinned/hidden/sort_order`).

Ordenação dentro do card usa `pinned` primeiro, depois prioridade da TIL. Sem drag-and-drop, sem `↑↓` explícitos (fica automático pela criticidade).

## 7. NewEventDialog

Já ajustado na Sub-fase A. Nesta sub-fase apenas:

- Aceita `defaultScheduleIds` (quando aberto a partir de um ComponentSheet).
- Rótulo do bloco: **"Componentes afetados por esta manutenção"** (em vez de "itens do plano").

## 8. Rotas e navegação

- Nova aba/link no `MotoControlCenter`: **"Componentes"** (substitui o botão "Plano de manutenção" + "Plano sugerido"; ambos removidos do rodapé de ações).
- Rota nova (opcional para deep-link): `/_authenticated/motorcycles.$id.components.tsx` — lista completa. Cockpit continua mostrando só os prioritários.
- Rota `/_authenticated/motorcycles.$id.plan.tsx` fica só como redirect para `.../components` (compatibilidade).

## 9. Arquivos a criar / alterar

**Criar**
- `src/lib/til/components.ts`
- `src/components/components/ComponentCard.tsx`
- `src/components/components/ComponentSheet.tsx`
- `src/components/components/ComponentEditor.tsx`
- `src/components/components/ComponentsList.tsx` (agrupamento por categoria)
- `src/components/onboarding/InitialReviewSheet.tsx`
- `src/routes/_authenticated/motorcycles.$id.components.tsx`

**Alterar**
- `src/lib/til/index.ts` + `types.ts` — expor `components`.
- `src/components/MotoControlCenter.tsx` — trocar botões, embutir `<ComponentsList/>`, banner de moto usada abre `InitialReviewSheet`.
- `src/components/cockpit/Cockpit.tsx` — link "Ver componentes" além de "Abrir Centro de Controle".
- `src/components/NewEventDialog.tsx` — renomear rótulo + prop `defaultScheduleIds`.
- `src/routes/_authenticated/motorcycles.$id.plan.tsx` — redirect.

**Remover da UX**
- `ScheduleManager` deixa de ser exposto (arquivo mantido temporariamente para não quebrar imports, mas sem trigger). Removido de vez na Sub-fase D após homologação.

## 10. Regra permanente aplicada

Toda label, badge e frase do `ComponentSheet` responde a "o que preciso fazer agora?": nada de intervalo bruto ("500h a cada"), sempre o restante em linguagem humana ("Faltam 8 h"), com CTA correspondente.

## 11. Homologação (interna, antes da Sub-fase C)

- Typecheck limpo.
- Console limpo.
- Fluxo mobile: abrir moto → ver componentes prioritários → tocar em óleo → registrar manutenção → estado atualiza.
- Wizard entrevista: cobre todos os schedules, sem obrigar preenchimento, marca `initial_review_done_at` no fim.
- Nenhum texto da UI menciona "plano" / "programação" / "item do plano".

Ao aprovar este plano, executo tudo em sequência num único lote e devolvo o resumo.
