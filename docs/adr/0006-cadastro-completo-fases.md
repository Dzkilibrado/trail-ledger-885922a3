# ADR 0006 — Cadastro Completo (Fases A, B, D, E)

Status: Aceito — 2026-07-10

## Contexto

O TrailBook precisava de um cadastro completo, obrigatório e reutilizável para
desbloquear módulos operacionais (Smart Receipt, Certificados,
Transferências, Documentos) sem violar o princípio "Informar uma vez.
Reutilizar sempre.". A entrega foi dividida em quatro fases homologadas
separadamente no APH.

## Decisão

### Fase A — Modelo de dados e imutabilidade do CPF
- Colunas obrigatórias em `public.profiles`: `full_name`, `cpf`, `birth_date`,
  `phone`, `whatsapp`, `whatsapp_same_as_phone`, `uf`, `city`, `cep`,
  `bairro`, `logradouro`, `numero`, `complemento`, `profile_completed_at`,
  `cpf_locked_at`.
- Função de completude `public.is_profile_complete(uid)` — fonte única.
- Trigger `profiles_lock_cpf`: após `cpf_locked_at` preenchido, qualquer
  UPDATE em `cpf` levanta exceção. Bypass legítimo somente via `service_role`
  dentro de RPC `SECURITY DEFINER` (`admin_approve_cpf_change`).
- Backfill idempotente para perfis existentes.

### Fase B — Wizard de 4 passos + gate global
- Rota `/complete-profile` (mobile-first, 4 passos: identidade → contato →
  endereço → revisão).
- Gate no layout `_authenticated`: usuários com `profile_completed_at IS NULL`
  redirecionam para `/complete-profile`, exceto rotas permitidas:
  `/complete-profile`, `/help`, `/tickets`, `/tickets/new`, `/tickets/$id`,
  `/tickets/cpf-change`, `/faq`, `/privacy`, `/terms`, `/settings`, `/logout`.
- Fast-path client-side com verificação no servidor para evitar flicker.

### Fase D — Reutilização automática
- Hook único `useProfileSnapshot()` (query key `["profile-snapshot"]`)
  distribui os campos do perfil para módulos operacionais.
- Componente `<ProfileDataChip />` sinaliza campos pré-preenchidos com link
  para `/perfil`.
- Módulos nunca escrevem de volta no perfil a partir do snapshot.

### Fase E — Alteração de CPF via Suporte
- Tabela `public.cpf_change_requests` + bucket privado `cpf-change-docs`.
- Fluxo excepcional em 5 passos no wizard `/tickets/cpf-change`.
- RPCs `SECURITY DEFINER`:
  `submit_cpf_change_request`, `admin_list_cpf_requests`,
  `admin_cpf_request_detail`, `admin_request_more_info_cpf`,
  `admin_reject_cpf_change`, `admin_approve_cpf_change`.
- `admin_approve_cpf_change` é a única forma legítima de alterar CPF após
  travamento: valida, faz `SET LOCAL role = 'service_role'` para bypassar o
  trigger, atualiza `profiles.cpf` + `cpf_locked_at`, audita mascarado,
  notifica o usuário e apaga `new_cpf` em claro.
- CPF nunca aparece em claro em logs, auditoria, mensagens ou URLs.

### Sincronização pós-aprovação
`useProfileSnapshot` usa `staleTime: 30s`, `refetchOnMount: "always"`,
`refetchOnWindowFocus: true`, `refetchOnReconnect: true`. Assim, após
aprovação administrativa, o novo CPF aparece na próxima navegação, abertura
do perfil ou retomada do app — sem depender de invalidação manual do cliente
que enviou a solicitação (o CPF só muda depois, no lado do admin).

## Consequências

- CPF é imutável para o usuário final; qualquer correção passa por auditoria
  administrativa.
- Módulos operacionais consomem uma única fonte de verdade do perfil.
- Gate global garante que dados obrigatórios existem antes de qualquer
  operação sensível.
- LGPD: documentos em bucket privado com signed URL curta; CPF mascarado em
  todas as superfícies de leitura.

## Referências
- `mem://features/alteracao-cpf`
- `mem://principles/informar-uma-vez`
- `src/hooks/useProfileSnapshot.ts`
- `src/routes/_authenticated/complete-profile.tsx`
- `src/routes/_authenticated/tickets.cpf-change.tsx`
- `src/components/CpfChangeAdminPanel.tsx`