# Ambiente Permanente de Homologação — TrailBook

Convenções, contas e cenários oficiais para QA, regressão e validação.

> **Nunca use este ambiente para demonstrações comerciais** — isso é papel do Demo Mode (futuro).

## Como operar

1. Entre como admin em `/admin/homolog`.
2. Clique em **Provisionar ambiente** — cria/atualiza contas e motos (idempotente).
3. Para zerar as motos, digite `RESETAR HOMOLOG` e clique em **Resetar** (as contas ficam preservadas).

## Convenções

| Recurso | Regra |
|---|---|
| E-mails | `*@homolog.trailbook.test` |
| Nomes | Prefixo `[HOMOLOG]` |
| Flag | `is_homologation = true` em `profiles` e `motorcycles` |
| Chassi fictício | `HOMOLOG` + 10 dígitos (não colide com VIN real de 17) |
| Placa fictícia | `HOM****` |

## Contas

| Chave | Email | Uso |
|---|---|---|
| A | vendedor.a@homolog.trailbook.test | Vendedor / proprietário |
| B | comprador.b@homolog.trailbook.test | Comprador TrailBook |
| C | externo.c@homolog.trailbook.test | Comprador externo simulado |
| D | frota.d@homolog.trailbook.test | Múltiplas motos |
| E | novo.e@homolog.trailbook.test | Onboarding, sem motos |

Senhas são aleatórias e privadas. Para login, o admin deve gerar um magic link via `supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email })` ou definir manualmente uma senha via Auth Admin API.

## Motocicletas

| Slug | Dono | Cenário |
|---|---|---|
| M1 | A | Moto nova, sem histórico |
| M2 | A | Histórico completo (manutenções + docs + certificado) |
| M3 | A | Arquivada (transferida para externo) |
| M4 | A | Com pendências (sem documento de origem) |
| M5 | D | Múltiplos proprietários |
| M6 | A | Em negociação ativa (Smart Receipt `awaiting_acceptance`) |
| M7 | B | Venda concluída (histórico) |
| M8 | D | Manutenção vencida |
| M9 | D | Recém cadastrada |
| M10 | D | Crítica — muitas pendências + timeline densa |

## Política

**Toda nova funcionalidade deve incluir pelo menos um cenário aqui antes de ser considerada homologada.**
Se a feature não couber em nenhuma moto atual, adicione um novo slug em `src/lib/homolog.functions.ts` e rode `Provisionar ambiente` novamente.

## Ver também

- [ADR 0005](../adr/0005-ambiente-permanente-homologacao.md)
- Fonte: `src/lib/homolog.functions.ts`
- UI: `/admin/homolog`