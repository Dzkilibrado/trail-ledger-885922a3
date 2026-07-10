# ADR 0005 — Ambiente Permanente de Homologação (APH)

**Status:** Aceito · v1.2
**Data:** 2026-07-10

## Contexto

Cada nova fase do TrailBook exigia recriação manual de contas, motos e cenários. Isso gerava:
- retrabalho a cada validação;
- inconsistência entre rodadas de teste;
- risco de dados de teste vazarem para métricas de produção.

Além disso, homologação e demonstração comercial são preocupações diferentes que estavam se misturando.

## Decisão

Adotar um **Ambiente Permanente de Homologação** que faz parte oficial da arquitetura do TrailBook, distinto do futuro Demo Mode.

### Convenções
- Domínio dedicado: `@homolog.trailbook.test` (contas fictícias).
- Prefixo `[HOMOLOG]` em nomes de contas e apelidos de moto.
- Flag técnica reaproveitada: `profiles.is_homologation` + `motorcycles.is_homologation` (já existentes).
- Nunca compartilha dados com contas reais.

### Estrutura mínima
- 5 contas: Vendedor A, Comprador B, Externo C, Frota D, Novo E.
- 10 motocicletas cobrindo: nova, com histórico completo, arquivada, com pendências, múltiplos proprietários, em negociação, venda concluída, manutenção vencida, recém cadastrada, crítica.

### Operação
- Provisionamento e reset via `/admin/homolog` (server functions `seedHomologEnvironment` / `resetHomologEnvironment` protegidas por `requireSupabaseAuth` + verificação de admin).
- Idempotente: reexecutar não duplica.
- Reset apaga apenas registros marcados com `is_homologation = true`.

## Consequência

- Toda nova funcionalidade deve incluir pelo menos um cenário no APH antes de ser considerada homologada.
- Métricas, dashboards e exports podem filtrar `is_homologation = false` para excluir sandbox.
- Demo Mode (futuro) permanece separado: mesmas convenções não se aplicam.

## Alternativas consideradas

- Coluna `is_sandbox` nova → rejeitado: `is_homologation` já cobria o caso.
- Schema separado (`homolog.*`) → rejeitado: aumenta complexidade de RLS/queries sem ganho real.
- Projeto Supabase paralelo → rejeitado: dobra custo operacional e dificulta reproduzir bugs de produção.