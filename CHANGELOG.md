# Changelog — TrailBook

Todas as entregas oficialmente homologadas do TrailBook. Formato inspirado em Keep a Changelog.

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
