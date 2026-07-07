# TrailBook v1.2.1 — Plano de Manutenção Editável + Saúde da Moto

Status: **Sub-fases A, B e C homologadas. Pronto para publicação.**

---

## Sub-fase A — Fundação do Plano de Manutenção (HOMOLOGADA)

- Fim definitivo do matching por nome/includes.
- Vínculo apenas por `template_item_id`.
- Histórico individual por `maintenance_items`.
- Auditoria automática.
- Preparação para revisão inicial de motos usadas.

## Sub-fase B — Plano de Manutenção Editável (HOMOLOGADA)

- Nova aba **Componentes** no Centro de Controle.
- Cada componente aparece como item independente.
- ComponentSheet com ações rápidas: registrar manutenção, editar, desativar, marcar não aplica.
- Componentes personalizados por moto (`is_custom = true`).
- Severidade individual (`Normal`, `Atenção`, `Alta`, `Crítica`).
- Wizard de moto usada/seminova (`InitialReviewSheet`).
- Estado vazio amigável com CTA para criar/aplicar plano.
- Typecheck limpo. Console limpo. Sem bugs.

## Sub-fase C — Saúde da Moto v1.2.1 (HOMOLOGADA)

- Diagnóstico geral da moto: **Excelente, Boa, Atenção, Crítica**.
- Saúde calculada por componente com base na TIL.
- Buckets por status: **Vencidos, Atenção, Sem informação, Em dia**.
- Bucket Vencidos expandido por padrão.
- Integração 100% via TIL — nenhum cálculo duplicado nas telas.
- ComponentSheet com ações rápidas mantido e reutilizado na tela de Saúde.
- Cockpit exibe apenas o essencial: grade, score e item mais crítico.
- Centro de Controle com check-up completo (`HealthOverview`).
- Rota `/motorcycles/$id/health` funciona em mobile e desktop.
- Link "Abrir check-up completo" funciona corretamente.
- Severidade Crítica + status Atenção derruba a grade para Crítica.
- Mobile sem textos cortados; desktop limpo.
- Typecheck limpo. Console sem erros. Sem bugs encontrados.

### Itens registrados no changelog

- Saúde da Moto por componente.
- Diagnóstico geral: Excelente, Boa, Atenção e Crítica.
- Buckets por status.
- Integração 100% via TIL.
- ComponentSheet com ações rápidas.
- Cockpit exibindo apenas o essencial.
- Centro de Controle com check-up completo.
- Typecheck limpo.
- Sem bugs encontrados.

---

## Status

**Pronto para publicação.**
