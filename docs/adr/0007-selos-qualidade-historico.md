# ADR 0007 — Selos de Qualidade do Histórico

**Status:** Aceito · v1.0 (Fase 1 — Fundação)
**Data:** 2026-07-11

## Contexto

O TrailBook armazena documentos, timeline, plano de manutenção, cadeia de
propriedade e fotos, mas essas evidências só existem como dados brutos. Um
comprador olhando o Passaporte precisa interpretar tabelas para entender se
aquela moto é confiável. Faltava uma camada visível que traduzisse evidências
em confiança — o equivalente aos selos do Carfax nos EUA.

## Decisão

Introduzir **Selos de Qualidade do Histórico** como uma camada derivada:

1. **Registry declarativo** (`src/lib/badges/registry.ts`): cada selo é um
   objeto `BadgeDefinition` com `id`, `tier`, `glyph`, `description` e uma
   função pura `evaluate(evidence) -> { state, criteria, progress }`.
2. **Motor puro** (`src/lib/badges/evaluator.ts`): `evaluateBadges(evidence)`
   e `summarize(...)` — sem I/O, determinístico, testável.
3. **Evidências agregadas** (`src/hooks/useMotorcycleEvidence.ts`): coleta um
   `EvidenceSnapshot` a partir das tabelas existentes (documentos, eventos,
   plano/TIL, ownership_history, motorcycle_photos). Nenhuma tabela nova.
4. **UI reutilizável** (`src/components/badges/`): `BadgeChip`, `BadgeGrid`,
   `BadgeSection`, `SingleBadgeChip` — todos consomem o registry.

### Selos da Fase 1

| ID | Tier | Critérios |
|---|---|---|
| `origin_proven` | bronze | Documento de origem ativo (NF ou Recibo) |
| `documentation_complete` | silver | Todos os `RECOMMENDED_DOC_TYPES` |
| `timeline_rich` | silver | ≥ 5 eventos + primeiro evento registrado |
| `maintenance_on_track` | gold | Sem vencidos + sem alerta alto |
| `ownership_chain_intact` | silver | Cadeia sem lacunas + owner atual aberto |
| `official_photos` | bronze | Capa definida + ≥ 3 fotos |
| `trailbook_verified` | signature | Origem + Docs + Cadeia (agregador) |

### Princípios invioláveis

- **Conquista é consequência, nunca ação.** Selos são derivados de evidências
  reais — não existe endpoint para "conceder" ou "revogar" manualmente.
- **Coerência com Preservação de Histórico.** Se um documento é rebaixado
  respeitando `mem://principles/preservacao-historico`, o selo cai junto —
  sem inconsistência.
- **Extensibilidade.** Novos selos = novo objeto no registry. Nenhum
  componente muda.

## Consequência

- Passaporte Digital agora exibe a grade completa como diferencial público
  para o comprador.
- Central, Saúde e Documentos usam chips do mesmo registry — visual único.
- `OriginProvenBadge` foi removido em favor do chip `origin_proven` do
  registry (fonte única).
- Persistência de conquista, notificações e integração com Certificados PDF
  ficam para Fase 2, sobre a mesma fundação (nenhuma refatoração exigida).

## Alternativas consideradas

- **Tabela `motorcycle_badges` populada por triggers** — rejeitado na Fase 1:
  cria duplicação de estado e conflita com o princípio de Preservação de
  Histórico. Será revisitado na Fase 2 apenas se surgir necessidade real de
  congelar o snapshot em um certificado imutável.
- **Selos com conquista manual pelo usuário** — rejeitado: elimina o valor
  probatório e vira gamificação vazia.
- **Motor com side-effects (fetch dentro de `evaluate`)** — rejeitado: quebra
  determinismo, dificulta testes e SSR.