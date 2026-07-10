# Fase E — Alteração de CPF via Suporte

Fluxo excepcional, auditado, com aprovação administrativa. Usuário nunca altera CPF direto no perfil.

## Arquitetura

Reutilizamos **tickets** como container de conversa/status e criamos uma tabela dedicada `cpf_change_requests` para os dados sensíveis específicos (CPF novo, documento, decisão administrativa). Assim aproveitamos toda a infra existente (notificações, mensagens, admin UI) e mantemos os dados críticos em tabela própria com RLS estrita.

```text
tickets (fluxo/conversa/status) ──┐
                                   ├─── vinculado 1:1 por request_ticket_id
cpf_change_requests (dados) ──────┘
   └── documento em storage://cpf-change-docs/{user}/{req}/{uuid}.{ext}
```

## O que será construído

### 1. Schema (migração)

Nova tabela `public.cpf_change_requests`:
- `id`, `user_id`, `ticket_id` (FK → `tickets`, unique)
- `current_cpf_hash` (SHA-256 do CPF atual — nunca armazenado em claro)
- `new_cpf` (texto, apagado após aprovação; só admins autorizados leem)
- `new_cpf_hash` (SHA-256 para checagem futura sem exposição)
- `reason` (motivo)
- `document_path` (obrigatório, bucket privado `cpf-change-docs`)
- `status`: `open | in_review | awaiting_info | approved | rejected | cancelled`
- `decided_by`, `decided_at`, `decision_notes`
- `created_at`, `updated_at`

Bucket privado `cpf-change-docs` (novo) com policies: dono lê/escreve seu próprio prefixo; admin lê tudo via signed URL.

RLS:
- Usuário: SELECT/INSERT/UPDATE apenas em suas próprias requests, e só enquanto status ∈ {`open`, `awaiting_info`}. Nunca lê `new_cpf` diretamente — vem via RPC mascarada.
- Admin: SELECT via RPC `admin_list_cpf_requests`; nunca acessa colunas sensíveis por PostgREST direto (revoke SELECT no `new_cpf` para authenticated).

Tipo novo: `alter type ticket_type add value 'cpf_change'` + adicionar constante em `src/lib/tickets.ts`.

### 2. Funções server-side (SQL, `SECURITY DEFINER`)

- `public.submit_cpf_change_request(_ticket_id, _new_cpf, _reason, _document_path)` → valida CPF novo, unicidade, cria/atualiza registro, muda status para `open`, notifica admins.
- `public.admin_cpf_request_detail(_id)` → retorna dados mascarados (`***.***.***-XX`) para exibição; só `service_role`/admin.
- `public.admin_request_more_info_cpf(_id, _notes)` → status → `awaiting_info`, notifica usuário.
- `public.admin_reject_cpf_change(_id, _notes)` → exige motivo, marca rejeitado, notifica, encerra ticket como `closed`.
- `public.admin_approve_cpf_change(_id, _notes)` — chave da fase:
  - Revalida `validate_cpf(new_cpf)` e unicidade.
  - Usa `SET LOCAL role = 'service_role'` dentro do DEFINER para bypassar o trigger `profiles_lock_cpf`.
  - Atualiza `profiles.cpf`, `cpf_locked_at = now()`; guarda anterior em `audit_log`.
  - Marca request `approved`, ticket `resolved`.
  - Notifica usuário via `emit_system_message`.
  - Apaga `new_cpf` (claro) — mantém apenas hash.

Todas as funções escrevem em `admin_user_events` / `audit_log` com CPF **mascarado**.

### 3. UI usuário

- Em `/perfil` (e no wizard, step CPF bloqueado): botão “Solicitar alteração via suporte” → navega para `/tickets/new?flow=cpf_change`.
- Novo wizard mobile-first em 5 passos (`CpfChangeSheet`):
  1. Motivo (textarea, obrigatório).
  2. Novo CPF (mascarado) + confirmação.
  3. Upload de documento (jpg/png/pdf, ≤5 MB).
  4. Aceite de declaração de veracidade.
  5. Revisão + envio.
- Chip “Análise em até 2 dias úteis. CPF permanece o atual até aprovação.”
- Após envio, redireciona para `/tickets/$id` com status `Aberto`.
- `/tickets/$id`: quando `type='cpf_change'`, exibe box lateral com status da request (mascarado), documento (download signed URL) e histórico de decisões.

### 4. UI admin

Em `/admin/tickets` (detalhe): quando `type='cpf_change'`, exibe painel:
- Usuário, CPF atual mascarado (`***.***.***-XX`), CPF novo mascarado.
- Motivo, documento (signed URL, expira em 5 min).
- Histórico da request + auditoria.
- Botões: **Solicitar informação**, **Rejeitar** (exige motivo), **Aprovar** (confirmação dupla).

### 5. Segurança / LGPD

- Bucket `cpf-change-docs` privado; signed URL 300s.
- `new_cpf` em claro por no máximo o tempo entre `submit` e `approve/reject`.
- Nenhum log/audit imprime CPF sem máscara.
- Cache `useProfileSnapshot` invalidado após aprovação (via `emit_system_message` payload + client re-fetch on visibility, e no admin retornando ao usuário).
- Rate-limit: máx 3 requests abertas simultâneas por usuário.

### 6. Documentação

- ADR `docs/adr/0007-alteracao-cpf-via-suporte.md`.
- Memória `mem://features/alteracao-cpf` (fluxo, tabelas, RPC, quem pode o quê).
- Atualiza `.lovable/plan.md` marcando Fase E.

## Fora de escopo

- Alteração de e-mail via suporte (fase futura).
- Assinatura digital do documento comprobatório.
- OCR / validação automática do documento.

## Homologação prevista

Cenários APH validam os 14 itens do enunciado, incluindo:
- CPF direto no perfil bloqueado (trigger existente).
- Aprovação altera somente o CPF correto (admin resolve request A não afeta usuário B).
- Rejeição preserva CPF atual e trava.
- Snapshot invalidado no cliente após aprovação.
- Auditoria completa em `audit_log` + `admin_user_events`.
- Mobile sem cortes; console limpo; `tsgo --noEmit` limpo.
