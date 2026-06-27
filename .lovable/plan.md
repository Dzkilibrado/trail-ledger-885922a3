
# Revisão UX TrailBook v1.0 — Plano de Execução

Escopo grande, mas **sem novas features estruturais**: foco em navegação, clareza, ações, linguagem pt-BR, correção do bug crítico de exclusão e enriquecimento dos módulos fracos. Vou agrupar em ondas para entregar e validar incrementalmente.

## Onda 1 — Críticos e fundações (entrego primeiro)

1. **🔴 BUG crítico — Exclusão na Agenda apagava a moto**
   - Auditar `agenda.tsx`, `ScheduleManager.tsx` e qualquer botão "Excluir" próximo a items de programação.
   - Garantir que ações sobre schedule só toquem `maintenance_schedules`. Adicionar confirmação textual explícita: "Excluir esta programação de manutenção?".
   - Exclusão de moto permanece **somente** no detalhe da moto, já com confirm.

2. **Navegação consistente (web + mobile)**
   - Criar componente `PageHeader` com: título, breadcrumb opcional, botão Voltar (history-aware) e botão "Ir para início".
   - Aplicar em todas as rotas internas: Agenda, Detalhe moto, Certificados, Transferências, Oficinas, Financeiro, Nova moto, Planos.
   - Diálogos/forms: garantir botão **Cancelar** e toasts de sucesso/erro após salvar/excluir, com redirect claro (ex.: após criar moto → detalhe; após excluir → lista).

3. **Linguagem pt-BR**
   - Substituir "Escolher ficheiro" no input file por componente custom `<PhotoPicker>` com texto "Selecionar foto".
   - Renomear:
     - "Programações" → "Plano de manutenção"
     - "Novo evento" → "Registrar atividade" (uso/manutenção)
     - "Registros imutáveis das últimas alterações" → "Histórico de alterações"

## Onda 2 — Agenda redesenhada (item 2, 3, 4, 13)

- Novo layout em **cards** com badge discreta de status: Em dia / Próxima / Vencida / Postergada / Ignorada / Concluída.
- Barra de filtros (chips): Todas · Vencidas · Próximas · Concluídas · Postergadas · Ignoradas.
- Cada card exibe: serviço, moto, categoria, última execução, próxima estimada, horas/km restantes, severidade, ação recomendada.
- **Menu de ações por card** (dropdown): Registrar como concluída · Postergar · Ignorar · Editar · Excluir programação · Ver histórico.
- "Registrar como concluída" abre `NewEventDialog` pré-preenchido (tipo=manutenção, item ligado ao schedule). Ao salvar, atualiza `last_done_*` da schedule, timeline, agenda, score, painel de saúde e gera audit log.
- Schema: adicionar colunas `status` (`active|snoozed|ignored|done`), `snoozed_until`, `last_completed_event_id` em `maintenance_schedules` + RLS já existente cobre.

## Onda 3 — Auditoria amigável (item 5)

- Esconder lista bruta do detalhe da moto. Em vez disso, card-resumo: "Última alteração há X · Y registros · por Z" + botão "Ver histórico completo".
- Modal/Sheet com tabela legível: Campo alterado · Valor anterior · Novo valor · Alterado por · Data.
- Helper `humanizeAuditDiff(old, new)` mapeando colunas técnicas → labels pt-BR (`hours_total` → "Horímetro").

## Onda 4 — Oficinas (item 6)

- Lista enriquecida: card com nome, selo "TrailBook Verified" quando aplicável, cidade, especialidades, contagem de serviços, motos atendidas, último serviço, total movimentado (sum de `events.cost` com `workshop_id`).
- Perfil de oficina (rota `workshops.$id`): histórico de serviços, clientes (anonimizados), KPIs simples.
- Botões "Registrar serviço" e "Ver histórico" em cada card.

## Onda 5 — Financeiro (item 7)

- KPIs: gasto total · mês atual · ano atual.
- Gráfico simples (Recharts já presente) por mês (últimos 12) e breakdown por categoria + por moto.
- Lista "Últimos lançamentos" derivada de `events.cost > 0`.
- Filtro por período (mês/ano/custom) e por moto.
- Botões: "Registrar despesa" (abre NewEventDialog tipo=outro com cost), "Adicionar manutenção com custo".
- Exportar CSV simples dos lançamentos filtrados.

## Onda 6 — Certificado: pré-visualização (item 8)

- Em `CertificateSettingsDialog`, botão "Pré-visualizar" abre Sheet renderizando o **mesmo componente** da página pública (`PublicCertificateView`) com dados locais e `allowed_sections` em tempo real — sem precisar publicar.
- Extrair render da `c.$token.tsx` para componente reutilizável.

## Onda 7 — Transferências (item 9)

- Topo da página com passo-a-passo visual (2 cards: "Vendedor" / "Comprador") explicando o fluxo.
- Estados de botão claros + tooltip quando comprador ainda não tem conta ("Convidaremos por e-mail assim que ele criar a conta").
- Aba "Histórico" listando transferências resolvidas.

## Onda 8 — Cadastro de moto (itens 10, 11)

- Listas de seleção (Select com opção "Outros" → libera input):
  - Marca: Honda, Yamaha, KTM, GasGas, Husqvarna, Beta, Sherco, Kawasaki, Suzuki, Outros.
  - Modelo: catálogo por marca (CRF230F, CRF250F, CRF250R, CRF300L, WR250F, WR450F, 250 EXC-F, 350 EXC-F, etc. + Outros).
  - Cilindrada: 150, 230, 250, 300, 350, 450, 500, Outros.
  - Tipo de moto: Trilha leve, Enduro, MotoCross, Rally, Adventure, Outros.
  - Tipo de controle: Horímetro, Hodômetro, Ambos.
  - Anos: dropdown 1990–ano+1.
- Componente `<PhotoPicker>` substituindo o input file padrão (label "Selecionar foto").

## Onda 9 — Sinistro / Ocorrências (item 12)

- Novo tipo de evento `incident` (adicionar ao enum existente).
- `NewEventDialog` ganha aba/preset "Sinistro" com: tipo de ocorrência (select), data, descrição, peças afetadas, reparos, oficina, custo, fotos, documentos.
- Em **Cadastro de moto** novo passo: pergunta "A moto já teve sinistro?" — Sim / Não / Não informado. Se "Não", grava aceite (`incident_declaration` em `motorcycles`) com texto da declaração + timestamp e registra evento `declaration` na timeline + audit.
- `conservation.ts`: penalizar score quando houver `incident` recente (peso configurável).
- Certificado público: nova seção opcional "Sinistros declarados" no `cert-sections` (oculta por padrão).

## Banco de dados (migrações necessárias)

- `maintenance_schedules`: + `status` enum (`active|snoozed|ignored|done`), + `snoozed_until timestamptz`, + `last_completed_event_id uuid`.
- `motorcycles`: + `incident_declaration jsonb` (texto + accepted_at).
- `events.type` enum: adicionar `incident` e `declaration`.
- `cert-sections`: adicionar chave `incidents`.

Todas com GRANTs e RLS já existentes propagados.

## Fora de escopo desta rodada (registrado para roadmap)

- Dashboard real da oficina com login dedicado.
- Stripe / cobrança real.
- Exportação avançada de relatórios financeiros (PDF formatado).
- Convite por e-mail real ao comprador sem conta (depende de Resend/SMTP).

## Entregáveis

- Código + migrações aplicadas.
- Build/typecheck limpos.
- Smoke test via Playwright (login demo) capturando 4-5 telas-chave para confirmar visual.
- Resumo final no formato pedido: **Ajustado · Melhorado · Bugs corrigidos · Oportunidades futuras**.

---

**Confirma esta sequência?** Posso começar pela Onda 1 (bug crítico + navegação + linguagem) ainda agora, ou prefere reordenar prioridades / cortar alguma onda (ex.: deixar Sinistro para depois)?
