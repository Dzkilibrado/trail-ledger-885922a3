# Selos de Qualidade do Histórico — Fase 1 (Fundação)

Entrega focada em **arquitetura escalável + primeiros selos reais**, integrada onde já há valor imediato. Nada de conquista manual — todos são avaliados automaticamente a partir de evidências que já existem no banco.

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
3. **Histórico Cronológico** — timeline com ≥ N eventos e sem lacunas grandes desde o cadastro.
4. **Manutenção em Dia** — nenhum item do plano em atraso (usa `src/lib/til/health.ts`).
5. **Cadeia de Propriedade Íntegra** — `ownership_history` sem gaps + toda transferência registrada.
6. **Fotos Oficiais** — ao menos 1 foto por ângulo obrigatório.
7. **Verificado pelo TrailBook** — combinação: Origem + Documentação Completa + Cadeia Íntegra (selo "gold" agregador).

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

- **Central da Moto**: `BadgeSection` com chips ganhos (colapsa parciais/bloqueados atrás de "ver todos").
- **Passaporte Digital**: `BadgeGrid` completo (público — o que aumenta valor para comprador).
- **Certificados**: chips embutidos no cabeçalho do certificado + linha detalhando cada selo no PDF (usa `src/lib/cert-pdf.ts`).
- **Saúde da Moto**: destaque do selo "Manutenção em Dia" ligado ao índice atual da TIL.
- **Documentos**: substitui o `OriginProvenBadge` atual pelo chip do registry (mesma UI, fonte única).

Índices de Conservação e Confiabilidade ficam para uma sub-entrega: exigem definição de fórmula própria e não devem entrar sem uma passada dedicada.

## Fora de escopo (Fase 2+)

- Persistência histórica de conquistas ("conquistado em"), notificações de novo selo, gamificação, ranking, badges pagos, compartilhamento social. Todos ficam viáveis sobre esta fundação sem refatorar.
- Registrar snapshot em banco só quando surgir necessidade real (ex.: certificado imutável precisar congelar o selo naquela data).

## Homologação

- Cenários no APH: M1 (nenhum selo), M2 (histórico completo — deve ganhar quase todos), M4 (pendências — parciais claros), M8 (manutenção vencida — perde "Manutenção em Dia").
- Snapshot determinístico: dado o mesmo dado, mesma avaliação.
- Typecheck + build de produção limpos.
- Sem regressão em Central, Passaporte, Documentos, Smart Receipt.

## Entregáveis

1. `src/lib/badges/*` (registry + evaluator + critérios).
2. `useMotorcycleEvidence` + `useMotorcycleBadges`.
3. `BadgeChip / BadgeGrid / BadgeTooltip / BadgeSection`.
4. Integração nas 5 superfícies acima.
5. Migração do atual `OriginProvenBadge` para consumir o registry (sem duplicidade).
6. ADR novo: **ADR 0007 — Selos de Qualidade do Histórico** documentando registry, motor e princípio "selos são derivados de evidências".
7. Registro em memória: `mem://features/selos-qualidade` + entrada no core do índice.
