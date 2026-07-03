# TrailBook v1.0.1 — Central de Comunicação e Mensageria Interna

Objetivo: entregar uma Central de Mensagens interna funcional (Admin ↔ Usuário) e deixar a arquitetura pronta para ligar e-mail real depois, sem custo agora.

## 1. Modelo de dados (uma migração)

**Enums novos**
- `message_channel`: `internal`, `email`, `whatsapp`, `push`, `sms`
- `message_type`: `system_notice`, `support`, `access`, `documentation`, `certificate`, `maintenance`, `financial`, `homologation`, `security`, `system_update`, `other`
- `message_subject_key`: `signup_confirmation`, `password_recovery`, `cpf_duplicate`, `email_not_confirmed`, `account_blocked`, `profile_update`, `document_pending`, `certificate`, `ticket`, `homologation`, `important_notice`, `other`
- `message_priority`: `low`, `medium`, `high`, `critical`
- `message_status`: `draft`, `sent`, `read`, `replied`, `archived`, `cancelled`
- `message_audience`: `single_user`, `by_status`, `by_role`, `homologation_users`, `open_tickets`, `email_unconfirmed`, `blocked_users`, `all_users`
- `delivery_status`: `pending`, `sent`, `simulated`, `skipped_disabled`, `failed`

**Tabelas**
- `public.comm_settings` — singleton (`id=1`): flags `email_enabled` (default `false`), `internal_enabled` (`true`), `whatsapp_enabled` (`false`), `push_enabled` (`false`), `sms_enabled` (`false`), `homologation_mode` (`true`), `email_from`, `email_provider`, `email_test_redirect`. Somente admin lê/escreve.
- `public.messages` — cabeçalho da mensagem/thread: `code` (`TB-M-YYYY-NNNNNN`), `sender_id` (nullable = sistema), `type`, `subject_key`, `subject_other`, `subject_text` (derivado), `body`, `priority`, `status`, `audience`, `audience_filter` (jsonb), `is_automatic`, `related_ticket_id`, `parent_message_id` (para respostas), `allow_reply` (bool), timestamps.
- `public.message_recipients` — 1 linha por destinatário: `message_id`, `user_id`, `status` (`sent`/`read`/`replied`/`archived`), `read_at`, `replied_at`, `archived_at`. PK `(message_id, user_id)`.
- `public.message_deliveries` — tentativa por canal por destinatário: `message_id`, `user_id`, `channel`, `status` (delivery_status), `simulated` (bool), `payload` (jsonb, para "envio simulado"), `error`, `created_at`. Para e-mail em homologação grava `simulated=true` com payload completo.
- `public.comm_audit` — auditoria dedicada: `actor_id`, `action` (`message_created|sent|read|replied|archived|email_simulated|email_sent|settings_changed`), `message_id`, `channel`, `recipient_id`, `subject_text`, `type`, `status`, `metadata` (jsonb).

**RLS**
- Usuário lê apenas suas linhas em `message_recipients` e a `messages` correspondente; escreve `read/replied/archived` apenas na própria linha.
- Admin (`has_role admin`) tem full read; escreve via RPCs abaixo.
- `comm_settings`, `message_deliveries`, `comm_audit` — SELECT/UPDATE só admin (via RPC). GRANTs completos por role.

**RPCs (SECURITY DEFINER)**
- `admin_get_comm_settings()`, `admin_update_comm_settings(_json jsonb)`
- `admin_send_message(_type, _subject_key, _subject_other, _body, _priority, _audience, _filter jsonb, _allow_reply, _related_ticket_id, _channels text[])` → expande audiência, cria `messages`, `message_recipients`, gera `message_deliveries` (e-mail sempre `simulated` enquanto `email_enabled=false` ou `homologation_mode=true`), grava auditoria.
- `admin_reply_message(_parent uuid, _body)` — cria mensagem filha para o mesmo usuário.
- `user_reply_message(_parent uuid, _body)` — respeita `allow_reply`, cria mensagem com `sender_id = auth.uid()` endereçada ao admin remetente original (ou grupo `USER_ADMIN`).
- `user_mark_message(_id uuid, _action text)` — `read|archived`.
- `user_open_ticket_from_message(_id uuid, _subject, _body, _priority)` — cria ticket vinculado, popula `related_ticket_id`.
- `emit_system_message(_event text, _user uuid, _payload jsonb)` — usado por triggers/eventos automáticos (cadastro, CPF duplicado, chamado aberto, certificado emitido, etc.). Cria mensagem `is_automatic=true` no canal `internal`; se `email_enabled` gera `pending` para e-mail (mas não envia — apenas registra).

## 2. Fase 1 do envio de e-mail (arquitetura, sem enviar)

Enquanto `comm_settings.email_enabled = false`:
- Toda mensagem que teria e-mail gera `message_deliveries` com `status='skipped_disabled'` **ou**, se `homologation_mode=true`, `status='simulated'` com o payload (`to`, `from`, `subject`, `html_preview`) — visível no painel admin.
- Nenhuma chamada a provedor externo, nenhum custo.
- Ponto único (`internal:sendEmail(delivery)`) fica stub retornando "disabled". Quando um dia ligarmos Lovable Emails, trocamos o stub.

## 3. Frontend

**Usuário — `/messages` (novo, sob `_authenticated`)**
- Lista de mensagens recebidas com filtros por tipo, prioridade, lida/não lida, período.
- Detalhe: assunto, remetente, prioridade badge, corpo, timeline de respostas.
- Ações: marcar como lida (auto ao abrir), responder (quando `allow_reply`), arquivar, "Abrir chamado a partir desta mensagem".
- Empty state: "Nenhuma mensagem recebida."
- Ícone com contador de não-lidas no topbar (usa `message_recipients` do usuário).

**Admin — `/admin/messages` (novo)**
- Aba **Enviar**: form com selects (tipo, assunto, prioridade, audiência, filtros por status/perfil/homologação/etc.), textarea corpo, checkbox "Permitir resposta", vínculo opcional a chamado, checkboxes de canais (internal sempre; e-mail desabilitado com tooltip explicando).
- Aba **Gestão**: tabela filtrada por usuário, perfil, status, tipo, assunto, prioridade, período, lida/não-lida, automática/manual, homologação. Busca textual: nome/e-mail/CPF/conteúdo.
- Aba **Envios simulados**: lista `message_deliveries` com `simulated=true` — mostra "e-mail que seria enviado" (destinatário, assunto, corpo).
- Aba **Configurações**: toggles de canais, modo homologação, remetente, provedor, e-mail de teste. Salva via `admin_update_comm_settings`.

**Feedback (toast)**
- "Mensagem enviada com sucesso."
- "Mensagem registrada internamente. O envio por e-mail está desabilitado no momento." (quando canal e-mail marcado mas desabilitado)

## 4. Eventos automáticos ligados agora

Via `emit_system_message` chamado a partir de triggers/RPCs existentes:
- cadastro criado, e-mail pendente, CPF duplicado (já sabemos no `handle_new_user`)
- chamado aberto/respondido (extend `tickets_workflow` e `ticket_message_notify`)
- certificado emitido, documento anexado
- conta bloqueada/reativada (`admin_set_user_status`)
- manutenção vencida, plano aplicado

Mantém `public.notifications` atual para o sininho de topbar; a Central é o inbox rico.

## 5. Integração com chamados

- Botão "Abrir chamado a partir desta mensagem" pré-preenche assunto/corpo e grava `related_ticket_id` na mensagem original.
- Ao responder um chamado, gerar mensagem automática vinculada (`type=support`, `related_ticket_id`) para o usuário.
- Detalhe do chamado passa a mostrar mensagens vinculadas em uma seção "Comunicação relacionada".

## 6. Auditoria

Toda ação (`admin_send_message`, marcar lida, responder, arquivar, envio simulado, mudança de configuração) grava em `comm_audit`. Tela admin de auditoria filtrável — reaproveita padrão do `AuditDialog` existente.

## 7. Arquivos afetados

**Novos**
- `supabase/migrations/…_comm_center.sql` (enums, 5 tabelas, RLS, GRANTs, RPCs, triggers de código/updated_at, seed do `comm_settings`).
- `src/routes/_authenticated/messages.tsx` (inbox do usuário)
- `src/routes/_authenticated/messages.$id.tsx` (detalhe/resposta)
- `src/routes/_authenticated/admin.messages.tsx` (abas Enviar/Gestão/Simulados/Configurações)
- `src/lib/comm.ts` (labels, tones, tipos, helpers)
- `src/components/MessageComposer.tsx`, `MessageList.tsx`, `MessageDetail.tsx`, `CommSettingsPanel.tsx`, `SimulatedDeliveriesPanel.tsx`
- `src/hooks/useUnreadMessages.ts`

**Editados**
- `src/routes/__root.tsx` — ícone/contador de mensagens não lidas no topbar (se houver topbar).
- `src/routes/_authenticated/tickets.$id.tsx` — seção "Comunicação relacionada" + gerar mensagem ao responder.
- `src/routes/_authenticated/admin.tickets.tsx` — botão "Enviar mensagem ao usuário".
- `src/routes/_authenticated/admin.users.tsx` — ação "Enviar mensagem" no drawer.

## 8. Fora do escopo desta entrega

Envio real de e-mail (fica atrás do flag `email_enabled`), WhatsApp, Push, SMS, templates React Email — a estrutura fica pronta e é ligada em uma próxima entrega quando o provedor for contratado.

## Entrega

Migração + código na mesma leva. Depois, relatório curto de homologação com checklist: enviar como admin, receber como usuário, responder, arquivar, abrir chamado da mensagem, alternar `email_enabled` e ver simulados, auditoria populada.
