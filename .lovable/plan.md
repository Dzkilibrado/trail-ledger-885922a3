# Revisão de UX v1.5 — TrailBook mais intuitivo

> **Fase 1.5.1 encerrada (2026-07-12):** padronização oficial de
> `HelpTooltip`, registry `HELP` e ADR 0009 (Descoberta em Um Toque).
> Ver CHANGELOG [1.5.1] e `mem://standards/help-tooltips`.
>
> **Revisão de UX v1.5 ENCERRADA (2026-07-12):** ADR 0010 registra o
> Princípio da Descoberta Progressiva (5 camadas + checklist de 6
> perguntas para toda nova funcionalidade). Roadmap seguinte: novas
> funcionalidades entram como novas fases, sempre passando pelo
> checklist na etapa Comunicação da ADR 0008.

Sem novas funcionalidades. Foco em linguagem simples, descoberta, navegação, mobile e padronização visual. Uma entrega grande, dividida em blocos coerentes.

## 1. Princípio oficial de linguagem (base de tudo)

Registrar em `mem://principles/linguagem-oficial` e citar no Core do `.lovable/mem/index.md`:

- Toda UI em português simples, objetivo, amigável.
- Sem termos técnicos quando existir equivalente claro.
- Nomes técnicos ficam restritos a código, docs, ADR e arquitetura.
- Glossário oficial de substituições:
  - "Smart Receipt" → "Recibo de Compra e Venda"
  - "Emit Smart Receipt" → "Gerar Recibo"
  - "Smart Receipt History" → "Histórico de Recibos"
  - "Smart Receipt Status" → "Status do Recibo"
  - "Dashboard" → "Início"
  - "Timeline" → "Histórico"
  - "Passport" (rótulos de UI) → "Passaporte Digital"
  - "Selos" mantém "Selos de Qualidade"

Auditoria e substituição em toda a UI (componentes, dialogs, toasts, menus, sidebar, PageHeader, breadcrumbs). Arquivos-alvo principais: `MotoControlCenter`, `MotorcycleDocuments`, `HealthOverview`, `receipts/*`, `cockpit/*`, `PageHeader`, `router.tsx` (labels da sidebar), rotas em `_authenticated/*`.

## 2. Home (rota `/dashboard`) — painel executivo

Reorganizar `src/routes/_authenticated/dashboard.tsx` como painel enxuto, mobile-first:

1. Saudação curta + Moto Ativa (mantém `ActiveMotoCard`).
2. **Banner Novidades** (novo componente `WhatsNewCard`) — dismissível por sessão, com CTA "Saiba mais" abrindo modal `WhatsNewDialog` listando: Recibo, Documento de Origem, Selos, Passaporte, Melhorias no Cadastro.
3. **Pendências** (mantém `DocumentPendenciesCard`, texto revisado).
4. **Resumo da Moto Ativa** — chips clicáveis, cada um leva à seção correta:
   - Passaporte Digital · Documento de Origem · Recibo · Selos · Certificados · Histórico · Próximas Manutenções.
5. **Últimas atualizações** (eventos recentes já existe — só renomear seção e enxugar).
6. Lista "Suas motos" mantida colapsada como hoje.

Remover métricas de topo (4 KPIs) — ruído para o usuário comum. Manter só "Motos" + investido opcional dentro do card ativo.

Novo componente `HomeQuickActions` reaproveitando tokens do design system (`TBActionCard`).

## 3. FAQ (rota `/help`)

Reescrever `src/routes/help.tsx` com as 7 seções pedidas (Cadastro, Motocicleta, Recibo, Passaporte, Selos, Segurança, Como funciona). Estrutura acordeon (shadcn `Accordion`), busca simples por texto, âncoras por seção. Todo conteúdo em português claro, sem jargão.

## 4. Página "Como funciona" (`/help/como-funciona`)

Nova rota `src/routes/help.como-funciona.tsx` com fluxo vertical (passos numerados em cards) — mobile-first. Sem novas funcionalidades, só explicação visual do fluxo Cadastro → Moto → Origem → Manutenções → Recibo → Passaporte → Selos. Link visível na FAQ e no onboarding.

## 5. Tooltips contextuais

Criar helper `src/components/HelpTooltip.tsx` (wrapper do shadcn `Tooltip` + ícone `Info`, acessível via touch com `Popover` no mobile). Aplicar em:

- Documento de Origem (card e formulário).
- Histórico Completo (BadgeChip já tem tooltip — padronizar texto).
- Recibo de Compra e Venda (botão gerar).
- Passaporte Digital (Central da Moto).
- Selos de Qualidade (seções resumo).

Textos oficiais no plano do usuário.

## 6. Onboarding de primeiro acesso

Novo componente `src/components/onboarding/WelcomeTour.tsx` — 4 telas em bottom sheet (mobile) / dialog (desktop):

1. Bem-vindo ao TrailBook.
2. Cadastre sua motocicleta e o Documento de Origem.
3. Registre manutenções e conquiste Selos.
4. Compartilhe o Passaporte Digital e gere Recibos.

Trigger: primeiro login sem flag `tb_onboarding_v1_done` em `localStorage`. Botões "Pular" e "Começar". Reabrir via `Configurações → Ver tour novamente` (adicionar item em `settings.tsx`).

Sem tabela nova — persistência apenas em `localStorage` por enquanto (consistente com "Sem novas funcionalidades / sem novas tabelas").

## 7. Revisão de textos globais

Sweep com `rg` por strings a substituir e ajustar em lote. Foco em:
- Toasts (`sonner`) — mensagens curtas, verbo no imperativo positivo.
- Títulos de dialogs e sheets.
- Labels de sidebar (`router.tsx` / layout).
- CTAs duplicadas.

## 8. Mobile QA

Passar Playwright em 384×703 nas telas principais (Home, Central da Moto, Passaporte, Documentos, Saúde, Recibos, FAQ, Como funciona, Onboarding). Corrigir qualquer texto cortado / scroll horizontal aplicando os padrões `responsive-layout-patterns` (grid + `min-w-0` + `truncate` + `shrink-0`). Screenshots em `/tmp/browser/ux-v15/`.

## 9. Padronização visual

Consolidar via design system existente (`TBPageHeader`, `TBSectionHeader`, `TBCard`, `TBButton`, `TBChip`). Substituir usos ad-hoc encontrados durante a revisão. Sem novo token de cor — só coerência.

## 10. Regra permanente de qualidade

Registrar oficialmente:

- **ADR 0008** — `docs/adr/0008-regra-permanente-qualidade.md`: as 5 etapas (Funcional, UX, Mobile, Comunicação, Final) obrigatórias antes de qualquer homologação.
- Memória: `.lovable/mem/standards/qualidade-oficial.md` + referência no Core do índice.
- `CHANGELOG.md` — nova versão `[1.5] Revisão de UX`.
- `.lovable/plan.md` — bloco "Revisão de UX v1.5" concluído.
- Atualizar `.lovable/mem/standards/dev-directives.md` referenciando a nova regra.

## Homologação (entregável final)

- Typecheck `bunx tsgo --noEmit` limpo.
- Console limpo em Playwright.
- Screenshots mobile das principais telas anexadas ao relatório.
- Lista de textos substituídos, tooltips adicionados, telas revisadas.

---

## Detalhamento técnico (para o dev)

Arquivos a criar:
- `src/components/WhatsNewCard.tsx`, `src/components/WhatsNewDialog.tsx`
- `src/components/HelpTooltip.tsx`
- `src/components/onboarding/WelcomeTour.tsx`
- `src/routes/help.como-funciona.tsx`
- `docs/adr/0008-regra-permanente-qualidade.md`
- `.lovable/mem/principles/linguagem-oficial.md`
- `.lovable/mem/standards/qualidade-oficial.md`

Arquivos a editar (principais):
- `src/routes/_authenticated/dashboard.tsx` (reorganização Home)
- `src/routes/help.tsx` (FAQ nova)
- `src/routes/_authenticated/settings.tsx` (item "Ver tour novamente")
- `src/routes/__root.tsx` / `router.tsx` (labels)
- `src/components/receipts/*` (renomeações de UI)
- `src/components/MotoControlCenter.tsx`, `MotorcycleDocuments.tsx`, `PageHeader.tsx`
- `.lovable/mem/index.md`, `.lovable/plan.md`, `CHANGELOG.md`, `.lovable/mem/standards/dev-directives.md`

Sem migrações de banco. Sem novas tabelas. Sem novas dependências (usar shadcn já disponível).

## Escopo explicitamente FORA

- Nenhuma nova funcionalidade de negócio.
- Nada em `smart_receipts.*` do backend (Fase 1.2 encerrada).
- Sem alterar evaluator de Selos.
- Sem mudar RLS/roles.

Aprovar para eu executar em uma única entrega, ou pedir para dividir em fases (ex.: Fase A = linguagem+Home+regra permanente; Fase B = FAQ+Como funciona+Onboarding+Tooltips; Fase C = QA mobile e polimento).
