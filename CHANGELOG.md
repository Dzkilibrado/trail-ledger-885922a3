# Changelog — TrailBook

Todas as entregas oficialmente homologadas do TrailBook. Formato inspirado em Keep a Changelog.

## [1.6.2] — 2026-07-12 — Polish Sprint (Bloco C — Limpeza técnica e encerramento)

**Sprint v1.6 oficialmente encerrada.** Sem novas funcionalidades. Sem
alteração de RLS, migrations, storage, autenticação, permissões, edge
functions ou regras de negócio. Foco: consolidar padrões visuais,
eliminar duplicações e padronizar estados de loading/vazio.

### Consolidação de padrões visuais
- **Fonte única de estilos:** novo módulo `src/lib/ui/status-styles.ts`
  com `TONE` (paleta canônica de chips), `BADGE_TIER_STYLE` (selos v2)
  e `SCORE_TIER_STYLE` (tier de conservação do Passaporte).
- **Deduplicação:** `PRIORITY_TONE` e `STATUS_TONE` deixam de ser
  redeclarados em 7 arquivos. Agora `tickets.ts`, `comm.ts`,
  `cert-sections.ts`, `transfers.tsx`, `admin.users.tsx`,
  `CpfChangeAdminPanel.tsx` referenciam `TONE.*` — output em classes
  permanece idêntico ao anterior (nenhuma regressão visual).
- **`TIER_STYLE`:** as duas variações (selos v2 e escala do Passaporte)
  agora vivem em `BADGE_TIER_STYLE` e `SCORE_TIER_STYLE`, importadas de
  `BadgeChip` e `Passport`.

### Padronização de estados
- **`InlineSpinner`** (`src/components/InlineSpinner.tsx`) — spinner
  padrão para botões/ações. Nunca para carregamento de tela cheia.
- **`EmptyState`** (`src/components/EmptyState.tsx`) — bloco reutilizável
  para listas vazias, com ícone + título + descrição + ação opcional.
- **Skeletons no Admin:** substituído "Carregando…" residual por
  `PageLineSkeleton` em `admin.index`, `admin.homolog`, `admin.tickets`,
  `admin.modules`, `admin.users`, `admin.messages`, `complete-profile`,
  `ModuleGate`. Dialogs `CertificateAccessLogDialog` e
  `ReceiptsHistorySheet` migrados para `ListRowsSkeleton`.
- Placeholders textuais de `<Select>` mantidos (são texto de input
  legítimo, não estado de carregamento de tela).

### Fora de escopo (mantido intacto)
- `smart_receipts.*`, `evaluator` de selos, RLS, roles, storage,
  migrations, edge functions, `client*.ts`, `types.ts`,
  `auth-middleware.ts`, `auth-attacher.ts`.

### Regressão
- Fluxos revalidados (semântica preservada): Cadastro, Documento de
  Origem, Recibo de Compra e Venda, Passaporte, Selos, Certificados,
  Compartilhamento público (`/c/:token`, `/r/:code`), Timeline,
  Dashboard. Nenhuma alteração de rota ou API.

### Oportunidades futuras (não implementadas nesta Sprint)
- Unificar `RECEIPT_STATUS_TONE` em `TONE.*` — hoje usa tons `-300`
  em vez de `-400`; mudar exigiria homologação visual dedicada.
- Extrair `MotoControlCenter` (645 linhas) em subcomponentes por seção.
- Lazy-load das rotas administrativas por `codeSplitGroupings` dedicado.
- `<Toaster />` unificado com variantes tonais (`TONE`) para uniformizar
  toasts de erro/sucesso.

## [1.6.1] — 2026-07-12 — Polish Sprint (Bloco B — Performance percebida)

Sem novas funcionalidades, sem alterações de regras de negócio, RLS ou
migrations. Foco em reduzir flicker, unificar estados de loading e melhorar
a percepção de velocidade — principalmente Mobile.

### Performance
- **Cache de `signedUrl`** (`src/lib/trailbook.ts`): dedup de requisições em
  vôo + cache em memória com TTL (expires − 5 min). A mesma foto de moto
  não é mais re-assinada a cada navegação entre Início, Motos, Cockpit,
  Saúde e Plano. Nova função `getCachedSignedUrl` permite entrada síncrona.
- **`StoragePhoto`**: entrada síncrona quando a URL já está em cache
  (elimina o placeholder cinza intermediário), `memo` para evitar
  re-render em listas, `decoding="async"` além de `loading="lazy"`.
- **Router com `defaultPreload: "intent"`**: chunk + loader da rota
  pré-carregados ao hover/toque no link, tornando a transição quase
  instantânea. `defaultPendingMs` 200ms evita flash de pending em
  navegações rápidas.

### Skeletons unificados
- Novo módulo `src/components/Skeletons.tsx` com
  `ListRowsSkeleton`, `MotoGridSkeleton`, `CardBlockSkeleton`,
  `DashboardSkeleton`, `PageLineSkeleton`.
- Substituído texto "Carregando…" por skeletons nas telas mais visíveis:
  Início (Dashboard), Motos, Chamados (lista e detalhe), Mensagens,
  Certificados, Oficinas, Linha do tempo do Cockpit.

### Re-renderizações desnecessárias
- `QuickActions` do Dashboard envolto em `memo`.

### Fora de escopo (mantido intacto)
- `smart_receipts.*`, `evaluator`, RLS/roles, migrations, edge functions,
  `client*.ts`, `types.ts`, layouts autenticados.

### Próximo
- **Bloco C:** limpeza técnica (imports órfãos, componentes duplicados,
  consolidação de styles), encerrando oficialmente a Sprint v1.6.

## [1.6.0] — 2026-07-12 — Polish Sprint (Bloco A + defaults de performance)

Sem novas funcionalidades. Sprint oficial de polimento — foco em UX,
Mobile, textos e desempenho percebido. Nenhuma regra de negócio
homologada foi alterada.

### UX / Mobile
- **Dashboard reordenado:** Moto ativa → Pendências → Atalhos →
  Últimas atividades → Novidades. Métricas duplicadas removidas — o
  "Investido" já aparece no card da moto ativa.
- **Keyboard-safe:** todas as telas full-height migradas de `min-h-screen`
  para `min-h-dvh` (Auth, Root, Reset, Help, `/c/:token`, `/r/:code`,
  layout autenticado). Teclado do celular não corta mais o conteúdo.
- **EmitReceiptDialog:** viewport dinâmica (`max-h-[90dvh]`) para não
  exceder a tela com teclado aberto.
- **Textos técnicos removidos da UI visível:** "Storage privado · URL
  assinada · SHA-256" no cabeçalho da Central de Documentos virou
  "Cofre seguro". Tooltip de Documentos reescrito em linguagem simples.

### Performance
- **QueryClient com defaults sensatos** (`src/router.tsx`):
  `staleTime` 30s, `gcTime` 5min, `retry` 1, `refetchOnWindowFocus`
  false. Menos refetch e menos jitter em Mobile, sem alterar semântica.
- **`React.memo`** em componentes usados em listas longas
  (`BadgeChip`, `EventTypeIcon`).

### Fora de escopo (mantido intacto)
- `smart_receipts.*`, `evaluator` de selos, RLS/roles, migrations,
  edge functions, `client*.ts`, `types.ts`.

### Blocos seguintes (planejados)
- **Bloco B:** skeletons unificados, lazy-load de rotas administrativas,
  preload da foto da moto ativa.
- **Bloco C:** limpeza técnica (imports órfãos, `TIER_STYLE`/`SEVERITY_STYLE`
  consolidados em `src/lib/ui/status-styles.ts`).

## [1.5.1] — 2026-07-12 — Help Tooltips oficiais e Princípio da Descoberta em Um Toque

Sem novas funcionalidades. Padronização definitiva do uso de `HelpTooltip`
em todo o TrailBook e registro do princípio permanente de UX que rege
esse comportamento.

### UX / Descoberta
- **Registry único de textos de ajuda** (`src/lib/help/texts.ts`) — fonte
  única para toda a UI (`HELP.passport`, `HELP.originDoc`, etc.).
- **HelpTooltip endurecido para Mobile:** `collisionPadding`, largura
  responsiva (`w-[min(18rem,calc(100vw-1rem))]`), `sideOffset`, ícone
  maior e área de toque de 28×28.
- **Tooltips adicionados** em: Dashboard (Atalhos, banner de Documento de
  origem), Passaporte (Passaporte, Compartilhar, Pendências, Selo
  Certified, Histórico de propriedade, Saúde, Linha do tempo),
  `BadgeSection` (Selos de Qualidade — aparece em Dashboard/Central/
  Passaporte), Central de Documentos, Recibo (Fluxo, Comprador
  TrailBook, Comprador externo), Cadastro (`complete-profile`: CPF,
  Celular, WhatsApp, Estado/Cidade).
- Cada **selo individual** continua explicado pelo `BadgeTooltip` do
  chip (significado, critérios atendidos e pendentes) — atende ao
  requisito de tooltip por selo sem duplicar componente.
- **Reservado:** o rótulo "Verificado pelo TrailBook" ganhou tooltip
  explicando que é fase futura (validação humana).

### Governança — Princípio da Descoberta em Um Toque
- **[ADR 0009](docs/adr/0009-help-tooltips-e-descoberta.md)** — registra
  o princípio: "o usuário deve compreender qualquer funcionalidade em
  até um toque". Toda funcionalidade nova entrega
  (a) nome autoexplicativo **ou** (b) `HelpTooltip` correspondente.
- Registrado em `mem://principles/descoberta-um-toque` e
  `mem://standards/help-tooltips`.
- ADR 0008 (Regra Permanente de Qualidade) passa a verificar tooltips na
  etapa de Comunicação.

### Encerramento da Revisão de UX v1.5 — Descoberta Progressiva
- **[ADR 0010](docs/adr/0010-descoberta-progressiva.md)** — Princípio
  permanente: TrailBook ensina em 5 camadas (Interface → HelpTooltip →
  Como funciona → FAQ → Suporte).
- **Checklist obrigatório** para toda funcionalidade nova, executado na
  etapa Comunicação da ADR 0008 — 6 perguntas: Home, FAQ, Onboarding,
  HelpTooltip, "Como funciona", Novidades. Qualquer SIM = item
  obrigatório da entrega.
- Registrado em `mem://principles/descoberta-progressiva`.
- **Revisão de UX v1.5 oficialmente encerrada.**

## [1.5] — 2026-07-11 — Revisão de UX, Linguagem oficial e Regra Permanente de Qualidade

Sem novas funcionalidades. Entrega focada em tornar o TrailBook mais intuitivo, com linguagem simples, descoberta clara das funcionalidades e mobile como prioridade.

### UX / Descoberta
- **Home reorganizada** (`/dashboard`): banner de Novidades, resumo da moto ativa, pendências, atalhos rápidos, últimas atualizações. Métricas técnicas (horas/km/investido) enxugadas.
- **Banner "Novidades do TrailBook"** (`WhatsNewCard` + `WhatsNewDialog`) — dismissível por sessão, com resumo de Recibo, Documento de Origem, Selos, Passaporte Digital e Melhorias no Cadastro.
- **Onboarding de primeiro acesso** (`WelcomeTour`) — 4 telas explicando cadastro, moto/origem, manutenções/selos, passaporte/recibo. Reabrível em Configurações → "Ver tour de boas-vindas".
- **Nova página "Como funciona"** (`/como-funciona`) — passo a passo do fluxo TrailBook em linguagem simples.
- **Nova FAQ** (`/faq`) — 7 seções (Cadastro, Motocicleta, Recibo, Passaporte, Selos, Segurança) com busca por palavra-chave. `/help` continua sendo o chamado ao suporte.
- **Tooltip contextual** (`HelpTooltip`) — helper acessível por toque (Popover) para explicar termos como Documento de Origem, Histórico Completo, Recibo e Passaporte.
- **Configurações** ganhou atalhos: "Como o TrailBook funciona", "Perguntas frequentes" e "Ver tour de boas-vindas".

### Linguagem oficial ([mem](/.lovable/mem/principles/linguagem-oficial.md))
- Toda UI em português simples e amigável, sem termos técnicos quando houver equivalente claro.
- Glossário oficial: Smart Receipt → Recibo de Compra e Venda; Dashboard → Início; Timeline → Histórico; Passport → Passaporte Digital.
- Nomes técnicos ficam restritos a código, ADR e documentação.
- Título da Home passa a ser "Início — TrailBook".

### Governança — Regra Permanente de Qualidade
- **[ADR 0008](docs/adr/0008-regra-permanente-qualidade.md)** — 5 revisões obrigatórias antes de qualquer homologação:
  1. Funcional, 2. UX, 3. Mobile, 4. Comunicação, 5. Final (console/typecheck/build/docs/CHANGELOG).
- Vigora a partir desta versão para toda funcionalidade nova.
- Registrada em `mem://standards/qualidade-oficial` e referenciada em `dev-directives`.

### Não entrou nesta versão (fora do escopo)
- Novas funcionalidades de negócio.
- Alteração no evaluator dos Selos (Fase 1 encerrada).
- Alteração em RLS, roles ou banco.

## [1.4] — 2026-07-11 — Selos de Qualidade do Histórico (Fase 1 — Fundação) — **HOMOLOGADA E ENCERRADA**

Entrega focada em arquitetura escalável + primeiros selos reais derivados de evidências. Detalhes técnicos em [ADR 0007](docs/adr/0007-selos-qualidade-historico.md).

### Escopo entregue
- **Registry declarativo** (`src/lib/badges/registry.ts`): cada selo é uma definição pura (`id`, `tier`, `glyph`, `title`, `description`, `evaluate`). Adicionar um novo selo = adicionar um objeto no registry, sem tocar em componentes.
- **Motor puro e determinístico** (`src/lib/badges/evaluator.ts`): `evaluateBadges(evidence)` e `summarize(...)` — zero side-effects, sem I/O, testável. Único ponto de verdade para Central, Passaporte, Saúde e Documentos.
- **Evidências agregadas** (`src/hooks/useMotorcycleEvidence.ts`): snapshot montado a partir de documentos, timeline, plano/TIL, `ownership_history` e fotos. Nenhuma tabela nova criada nesta fase.
- **UI reutilizável** (`src/components/badges/`): `BadgeChip`, `BadgeGrid`, `BadgeSection`, `SingleBadgeChip` e `BadgeTooltip` compartilhados por todas as superfícies.
- **Selos derivados de evidências reais**: conquista é consequência — não existe endpoint nem ação de usuário para conceder/revogar selo.
- **Histórico Completo** (`history_complete`) como agregador automático: origem + documentação completa + cadeia de propriedade íntegra. Nome descritivo, sem implicar auditoria oficial.
- **"Verificado pelo TrailBook" reservado**: não implementado nesta fase. Só poderá ser reintroduzido quando existir processo real de validação humana (conferência documental, oficina homologada, inspeção técnica ou auditoria oficial).
- **Tiers ocultos na UI**: Bronze/Prata/Ouro/Signature permanecem no dado para peso do score e evolução futura, mas não são exibidos textualmente — evita hierarquização gamificada sem lastro em validação real.
- **Integrações**: Central da Moto (resumo enxuto), Passaporte Digital (grade completa pública), Saúde da Moto (`SingleBadgeChip` de Manutenção + Origem), Central de Documentos (`SingleBadgeChip` de Origem + Documentação Completa).
- **Preservação integral do histórico**: substituição/rebaixamento de documento reflete imediatamente nos selos — nunca cachear conquista antiga.
- **Migração do `OriginProvenBadge`**: componente legado removido; origem comprovada agora vem do registry.

### Homologação
Executada no **Ambiente Permanente de Homologação (APH)** — ver ADR 0005. Cenários E2E aprovados:

1. **M1 — Moto nova sem histórico**: nenhum selo conquistado; todos em `locked` ou `partial` com critérios claros; score 0.
2. **M2 — Histórico completo**: conquista de `origin_proven`, `documentation_complete`, `ownership_chain_intact` e `history_complete`; `timeline_rich` e `official_photos` conforme dados; `maintenance_on_track` reflete TIL.
3. **M4 — Pendências diversas**: selos parciais exibem critérios atendidos e pendentes; progresso visível na barra; tooltip explica o que falta.
4. **M8 — Manutenção vencida**: perda imediata do selo `maintenance_on_track` ao vencer item do plano; recomposição automática após regularização.

Validado também: determinismo (mesmo snapshot → mesma avaliação), reatividade a mudanças de dados sem refresh manual, consistência entre Central/Passaporte/Saúde/Documentos, mobile sem cortes, console limpo, `tsgo --noEmit` limpo e build de produção limpa.

### Regras permanentes
- Selos são **derivados**, nunca armazenados em tabela (Fase 1).
- Nunca criar endpoint / ação para conceder ou revogar selo manualmente.
- Novo selo = novo objeto no registry. Se um selo exigir mudança em `BadgeChip`/`BadgeGrid`/`BadgeSection`, o design do registry falhou.
- "Verificado pelo TrailBook" só volta com processo real de validação humana/parceiros.
- Alterações futuras neste módulo devem entrar como **nova fase**.

## [1.3] — 2026-07-10 — Cadastro Completo (Fases A · B · D · E) — **HOMOLOGADA E ENCERRADA**

Entrega composta em quatro fases homologadas separadamente no APH. Detalhes técnicos em [ADR 0006](docs/adr/0006-cadastro-completo-fases.md).

### Escopo entregue
- **Fase A — Modelo de dados + imutabilidade do CPF**: colunas obrigatórias em `profiles`, função `is_profile_complete(uid)`, trigger `profiles_lock_cpf`, backfill idempotente, compatibilidade total com perfis existentes.
- **Fase B — Wizard + Gate global**: rota `/complete-profile` (4 passos mobile-first), gate no layout `_authenticated` com lista fixa de rotas permitidas (Central de Ajuda, chamados, FAQ, Privacidade, Termos, configurações, logout, fluxo de alteração de CPF), fast-path client-side com verificação servidor sem flicker.
- **Fase D — Reutilização automática**: hook único `useProfileSnapshot()` + `<ProfileDataChip />`. Módulos operacionais nunca reperguntam nem escrevem de volta. Princípio oficial: "Informar uma vez. Reutilizar sempre.".
- **Fase E — Alteração de CPF via Suporte**: tabela `cpf_change_requests`, bucket privado `cpf-change-docs`, wizard `/tickets/cpf-change` em 5 passos, painel admin com aprovação/rejeição/pedido de informação, RPC `admin_approve_cpf_change` como única forma legítima de alterar CPF travado. CPF sempre mascarado em auditoria, mensagens e URLs.
- **Sincronização pós-aprovação**: `useProfileSnapshot` com `staleTime: 30s` + `refetchOnMount: "always"` + `refetchOnWindowFocus` + `refetchOnReconnect`. Novo CPF aparece na próxima navegação/foco sem cache preso.

### Homologação
APH — cenários aprovados por fase:

- **Fase A**: perfis existentes acessam `/dashboard`, `/perfil`, `/motorcycles`, `/admin/users` sem regressão; backfill não bloqueou usuários; `is_profile_complete` retorna corretamente; trigger de imutabilidade impede UPDATE direto em `profiles.cpf`.
- **Fase B**: gate libera exatamente as rotas permitidas; wizard completa fluxo sem flicker; usuário retorna à rota pretendida após completar; `profile_completed_at` gravado.
- **Fase D**: Smart Receipt pré-preenche "Local da negociação" com `location` do perfil; chip visível; edição manual não sobrescreve rascunho; invalidação após wizard atualiza abas abertas.
- **Fase E**: solicitação criada, CPF antigo preservado durante análise, aprovação altera somente o CPF correto, rejeição preserva CPF atual, snapshot atualizado após aprovação em nova navegação/foco, auditoria completa mascarada, notificações entregues, mobile sem cortes, console limpo, `tsgo --noEmit` limpo.

### Regra permanente
- CPF já validado é **imutável** para o usuário final. Qualquer correção passa obrigatoriamente por `admin_approve_cpf_change` com auditoria.
- Módulos que precisem de dados do perfil **devem** consumir `useProfileSnapshot()`. Não é permitido reperguntar CPF, nome, endereço, telefone ou WhatsApp em fluxos operacionais.

## [1.2] — 2026-07-10 — Smart Receipt (Recibo Inteligente) — **HOMOLOGADA E ENCERRADA**

Fase encerrada. Não realizar novas alterações neste módulo sem nova solicitação formal.

### Escopo entregue
- Venda entre usuários TrailBook (fluxo TB↔TB).
- Compra de pessoa externa (registro de origem posterior).
- Venda para comprador externo (sem conta TrailBook).
- Lifecycle completo de recibos: `draft → issued → awaiting_acceptance → completed`, com `cancelled`, `superseded` e `revoked` como terminais alternativos.
- Geração de PDF do recibo original (server function `generateReceiptPdf`).
- QR Code apontando para a página pública de validação.
- Hash SHA-256 do PDF armazenado em `smart_receipts.sha256`.
- Página pública `/r/:code` via RPC `get_public_receipt` (dados pessoais mascarados, sem exposição de PDF privado).
- Upload e vinculação do documento assinado (`signed_pdf_path`) com reset de aceites.
- Aceite independente das partes (`seller_accepted_at`, `buyer_accepted_at`) com guarda de assinatura anexada.
- Histórico de propriedade (`ownership_history`) encerrado em `completed`.
- Atualização de `owner_id` **somente** na transição para `completed` — nunca em `draft`, `issued` ou `awaiting_acceptance`.
- Arquivamento automático da moto na venda para comprador externo (`status='archived'`, `archive_reason` identificando venda externa e comprador).
- Preservação da cadeia documental: `bill_of_sale` gerado e marcado como novo `is_origin_document`; documento de origem anterior mantido com `is_origin_document=false` e `deleted_at=null`.
- RLS íntegra em `smart_receipts` e no bucket privado `smart-receipts` (partes envolvidas + admin; storage inacessível a terceiros).
- Idempotência garantida por trigger `on_smart_receipt_completed` (`IF OLD.status='completed' RETURN NEW`) — reexecução da conclusão não duplica eventos, `ownership_history`, `bill_of_sale`, nem re-arquiva.
- Integração com Timeline (evento `ownership_transfer` único por recibo concluído), Passaporte Digital (cadeia de propriedade preservada) e Documentos da moto.

### Homologação
Executada integralmente no **Ambiente Permanente de Homologação (APH)** — ver ADR 0005. Três cenários E2E aprovados:

1. **Cenário 1 — TB↔TB**: `vendedor.a` vende para `comprador.b`; `owner_id` transferido apenas em `completed`; visibilidade cruzada correta; página pública OK.
2. **Cenário 2 — Compra externa**: `comprador.b` cadastra moto de terceiro; pendência de origem criada e resolvida via anexo posterior; sem `smart_receipt` gerado; `ux_moto_origin_doc` bloqueia duplicata.
3. **Cenário 3 — Venda externa**: `vendedor.a` vende M2 para comprador sem conta; `owner_id` permanece com A; `ownership_history` encerrado sem nova entrada para o comprador; moto arquivada com motivo identificando venda externa; `bill_of_sale` `TB-RCV-2026-000003` criado; RLS + storage bloqueiam terceiros; idempotência confirmada.

### Correções colaterais aplicadas nesta fase
- Título "Passaporte Digital" em mobile 375×812 (`PageHeader` com `flex-col sm:flex-row` + `overflow-wrap:anywhere`).
- Função `public.align_smart_receipt_code_seq()` integrada a `seedHomologEnvironment` para prevenir colisões do `smart_receipt_code_seq`.
- Secret server-only `HOMOLOG_PASSWORD` (48 chars aleatórios) para senhas do APH — nunca exposto em UI, logs, código-fonte ou relatórios.

### Regra permanente
Toda nova funcionalidade a partir desta versão **deve** possuir ao menos um cenário no APH antes de ser considerada homologada (ADR 0005).
