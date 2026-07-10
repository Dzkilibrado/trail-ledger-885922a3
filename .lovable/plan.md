# TrailBook — Plano oficial

## Status por fase

| Fase | Escopo | Status |
|---|---|---|
| 1.0 | Cadastro, Passaporte, Timeline, Manutenções | ✅ Homologada |
| 1.1 | Cockpit + TIL + Plano editável + Componentes + Saúde | ✅ Homologada |
| 1.2 | **Smart Receipt (Recibo Inteligente)** | ✅ **HOMOLOGADA E ENCERRADA em 2026-07-10** |
| APH | Ambiente Permanente de Homologação | ✅ Operacional (ADR 0005) |

> **Smart Receipt Fase 1.2 está encerrada.** Não realizar novas alterações neste módulo sem nova solicitação formal. Detalhes do escopo entregue e cenários homologados em [CHANGELOG.md](../CHANGELOG.md) e [docs/homologacao/README.md](../docs/homologacao/README.md).

---

# Ambiente Permanente de Homologação (APH) do TrailBook

Antes de executar a homologação end-to-end da Fase 1.2, quero alinhar o escopo do **Ambiente Permanente de Homologação** — porque ele passa a fazer parte oficial da arquitetura e envolve criação de usuários reais no `auth.users`, seed de dados e um harness de testes que vai ser reutilizado em todas as próximas fases. Preferível acertar o formato agora do que refazer depois.

## 1. Convenções de identificação

- Domínio de e-mail dedicado: `@homolog.trailbook.test` — nunca colide com contas reais.
- Prefixo em todos os nomes: `[HOMOLOG]` (ex.: `[HOMOLOG] Vendedor A`, `[HOMOLOG] XR 250 Tornado`).
- Flag técnica: coluna `is_sandbox boolean default false` em `profiles` e `motorcycles` (migração dedicada). Permite:
  - filtrar dashboards/admin para esconder dados de homologação da visão "real";
  - script de reseed idempotente (apaga só onde `is_sandbox = true`);
  - relatórios de métricas ignorarem sandbox.
- Chassi fictício padronizado: `HOMOLOG` + 10 dígitos (não colide com VIN real de 17).

## 2. Contas de homologação

Criadas via `supabaseAdmin.auth.admin.createUser` com `email_confirm: true` e senha padrão de sandbox (armazenada apenas no seed, nunca em código versionado — usa `HOMOLOG_SEED_PASSWORD` como secret).

| Conta | Email | Papel | Uso |
|---|---|---|---|
| A | `vendedor.a@homolog.trailbook.test` | user | Vendedor (proprietário) |
| B | `comprador.b@homolog.trailbook.test` | user | Comprador TrailBook |
| C | `externo.c@homolog.trailbook.test` | user | Comprador externo simulado (fica só no snapshot) |
| D | `frota.d@homolog.trailbook.test` | user | Múltiplas motos |
| E | `novo.e@homolog.trailbook.test` | user | Onboarding, sem motos |
| ADMIN | conta atual | admin | Já existe, usada como orquestrador |

Idempotente: se já existir, reaproveita `id`.

## 3. Motocicletas seed (todas `is_sandbox = true`, prefixo `[HOMOLOG]`)

- M1 — Nova (Conta A) — sem histórico
- M2 — Usada com histórico completo (Conta A) — 3 manutenções, 2 documentos, certificado
- M3 — Arquivada (ex-Conta A, transferida para externo)
- M4 — Com pendências (Conta A) — sem doc de origem
- M5 — Múltiplos proprietários (Conta D) — ownership_history com 3 entradas
- M6 — Em negociação ativa (Conta A → Conta B, receipt em `awaiting_acceptance`)
- M7 — Negociação concluída (histórico) — receipt `completed`
- M8 — Manutenção vencida (Conta D)
- M9 — Recém cadastrada (Conta D)
- M10 — Crítica (Conta D) — múltiplas pendências + timeline densa

## 4. Entregáveis técnicos

1. **Migração** `..._sandbox_flags.sql`:
   - `alter table profiles add column is_sandbox boolean not null default false;`
   - `alter table motorcycles add column is_sandbox boolean not null default false;`
   - índice parcial `where is_sandbox = true`.
2. **Seed script** `scripts/homolog/seed.ts` — idempotente, roda via `bun run homolog:seed`:
   - cria/atualiza contas via admin API;
   - cria/atualiza motos M1..M10 com todos os anexos (documentos, eventos, ownership_history, smart_receipts, certificates);
   - reset opcional com `HOMOLOG_RESET=1` (deleta tudo `where is_sandbox = true` e recria).
3. **Harness Playwright** `scripts/homolog/e2e/`:
   - `login.ts` helper (usa `supabaseAdmin.auth.admin.generateLink` para minter magic link, evita depender de UI de senha);
   - suíte `smart-receipt.spec.ts` cobrindo os 3 cenários (TB↔TB, externo, revogação);
   - roda com `bun run homolog:e2e`;
   - captura screenshots em `/mnt/documents/homolog/<timestamp>/`.
4. **Documentação** `docs/homologacao/README.md` + ADR `0005-ambiente-permanente-homologacao.md`:
   - convenções, como rodar, como estender, política "toda nova feature ganha ao menos 1 cenário aqui".
5. **Atualização do `.lovable/plan.md`** e **`mem://index.md`** registrando o APH como parte permanente.

## 5. Execução da homologação Fase 1.2

Depois do APH estar de pé, executo:

- **Cenário 1** — Venda TB↔TB (A vende para B): draft → issued → awaiting_acceptance → completed, com queries de `owner_id`, `ownership_history`, `events (ownership_transfer)`, `smart_receipts.status` entre cada etapa.
- **Cenário 2** — Venda externa (A vende para C sem conta): completed → moto arquivada, sem owner fictício.
- **Cenário 3** — Cancelamento + Substituição + Revogação.
- **Idempotência** — completar 2x, garantir 1 evento apenas.
- **RLS** — tentar ler receipt de outro user como B enquanto está draft de A (deve falhar).
- **Página pública** `/r/$code` — hash, QR, status.
- **Mobile** — screenshots 375×812.

Cada cenário gera: resultado item-a-item, snapshots de DB antes/depois, screenshots, bugs encontrados + correções aplicadas.

## 6. O que NÃO vou fazer nesta rodada

- Não vou construir Demo Mode (é outro conceito, como você já separou).
- Não vou adicionar UI de administração de sandbox no app — o APH é orquestrado por scripts + admin API. Se depois quiser um painel `/admin/sandbox`, entra em fase própria.
- Não vou automatizar CI ainda (rodada é local/manual via bun); ADR já deixa isso registrado como próximo passo.

## 7. Pergunta única antes de prosseguir

Preciso gerar/salvar o secret `HOMOLOG_SEED_PASSWORD` (senha padrão das contas de sandbox, usada só no seed). Posso usar `generate_secret` para mintar uma senha aleatória forte automaticamente — as contas ficam acessíveis via magic link no harness, então você nunca precisa digitá-la. Ok?

Se aprovar este plano, sigo na ordem: (1) migração de flags, (2) seed script, (3) harness + execução Cenário 1..3, (4) relatório final com evidências.