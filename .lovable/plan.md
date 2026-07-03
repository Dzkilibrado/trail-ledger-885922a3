# Fase 1 — Acesso, Autenticação e Recuperação

Vou entregar toda a experiência de acesso, deixando administração e polimento para as fases 2 e 3.

## 1. Entregabilidade de e-mails (custom domain)

Melhor entregabilidade exige domínio próprio (SPF/DKIM/DMARC gerenciados). Vou configurar Lovable Emails no subdomínio `notify.trailbook.com.br` e depois personalizar os templates de autenticação (signup, recovery, magic link) com a identidade visual do TrailBook.

Ação necessária de você: concluir o setup de DNS via diálogo abaixo. Enquanto o DNS propaga, o restante da Fase 1 já fica pronto e os e-mails passam a sair pelo domínio próprio automaticamente após verificação.

## 2. Tela de Auth — melhorias de UX

- **Botão "Reenviar e-mail de confirmação"** disponível após cadastro e no login quando o e-mail não está confirmado.
- **Mensagem pós-cadastro** clara: "Enviamos um e-mail de confirmação para X. Verifique também a caixa de SPAM/lixo eletrônico."
- **Mensagem específica** quando o login falha por e-mail não confirmado, com botão de reenvio inline.
- **Link "Preciso de ajuda para acessar minha conta"** abaixo do formulário de login → abre a rota pública de chamado.

## 3. Fluxo de CPF já existente

- No cadastro tradicional: mensagem clara `Este CPF já possui uma conta cadastrada no TrailBook.` + 3 ações: Recuperar acesso · Abrir chamado · Voltar ao login.
- No `complete-profile` (após login Google): mesma mensagem e mesmas 3 ações, sem gravar duplicidade. O usuário Google recém-criado pode fazer sign-out e voltar ao login tradicional/Google original.

## 4. Rota pública de chamado — `/help`

Nova rota pública `/help` (SSR-on, sem auth) com formulário:

Campos obrigatórios: Nome completo, Data de nascimento, CPF, WhatsApp, E-mail de contato, Tipo de problema (select), Descrição. Se tipo = "Outro" → detalhamento obrigatório.

Tipos: Esqueci meu acesso · CPF já cadastrado · Não recebi e-mail de confirmação · Troquei de e-mail · Troquei de telefone · Problema com login Google · Conta bloqueada · Outro.

## 5. Banco de dados

Migração criando:

- Tabela `public.help_requests` (chamados pré-login) com RLS: INSERT permitido a `anon` via SECURITY DEFINER `submit_help_request(...)` que valida e insere; SELECT somente para admins. Grava IP e user_agent, gera código `TB-H-YYYY-NNNNNN`.
- RPC `resend_confirmation_email(_email)` (SECURITY DEFINER) que apenas re-dispara `auth.users` invite/confirm quando existe conta sem confirmar — na prática usaremos `supabase.auth.resend()` do lado do cliente (não precisa de tabela nova aqui).
- Índice case-insensitive já existe em `profiles.email` (feito em v1.0).

## 6. Recuperação de acesso

Já existe `/reset-password` e o fluxo `resetPasswordForEmail`. Vou:
- Adicionar um card "Recuperar acesso" reutilizável na tela de auth (abre por deep-link vindo de qualquer mensagem "CPF já existe").
- Melhorar a mensagem de sucesso e a orientação de SPAM.

## 7. Personalização dos e-mails de auth (Lovable Emails)

Após o domínio ficar `active`, aplicar templates React Email com marca TrailBook (cores da identidade, logo, tom claro e profissional) para: `signup`, `recovery`, `magic-link`, `email-change`. Assuntos amigáveis em pt-BR.

## Arquivos afetados

- `supabase/migrations/…_help_requests.sql` (nova tabela + RPC + policies + grants + trigger de código).
- `src/routes/auth.tsx` (mensagens, reenvio, link de ajuda, tratamento de erro CPF).
- `src/routes/help.tsx` (nova rota pública de chamado).
- `src/routes/_authenticated/complete-profile.tsx` (fluxo CPF duplicado com 3 ações + sign-out).
- `src/components/CpfConflictDialog.tsx` (novo, reutilizado nos 2 pontos).
- `src/components/ResendConfirmationButton.tsx` (novo).
- `.lovable/plan.md` atualizado com status da Fase 1.
- Após DNS verificar: templates em `supabase/functions/_shared/email-templates/*.tsx` via `scaffold_auth_email_templates`.

## Fora do escopo (Fases 2 e 3)

Admin drawer, edição de usuários, reset de senha via admin, bloqueio/reativação, exclusão de homologação, filtros avançados, integração chamados↔usuários, respostas do admin em chamados, notificações por e-mail para chamados, WhatsApp.

Ao final da Fase 1: relatório de homologação com checklist para você validar antes de eu abrir a Fase 2.
