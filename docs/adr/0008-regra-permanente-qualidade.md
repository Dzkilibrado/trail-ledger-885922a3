# ADR 0008 — Regra Permanente de Qualidade

**Status:** Aprovado — vigente a partir de v1.5 (2026-07-11)
**Contexto:** TrailBook consolidou princípios de UX, evolução controlada,
preservação de histórico e selos derivados. Faltava um checklist único,
obrigatório antes de qualquer homologação, para evitar que features
entrem em produção com regressões de UX, mobile ou comunicação.

## Decisão
Toda nova funcionalidade (ou alteração relevante) deve passar por cinco
revisões obrigatórias antes de ser considerada homologada:

1. **Funcional** — regras de negócio, fluxos, integrações, segurança/permissões.
2. **UX** — clareza, cliques mínimos, descoberta, consistência.
3. **Mobile** — responsividade, sem cortes, sem scroll horizontal, área de toque.
4. **Comunicação** — linguagem simples, tooltips, FAQ, documentação de ajuda.
5. **Final** — console limpo, `tsgo` limpo, build limpo, sem regressões, fluxo validado por usuário comum, docs/CHANGELOG/ADR/roadmap atualizados quando aplicável.

Detalhamento operacional em `.lovable/mem/standards/qualidade-oficial.md`.

## Consequências
- Qualquer PR ou entrega precisa listar explicitamente as cinco etapas.
- Uma funcionalidade que passe apenas em testes automatizados mas falhe
  em UX/Mobile/Comunicação **não é homologada**.
- Convive com as diretrizes já existentes (`dev-directives`, `ux-official`,
  `evolucao-controlada`, `preservacao-historico`, `linguagem-oficial`) —
  esta ADR é o "portão final".

## Relação com outras ADRs
- Complementa ADR 0004 (Mobile Native First) reforçando a etapa 3.
- Complementa ADR 0005 (APH) — a etapa 5 exige validação em cenário APH.
- Complementa ADR 0007 — selos e evidências entram no escopo funcional.

## Escopo fora
- Não define métricas quantitativas (tempo, cliques exatos). É um checklist
  qualitativo que exige julgamento de produto.