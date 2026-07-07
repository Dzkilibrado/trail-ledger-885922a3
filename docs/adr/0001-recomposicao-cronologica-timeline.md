# ADR 0001 — Recomposição cronológica da timeline como padrão oficial

- **Status:** Aceita
- **Data:** 2026-07-07
- **Versão de entrega:** v1.1
- **Fase relacionada:** Fase 2 — Registro de Atividades + Integridade
- **Autores:** Equipe TrailBook

## 1. Objetivo da mudança

Garantir que o histórico de uso de cada motocicleta (horímetro, quilometragem, plano
de manutenção e índice de conservação) reflita sempre a realidade cronológica dos
eventos registrados, mesmo quando atividades passadas forem editadas, excluídas ou
inseridas fora de ordem.

## 2. Problema anterior

A Fase 2 inicial utilizava uma abordagem *best-effort*:

- Cada nova atividade acumulava `hours_delta` / `km_delta` sobre o total corrente da
  moto.
- `hours_at_event` e `km_at_event` eram escritos com o total **no momento do
  registro**, não com a posição cronológica real do evento.
- Edições e exclusões atualizavam apenas o total agregado da moto e, no caso de
  edições, gravavam `hours_at_event = hours_total_atual` — o que era incorreto para
  qualquer evento que não fosse o último cronologicamente.
- Além disso, `findSchedulesForCatalogItem` usava `String.includes()`, o que fazia
  uma manutenção (ex.: troca de óleo) atualizar indevidamente outros itens com
  nomes semelhantes (filtro, transmissão etc.).

Consequência: inconsistências históricas silenciosas, alertas indevidos e
dificuldade de auditar o estado real da moto em qualquer ponto do tempo.

## 3. Solução adotada

Introdução da função `recomposeTimeline(motoId)` em `src/lib/activity-recalc.ts`
como **padrão oficial** de reprocessamento:

1. Busca todos os eventos da moto ordenados por `occurred_at ASC, created_at ASC`.
2. Itera somando `hours_delta` / `km_delta` e **reescreve** `hours_at_event` e
   `km_at_event` de cada evento com a posição cronológica correta.
3. Atualiza `motorcycles.hours_total` e `motorcycles.km_total` com o total final.
4. Recalcula `last_done_hours` / `last_done_km` de cada item do plano de manutenção
   a partir do evento normalizado mais recente que referencia aquele item
   (correspondência **exata** por ID ou nome canônico do item — sem `includes`).

Toda operação de mutação de atividade (`insert`, `update`, `delete`) chama
`recomposeTimeline` ao final:

- `NewEventDialog` — após inserir um evento (inclusive retroativo).
- `EventActionsMenu` — após editar ou excluir um evento.
- `recalcAllForMotorcycle` — mantido como wrapper compatível que delega para
  `recomposeTimeline`.

Complementos:

- Registro por **leitura atual** de horímetro/KM passa a ser o modelo preferencial
  na UI (calcula `delta` automaticamente); o registro por incremento (`+horas / +KM`)
  fica como fallback de compatibilidade.
- Auditoria (`audit_log`) registra `insert`, `update` e `delete` com estado
  anterior e posterior.

## 4. Alternativas avaliadas

| Alternativa | Motivo da rejeição |
| --- | --- |
| Manter o modelo *best-effort* com correções pontuais | Não resolve edições retroativas nem exclusões; mantém risco de divergência silenciosa. |
| Recalcular apenas totais agregados da moto (sem reescrever `*_at_event`) | Deixa o histórico por evento incorreto, inviabilizando auditoria e gráficos temporais. |
| Snapshots imutáveis + tabela de "correções" | Complexidade alta, dupla fonte da verdade, difícil de auditar visualmente. |
| Trigger no banco (PL/pgSQL) para recomposição | Acoplamento forte ao banco, difícil de testar/evoluir e de versionar junto com regras de negócio da UI. |
| Event sourcing completo com projeções materializadas | Fora do escopo desta fase; custo/benefício desproporcional para o volume atual. |

## 5. Motivo da decisão

- Fonte única da verdade: os **eventos** são o registro canônico; snapshots e
  totais são derivados.
- Determinístico e auditável: qualquer estado pode ser reproduzido reexecutando
  `recomposeTimeline`.
- Simples de evoluir em TypeScript no mesmo módulo que já é usado pela UI.
- Correção imediata do bug de matching por `includes`, com correspondência estrita
  por item.

## 6. Impactos positivos

- Edição e exclusão de atividades passam a ser operações seguras.
- Horímetro/KM da moto refletem a posição cronológica real.
- Plano de manutenção nunca contamina itens vizinhos: cada item tem controle
  independente.
- Índice de conservação e agenda recalculam corretamente após qualquer mutação.
- Base sólida para relatórios históricos e gráficos temporais futuros.

## 7. Compatibilidade

- Dados existentes continuam válidos: `recomposeTimeline` recalcula a partir dos
  eventos já persistidos.
- API interna: `recalcAllForMotorcycle` foi preservada como wrapper para não
  quebrar chamadas existentes.
- UI: registro por incremento (`+horas / +KM`) continua disponível como fallback.
- Enum `control_type` ganhou o valor `not_informed` sem afetar registros
  anteriores.

## 8. Riscos conhecidos

- **Custo O(n)** por moto a cada mutação: aceitável para o volume atual; pode
  exigir otimização (recomposição incremental a partir do evento afetado) quando
  o histórico por moto crescer significativamente.
- **Concorrência**: mutações simultâneas na mesma moto podem gerar corrida na
  reescrita. Mitigar futuramente com lock otimista ou fila por moto.
- **Consistência transacional**: hoje a recomposição é feita em múltiplas
  chamadas ao banco; migrar para uma função SQL/transacional é uma evolução
  possível caso apareçam inconsistências parciais.
- Correspondência estrita por ID/nome canônico exige disciplina no catálogo —
  renomear um item exige migração explícita.

## 9. Próximas evoluções previstas

- Recomposição incremental (a partir do evento mais antigo afetado) para reduzir
  custo em históricos longos.
- Lock/serialização por moto para mutações concorrentes.
- Testes automatizados de cenários cronológicos (inserção retroativa, edição de
  evento intermediário, exclusão do primeiro/último evento).
- Visualização gráfica da timeline reconstruída (dashboard por moto).
- Exportação/relatório PDF do histórico consolidado.

## 10. Princípios oficiais decorrentes desta ADR

Estes princípios passam a ser **normativos** para o TrailBook e devem ser
respeitados por qualquer evolução futura:

1. A **recomposição cronológica da timeline** é o padrão oficial de cálculo do
   estado de uma motocicleta.
2. Toda **edição ou exclusão** de atividade **obrigatoriamente** dispara a
   recomposição completa da linha do tempo da moto afetada.
3. Os **snapshots** de horímetro e quilometragem por evento representam a
   **posição cronológica real** da moto naquele instante — nunca o total corrente
   no momento do registro.
4. Cada item do **plano de manutenção** possui **controle independente**;
   nenhuma manutenção pode replicar informação para outros itens, e o matching
   entre evento e item é sempre estrito (ID ou nome canônico).
5. O registro por **leitura atual** de horímetro/KM é o modelo **preferencial**
   de entrada; o lançamento por incremento existe apenas por compatibilidade.

## 11. Referências

- `.lovable/plan.md` — Fase 1 e Fase 2 homologadas (v1.1).
- `src/lib/activity-recalc.ts` — implementação de `recomposeTimeline`.
- `src/lib/maintenance-catalog.ts` — matching estrito de itens do plano.
- `src/components/NewEventDialog.tsx` — registro por leitura atual.
- `src/components/EventActionsMenu.tsx` — edição e exclusão com recomposição.
- Migração: adição de `not_informed` ao enum `control_type`.