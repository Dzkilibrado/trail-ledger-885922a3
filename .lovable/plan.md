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

---

## Quality Gate Final — v1.2.1 (HOMOLOGADO)

Auditoria de encerramento executada em 2026-07-07.

### Arquitetura confirmada

- Cockpit, TIL, Centro de Controle, Saúde, Componentes, Plano, Timeline,
  Dashboard, Catálogo, Comunicação, Administração, Auditoria, Mensagens,
  Chamados, Compartilhamentos, Certificados, Documentação, Agenda e Eventos
  respeitam a filosofia oficial.
- Nenhuma tela executa cálculos próprios — toda regra vem da TIL
  (`src/lib/til/*`).
- Nenhum widget depende de estado interno de outro widget.
- Recomposição cronológica da timeline preservada (ADR 0001).
- Matching estrito por `template_item_id` mantido em todo o fluxo de plano
  (ADR 0003).

### Limpeza aplicada

- Removido: `src/components/ScheduleManager.tsx` (substituído pela aba
  Componentes em `MotoControlCenter`).
- Auditoria `knip` executada: demais itens sinalizados (componentes shadcn
  não usados, exportações auxiliares) foram mantidos intencionalmente por
  serem primitivos do design system reutilizáveis por telas futuras.

### Segurança

- RLS habilitada em todas as tabelas de dados do usuário.
- Papéis geridos via `user_roles` + `has_role()` (nenhum papel em `profiles`).
- Server functions sensíveis usam `requireSupabaseAuth`; escrita
  administrativa passa por `supabaseAdmin` apenas em contexto server-only.
- Auditoria automática de manutenção preservada.

### Performance

- Snapshot da TIL calculado uma única vez por moto por render.
- Loaders usam `ensureQueryData` + `useSuspenseQuery` (padrão TanStack).
- Lazy loading das rotas administrativas mantido via file-based routing.

### Mobile Native First

- ADR 0004 registrada como diretriz permanente.
- Todas as rotas revisadas em viewport 390×844 (iPhone padrão).
- Cockpit, Centro de Controle, Saúde, Componentes, Plano e Timeline
  otimizados para uso com apenas o polegar.
- Sheets/Drawers usados no lugar de Dialogs em telas de conteúdo.
- Nenhuma tela depende de hover, clique direito ou teclado físico.

---

## Roadmap

### ✅ Entregas homologadas (v1.0 → v1.2.1)

- v1.0 — Base do TrailBook, timeline, documentos, certificados.
- v1.1 — Recomposição cronológica (ADR 0001).
- v1.2 — Cockpit + TIL (ADR 0002).
- v1.2.1 — Plano editável, Componentes, Saúde da Moto (ADR 0003) e
  Mobile Native First (ADR 0004).

### 🔜 Próximas versões (planejadas)

- **Modo Demonstração**: permitir explorar o TrailBook sem cadastro
  completo, com moto/dados fictícios reiniciados a cada sessão.
  *Apenas documentado — não implementado nesta versão.*
- Predição de próxima manutenção com base em uso real.
- Receitas de manutenção compartilháveis entre motos do mesmo modelo.
- Notificações push nativas (PWA).
- Auditoria automatizada de viewport mobile em CI (Playwright).

### 💡 Ideias em avaliação

- Marketplace de oficinas parceiras.
- Compartilhamento social de conquistas (km rodados, viagens).
- Integração com dispositivos OBD/telemetria.

### 🧹 Débito técnico conhecido

- Componentes shadcn não utilizados podem ser removidos junto com suas
  dependências quando houver certeza de não uso futuro.
- Exportações auxiliares em `activity-recalc.ts`, `maintenance-catalog.ts`,
  `plan-templates.ts` podem ser podadas na próxima refatoração de libs.
- `AuditDialog` (nomeado) pode ser consolidado com `AuditSummary`.

---

## Pilares Permanentes

Toda evolução futura DEVE respeitar:

1. **Simplicidade para o usuário** — mais funcionalidades = interface mais
   simples.
2. **Integridade dos dados** — recomposição cronológica e auditoria em toda
   mutação.
3. **Arquitetura escalável** — regra de negócio na TIL, telas apenas
   consomem.
4. **Mobile Native First** — smartphone primeiro, sempre (ADR 0004).
