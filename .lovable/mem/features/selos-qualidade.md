---
name: Selos de Qualidade do Histórico
description: Registry declarativo + motor puro de avaliação; selos são DERIVADOS de evidências, nunca armazenados
type: feature
---

Selos de Qualidade do Histórico são um dos pilares estratégicos do
TrailBook — traduzem evidências reais do banco em indicadores visuais de
confiança para o comprador ("Carfax das motos off-road brasileiras").

## Arquitetura oficial (ADR 0007)

- `src/lib/badges/types.ts` — tipos (`BadgeDefinition`, `EvidenceSnapshot`,
  `BadgeEvaluation`).
- `src/lib/badges/registry.ts` — **registry central declarativo**. Adicionar
  selo = adicionar objeto aqui.
- `src/lib/badges/evaluator.ts` — motor puro `evaluateBadges` + `summarize`.
- `src/hooks/useMotorcycleEvidence.ts` — coleta o snapshot.
- `src/hooks/useMotorcycleBadges.ts` — deriva as avaliações memoizadas.
- `src/components/badges/` — `BadgeChip`, `BadgeGrid`, `BadgeSection`,
  `SingleBadgeChip`. Nunca duplicar visual — sempre reusar.

## Regras invioláveis

1. **Conquista automática.** Nunca criar endpoint / ação de usuário para
   conceder ou revogar selo.
2. **Selos são DERIVADOS.** Não persistir em tabela `motorcycle_badges`
   (Fase 1). Se surgir necessidade de congelar em certificado imutável,
   revisitar em ADR novo.
3. **Motor puro.** `evaluate(evidence)` não pode fazer I/O, chamar Supabase
   ou depender de `Date.now()` além do já capturado no snapshot.
4. **Coerência com Preservação de Histórico.** Rebaixar documento (is_current
   = false) deve refletir imediatamente no selo — nunca cachear conquista
   antiga.
5. **Novo selo NÃO refatora componente.** Se um novo selo exigir mudança em
   `BadgeChip`/`BadgeGrid`/`BadgeSection`, o design do registry falhou —
   revise em vez de patchear a UI.
6. **"Verificado pelo TrailBook" é reservado.** Este nome só pode ser
   reintroduzido quando existir processo real de validação humana
   (conferência documental, oficina homologada, inspeção técnica ou
   auditoria). Enquanto não existir, NUNCA renderizar / conceder
   automaticamente / incluir em certificados. Selos automáticos usam nomes
   descritivos (ex.: `history_complete` = "Histórico Completo").
7. **Sem rótulos de tier na UI (Fase 1).** Bronze/Prata/Ouro/Signature
   permanecem no dado (`tier`) para peso do score e futura evolução, mas
   não são exibidos como badge textual — evita hierarquização gamificada
   sem lastro em validação real.

## Onde já está integrado

- Central da Moto (`BadgeSection` compact)
- Passaporte Digital (`BadgeSection` full — visão pública)
- Saúde da Moto (`SingleBadgeChip` — Manutenção em Dia + Origem Comprovada)
- Central de Documentos (`SingleBadgeChip` — Origem + Documentação Completa)

## Fase 2 (planejada, não implementar sem solicitação)

- Snapshot congelado em certificado imutável.
- "Conquistado em" (data) com trilha de auditoria — apenas quando exigir
  histórico legal, ex.: certificação emitida.
- Integração com Índice de Conservação e Índice de Confiabilidade (fórmulas
  próprias — não misturar sem ADR).
- Notificações "você acabou de conquistar o selo X".