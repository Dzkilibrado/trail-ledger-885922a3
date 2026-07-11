# Changelog — TrailBook

Todas as entregas oficialmente homologadas do TrailBook. Formato inspirado em Keep a Changelog.

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
