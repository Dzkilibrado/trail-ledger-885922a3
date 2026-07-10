---
name: Alteração de CPF via Suporte
description: Fluxo excepcional auditado com aprovação administrativa; usuário nunca altera CPF direto.
type: feature
---

CPF já validado não pode ser alterado pelo cliente. Trigger `profiles_lock_cpf` bloqueia UPDATE direto e só `service_role` bypassa (via `SET LOCAL role` dentro de RPC `SECURITY DEFINER`).

## Fluxo

1. Usuário toca em "Solicitar alteração via suporte" (perfil ou wizard) → `/tickets/cpf-change`.
2. Wizard mobile-first (5 passos): motivo → novo CPF + confirmação → documento (bucket privado `cpf-change-docs`, ≤5 MB, JPG/PNG/PDF) → declaração de veracidade → revisão + envio.
3. Ao enviar: cria `tickets` (type `cpf_change`, priority `high`, module `account`) + faz upload + chama RPC `submit_cpf_change_request` (valida CPF, unicidade, rate-limit 3 abertas/usuário) → grava `cpf_change_requests`.
4. Admin abre `/admin/tickets/$id`. Painel `CpfChangeAdminPanel` aparece quando `type='cpf_change'`. Vê CPFs mascarados, motivo, documento (signed URL 5 min). Ações: pedir informação, rejeitar (motivo ≥5 chars), aprovar (confirmação dupla).
5. **Aprovar** → RPC `admin_approve_cpf_change` revalida, executa UPDATE em `profiles.cpf` bypassando o trigger via `SET LOCAL role = service_role`, atualiza `cpf_locked_at`, apaga `new_cpf` em claro (mantém hash), notifica usuário via `emit_system_message`, encerra chamado como `resolved`. Registra em `audit_log` + `admin_user_events` com CPFs sempre mascarados.
6. **Rejeitar** → apaga `new_cpf` em claro, notifica, encerra `closed`. **Pedir informação** → status `awaiting_info`, chamado `awaiting_user`.

## Segurança

- Bucket privado `cpf-change-docs` com policies: dono lê/escreve prefixo `{user_id}/…`; admin lê tudo. Signed URL 300s.
- Coluna `new_cpf` tem `REVOKE SELECT … FROM authenticated` (leitura só via RPC mascarada).
- Hash SHA-256 do CPF novo/atual em `new_cpf_hash` / `current_cpf_hash` para rastrear sem expor.
- Rate-limit: máx 3 requests abertas por usuário.
- CPF nunca aparece em URL, log ou auditoria em claro — só via `mask_cpf()` (`***.***.***-XX`).
- Cache `useProfileSnapshot` invalidado no cliente após envio; após aprovação o próximo carregamento (visibility ou re-mount) pega o CPF novo.

## RPCs

- `submit_cpf_change_request(_ticket_id, _new_cpf, _reason, _document_path)` — usuário.
- `admin_list_cpf_requests(_status, _limit)` — admin, mascarado.
- `admin_cpf_request_detail(_id)` — admin, mascarado.
- `admin_request_more_info_cpf(_id, _notes)` — admin.
- `admin_reject_cpf_change(_id, _notes)` — admin, notes obrigatórios.
- `admin_approve_cpf_change(_id, _notes)` — admin, única forma legítima de trocar CPF já validado.

## Arquivos

- Migração: `supabase/migrations/*_fase_e_alteracao_cpf_via_suporte.sql`.
- Wizard: `src/routes/_authenticated/tickets.cpf-change.tsx`.
- Painel admin: `src/components/CpfChangeAdminPanel.tsx` (montado em `tickets.$id.tsx` quando `type='cpf_change'`).