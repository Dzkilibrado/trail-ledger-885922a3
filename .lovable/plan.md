# TrailBook v1.2.1 — Saúde da Moto + Plano Editável + Integridade por Item

Escopo grande. Proponho dividir em 4 sub-fases sequenciais, cada uma homologável isoladamente. Isso reduz risco de regressão e mantém a filosofia de simplicidade (nenhuma tela nova cheia).

---

## Sub-fase A — Fundação de dados e integridade (backend + TIL)

**Objetivo:** garantir a regra crítica #8/#9/#10 antes de mexer em UI.

1. **Migration** em `maintenance_schedules`:
   - Novos status: `no_info`, `not_applicable`, `custom` (além de `active/ignored/snoozed` já existentes).
   - Colunas: `pinned boolean default false`, `sort_order int`, `hidden boolean default false`, `needs_review boolean default false`.
   - `initial_review_done_at timestamptz` na `motorcycles` (para fluxo #7).
2. **Migration** — trigger de auditoria em `maintenance_schedules` e `maintenance_items` gravando em `audit_log` (edição de intervalo, marcação de status, criação/remoção, vínculo/desvínculo de item).
3. **`src/lib/maintenance-catalog.ts`:** remover o fallback por nome canônico em `findSchedulesForCatalogItem` — passar a exigir vínculo explícito (`template_item_id` ou `scheduleId` selecionado). Sem vínculo → retorna `[]` e nenhum schedule é tocado (regra #10).
4. **`NewEventDialog`:** substituir "categoria + item do catálogo" por seleção obrigatória de **schedule(s) da moto** (multi-select "Adicionar outro item"). Se o item desejado não existe no plano, botão "Criar item personalizado agora" que insere um schedule antes de gravar.
5. **`activity-recalc.recomposeTimeline`:** já correto — apenas garantir que `recalcScheduleFromHistory` usa `maintenance_items.schedule_id` (vínculo explícito), nunca nome.

## Sub-fase B — Plano de manutenção editável item a item

**Objetivo:** #5, #6, #7.

1. **Novo componente `PlanItemEditor`** (Sheet mobile-first) — edita: nome, categoria, intervalos h/km/dias, última manutenção (data/h/km), severidade, observações, status. Ações: desativar / marcar sem informação / não aplicável / remover / duplicar.
2. **`ScheduleManager`** (Plano de Manutenção): trocar lista atual por cards agrupados por categoria, cada um com badge de status, botão "Editar" abrindo o `PlanItemEditor` e botão "Registrar manutenção" (abre `NewEventDialog` já pré-selecionado nesse schedule).
3. **Alerta moto usada** — Cockpit exibe widget "Revise o plano" quando `motorcycles.initial_review_done_at IS NULL` e `moto.hours_total > 0`. CTA abre um wizard leve (`InitialReviewSheet`) que percorre os schedules pedindo: última manutenção / sem info / novo / não aplicável.

## Sub-fase C — Saúde por componente + personalização

**Objetivo:** #1, #2, #3, #4, #12.

1. **TIL — `src/lib/til/component-health.ts`:** para cada schedule ativa da moto, snapshot `{scheduleId, name, category, status(traffic-light), remaining{h,km,d}, lastDoneAt, nextEstimatedAt, hasInfo}`. Fonte: `evaluateSchedule` já existente + flag `no_info`. Nenhum cálculo em componentes.
2. **`computeCockpitSnapshot`:** incluir `componentHealth: ComponentHealthSnapshot[]` e `healthPhrase` (recomendação inteligente: "Item que mais merece atenção: X", "N itens sem informação", etc.).
3. **Novo widget `ComponentHealthWidget`** no Cockpit: mostra 4 itens (fixados + top prioridade). Link "Ver todos" abre `MotoControlCenter` na aba **Saúde**.
4. **Nova aba "Saúde"** no Control Center: lista completa por categoria com traffic-lights. Cada card: score/status, restante, última, próxima, ações rápidas (Registrar / Inspecionar / Editar plano / Ver histórico).
5. **Personalização (#4):** `pinned`, `hidden`, `sort_order` persistidos em `maintenance_schedules`. UI: menu de contexto no card ("Fixar no cockpit / Ocultar / Restaurar padrão"). Reordenação apenas dos fixados (drag simples ou setas — mobile-first, setas ↑↓).
6. **Detalhe do item (#12):** rota `motorcycles.$id.control.item.$scheduleId.tsx` — histórico do item lendo `maintenance_items` daquele schedule + eventos vinculados; botões Registrar manutenção / Editar plano.

## Sub-fase D — Homologação completa

Executar via Playwright headless em mobile (390×844) e desktop, cobrindo os 22 itens da seção 16 do pedido. Retornar relatório item-a-item + evidências (screenshots) + typecheck.

---

## Detalhes técnicos-chave

- **Integridade por item (regra #8):** nenhuma manutenção grava em schedule sem `scheduleId` vindo de seleção explícita do usuário. `findSchedulesForCatalogItem` deixa de ser usada como fallback silencioso; passa a ser apenas helper de sugestão visível no UI ("encontramos programação: X — vincular?").
- **Atividade geral (#11):** `type ∈ {usage, incident, note, inspection}` nunca toca schedules mesmo que o usuário informe horímetro/KM — só atualiza timeline via `recomposeTimeline`.
- **Recomposição:** continua sendo o único caminho pós-mutação (ADR 0001). Nada muda aqui.
- **Auditoria:** trigger em SQL grava em `audit_log` com `actor = auth.uid()`, `entity = 'maintenance_schedule'|'maintenance_item'`, `action`, `before/after jsonb`.
- **Mobile-first:** todos os editores em `<Sheet>` (não `<Dialog>`), cards empilhados, botões ≥ 44px.

## Ordem de entrega e critérios de aprovação

Executarei **Sub-fase A → B → C → D em sequência, sem parar entre elas**, mas cada uma commitada logicamente. Ao final entrego o relatório de homologação dos 22 itens.

Alternativa se preferir: parar após cada sub-fase para você validar. Diga se prefere entrega contínua ou por sub-fase.

## Perguntas para confirmar antes de codar

1. **Ordem/atomicidade:** entrega contínua (A→B→C→D em um turno) **ou** parar após cada sub-fase para validação?
2. **Reordenação de fixados:** setas ↑↓ (simples, mobile-friendly) **ou** drag-and-drop (mais moderno, requer lib)? Recomendo setas.
3. **Wizard de revisão de moto usada** — obrigatório (bloqueia alertas até concluir) **ou** opt-in (banner dispensável)? Recomendo opt-in com banner persistente.
