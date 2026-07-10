# Evolução do Cadastro de Usuários — Plano por Fases

Baseado na especificação enviada. Princípio-guia: **informar uma vez, reutilizar sempre**; **Seleção → Autocomplete → Texto livre**; Mobile First.

## Situação atual (mapeada)

Tabela `public.profiles` já possui: `full_name`, `email`, `phone`, `cpf`, `birth_date`, `avatar_url`, `plan`, `status`, `login_provider`.

Faltam para atender a especificação: `display_name`, `whatsapp`, `uf`, `city`, `ibge_code`, `cep`, `bairro`, `logradouro`, `numero`, `complemento`, `profile_completed_at`, `cpf_locked_at`.

Fluxos atuais:
- `/_authenticated/complete-profile` já pede `full_name + cpf + birth_date + phone` para contas Google — servirá de base para o wizard.
- `LocationPicker` (UF/Cidade IBGE) já está pronto e homologado no Smart Receipt — será reaproveitado no cadastro e nos demais módulos.

## Fase A — Modelo de dados e SSOT do perfil

**Objetivo:** ampliar `profiles` e criar contrato único de leitura.

- Migração acrescentando colunas: `display_name`, `whatsapp text`, `whatsapp_same_as_phone bool`, `uf char(2)`, `city text`, `ibge_code text`, `cep text`, `bairro text`, `logradouro text`, `numero text`, `complemento text`, `profile_completed_at timestamptz`, `cpf_locked_at timestamptz`.
- Trigger: quando `cpf` passa de NULL→valor, gravar `cpf_locked_at = now()`. Bloquear UPDATE de `cpf` quando já travado (exceção: `service_role`, para o fluxo de suporte).
- Função `public.profile_completeness(_user uuid)` → `{ pct int, missing text[] }` para alimentar barra de progresso e gate de rotas.
- RLS: mantida (SELECT/UPDATE só do próprio dono, admin via `has_role`). GRANTs revisados.

## Fase B — Wizard de cadastro (mobile-first)

**Objetivo:** substituir `complete-profile` por wizard de 4 passos alinhado à spec.

Passos:
1. **Dados pessoais** — nome completo, apelido (opcional), CPF, data de nascimento.
2. **Contato** — e-mail (readonly quando vindo do provedor), telefone, WhatsApp com toggle "igual ao telefone".
3. **Localização** — UF + Cidade via `LocationPicker` (IBGE); campos de endereço (CEP/bairro/logradouro/número/complemento) presentes mas colapsáveis ("Adicionar endereço completo — opcional agora").
4. **Revisão** — resumo + confirmação.

Componentes:
- `WizardShell` (progresso, voltar/avançar, salvamento parcial em `profiles`).
- Barra superior com % de completude e lista de pendências (consumo de `profile_completeness`).
- Validações amigáveis: CPF válido/único, e-mail válido/único, idade mínima, telefones BR, UF+Cidade obrigatórios.

## Fase C — Gate global de perfil incompleto

**Objetivo:** garantir que usuários existentes completem os obrigatórios.

- No layout `_authenticated/route.tsx`, após checar sessão, consultar `profile_completeness`. Se faltarem campos obrigatórios, redirecionar para `/complete-profile` (wizard) — exceto rotas `/help`, `/messages` (suporte) e `/auth`.
- Tela exclusiva de atualização mostra % e a lista exata do que falta (reuso do wizard, entrando no primeiro passo pendente).

## Fase D — Reutilização automática nos módulos

**Objetivo:** eliminar redigitação. Nenhum módulo altera o perfil ao editar dados da operação corrente.

- Criar hook `useProfileSnapshot()` que devolve os campos padronizados do usuário (nome, CPF mascarado, UF/Cidade, telefone, endereço).
- Pré-preencher, com override local (sem persistir de volta em `profiles`):
  - **Smart Receipt** — vendedor (quando o usuário é o vendedor) e local da negociação sugerido como Cidade/UF do perfil.
  - **Certificados / Passaporte** — dados do titular.
  - **Transferências / Ownership** — parte que representa o usuário logado.
  - **Documentos / Chamados** — solicitante.
- Cada formulário exibe um chip "Usando dados do seu perfil — editar só nesta operação".

## Fase E — Alteração de CPF via suporte

**Objetivo:** CPF imutável pelo usuário após validado.

- UI do perfil: campo CPF readonly com link "Solicitar alteração" que abre chamado pré-preenchido no módulo de tickets (categoria `profile_cpf_change`).
- Backoffice (`admin.users`): ação "Alterar CPF" com motivo obrigatório, gravando `admin_user_events` (`action: 'profile_cpf_changed'`) e auditoria.

## Fase F — Documentação e homologação

- ADR 0006 — Cadastro Unificado e Reutilização de Dados.
- Atualizar `.lovable/plan.md`, `CHANGELOG.md`, `docs/homologacao/README.md`.
- Registrar memórias: `mem://principles/informar-uma-vez` e `mem://features/cadastro-usuario`.
- Checklist de homologação por fase (funcional, RLS, mobile, typecheck, console).

## Detalhes técnicos

- Reaproveitar `LocationPicker`, `br-validators` (CPF/telefone) e padrão de `Sheet` já homologados.
- Nenhuma alteração em `auth`/`storage`/`realtime`.
- CEP: preparar coluna e UI, mas integração com serviço de CEP entra só em fase futura (fora deste plano).
- Sem breaking changes em RLS: novos campos herdam as políticas atuais de `profiles`.

## Sequência sugerida de entrega

1. Fase A (schema + `profile_completeness`).
2. Fase B (wizard).
3. Fase C (gate global).
4. Fase D (reutilização por módulo — começar por Smart Receipt e Certificados).
5. Fase E (fluxo de suporte para CPF).
6. Fase F (docs + homologação final).

Cada fase encerra com typecheck limpo, teste mobile no preview e registro no changelog. Aguardo aprovação para iniciar pela Fase A.
