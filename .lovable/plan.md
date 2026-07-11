# Selos de Qualidade do Histórico — Fase 1 (Fundação) — **HOMOLOGADA E ENCERRADA**

Entrega focada em **arquitetura escalável + primeiros selos reais**, integrada onde já há valor imediato. Nada de conquista manual — todos são avaliados automaticamente a partir de evidências que já existem no banco.

> **Status:** Fase 1 homologada em 2026-07-11. Alterações futuras neste módulo devem entrar como nova fase.

## Princípios

- **Registry central**: cada selo é uma definição declarativa (id, título, tooltip, ícone, tier, critérios). Adicionar um novo selo = adicionar um objeto no registry, sem tocar em componentes.
- **Motor puro e determinístico**: recebe um `MotorcycleEvidence` snapshot e retorna `BadgeEvaluation[]` (earned / partial / locked + critérios atendidos/pendentes). Zero side-effects, testável.
- **Evidências agregadas**: um único hook `useMotorcycleEvidence(motoId)` monta o snapshot a partir do que já existe (documentos, manutenções, timeline, transferências, fotos, cadastro). Nunca cria tabelas novas nessa fase.
- **UI reutilizável**: um `BadgeChip` + `BadgeGrid` + `BadgeTooltip` compartilhados por Central, Passaporte, Certificados e Saúde. Sem duplicar visual.
- **Conquista é consequência**: selos não são armazenados; são derivados. Isso garante que dados apagados/rebaixados (respeitando `mem://principles/preservacao-historico`) reflitam imediatamente no selo.

## Selos iniciais (Fase 1)

Todos derivados de dados que já existem:

1. **Origem Comprovada** — `is_origin_document = true` ativo. (Substitui o `OriginProvenBadge` atual usando o mesmo registry.)
2. **Documentação Completa** — todos os `RECOMMENDED_DOC_TYPES` presentes e ativos.
3. **Histórico Cronológico** — timeline com ≥ 5 eventos e primeiro evento registrado.
4. **Manutenção em Dia** — nenhum item do plano em atraso e sem alerta alto (usa `src/lib/til/health.ts`).
5. **Cadeia de Propriedade Íntegra** — `ownership_history` sem gaps + owner atual aberto.
6. **Fotos Oficiais** — capa definida + ≥ 3 fotos.
7. **Histórico Completo** — agregador automático: Origem + Documentação Completa + Cadeia Íntegra.

> **Nota:** "Verificado pelo TrailBook" foi deliberadamente removido da Fase 1. Só retorna quando houver processo real de validação humana/parceiros.

Cada selo publica critérios legíveis: "✔ Nota Fiscal anexada", "✖ Manual do proprietário pendente", etc.

## Arquitetura técnica

```text
src/lib/badges/
  types.ts             BadgeId, BadgeDefinition, Criterion,
                       BadgeEvaluation, EvidenceSnapshot, BadgeTier
  registry.ts          BADGES: BadgeDefinition[]  (declarativo)
  evaluator.ts         evaluateBadges(evidence) -> BadgeEvaluation[]
  criteria/            um arquivo por família de critérios
    origin.ts
    documentation.ts
    timeline.ts
    maintenance.ts
    ownership.ts
    photos.ts

src/hooks/
  useMotorcycleEvidence.ts   snapshot agregado (React Query)
  useMotorcycleBadges.ts     evidence -> evaluations (memoizado)

src/components/badges/
  BadgeChip.tsx        pílula compacta (usada em headers)
  BadgeGrid.tsx        grade de selos com estado (earned/partial/locked)
  BadgeTooltip.tsx     conteúdo do tooltip: significado + atendidos + pendentes
  BadgeSection.tsx     bloco "Selos de Qualidade" reusável
```

### Contratos essenciais

```ts
type BadgeTier = "bronze" | "silver" | "gold" | "signature";
type CriterionState = "met" | "unmet" | "n/a";

type BadgeDefinition = {
  id: BadgeId;
  title: string;
  short: string;         // chip label
  tier: BadgeTier;
  icon: LucideIcon | string;
  description: string;   // "o que significa"
  evaluate: (e: EvidenceSnapshot) => {
    state: "earned" | "partial" | "locked";
    criteria: { label: string; state: CriterionState }[];
  };
};

type BadgeEvaluation = BadgeDefinition & ReturnType<BadgeDefinition["evaluate"]>;
```

## Integrações desta fase

- **Central da Moto**: `BadgeSection` compact — resumo enxuto dos selos conquistados + CTA "Ver todos os selos" para o Passaporte.
- **Passaporte Digital**: `BadgeGrid` completo (público — o que aumenta valor para comprador).
- **Saúde da Moto**: `SingleBadgeChip` de Manutenção em Dia + Origem Comprovada.
- **Documentos**: substitui o `OriginProvenBadge` atual pelo chip do registry (mesma UI, fonte única).

> Certificados e Índices de Conservação/Confiabilidade ficam para Fase 2+: exigem definição de fórmula própria e não devem entrar sem uma passada dedicada.

## Fora de escopo (Fase 2+)

- Persistência histórica de conquistas ("conquistado em"), notificações de novo selo, gamificação, ranking, badges pagos, compartilhamento social. Todos ficam viáveis sobre esta fundação sem refatorar.
- Registrar snapshot em banco só quando surgir necessidade real (ex.: certificado imutável precisar congelar o selo naquela data).

## Homologação — **APROVADA**

- **M1** (moto nova sem histórico): nenhum selo conquistado; todos em `locked`/`partial` com critérios claros; score 0.
- **M2** (histórico completo): conquista de `origin_proven`, `documentation_complete`, `ownership_chain_intact` e `history_complete`; demais conforme dados.
- **M4** (pendências): selos parciais exibem critérios atendidos/pendentes + progresso.
- **M8** (manutenção vencida): perda imediata de `maintenance_on_track` ao vencer item; retorno após regularização.
- Snapshot determinístico: dado o mesmo dado, mesma avaliação.
- Reatividade automática a mudanças de dados sem refresh manual.
- Consistência entre Central, Passaporte, Saúde e Documentos.
- Typecheck + build de produção limpos; console limpo; mobile sem cortes.
- Sem regressão em Central, Passaporte, Documentos, Smart Receipt.

## Entregáveis concluídos

1. `src/lib/badges/*` (registry + evaluator).
2. `useMotorcycleEvidence` + `useMotorcycleBadges`.
3. `BadgeChip / BadgeGrid / BadgeTooltip / BadgeSection / SingleBadgeChip`.
4. Integração em Central, Passaporte, Saúde e Documentos.
5. Migração do `OriginProvenBadge` para o registry.
6. **ADR 0007** documentando registry, motor e princípios.
7. Registro em memória: `mem://features/selos-qualidade` + entrada no core do índice.

## Próximas fases (não implementar sem solicitação)

- Fase 2: persistência histórica de conquistas, notificações, snapshot em certificado imutável, selos de validação humana/parceiros (incluindo eventual "Verificado pelo TrailBook"), índices de Conservação/Confiabilidade.
