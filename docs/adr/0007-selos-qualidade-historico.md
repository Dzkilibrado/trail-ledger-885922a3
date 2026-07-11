# ADR 0007 — Selos de Qualidade do Histórico

**Status:** Aceito · v1.1 (Fase 1 — Fundação) — **HOMOLOGADA E ENCERRADA**
**Data:** 2026-07-11

## Revisão v1.1 (2026-07-11) — Homologação Fase 1

- Removido o selo `trailbook_verified` ("Verificado pelo TrailBook") do
  Registry desta fase. Ele transmitia ao usuário e ao comprador que a moto
  passou por processo oficial de validação (conferência documental,
  inspeção técnica, auditoria) — processo que ainda não existe. Para
  preservar a credibilidade da plataforma, o selo só poderá voltar quando
  houver validação real da equipe/parceiros TrailBook.
- Introduzido em seu lugar o selo `history_complete` ("Histórico
  Completo"), agregador puramente derivado das mesmas evidências (origem
  + documentação + cadeia de propriedade). Este selo é declaradamente
  **automático** e não implica auditoria oficial.
- Rótulos de tier (Bronze/Prata/Ouro/Signature) não são exibidos na UI
  nesta fase — a arquitetura permanece pronta para reintroduzí-los junto
  com selos futuros de validação real.
- **Fase 1 homologada** no APH com os cenários M1, M2, M4 e M8. Alterações
  futuras neste módulo devem entrar como nova fase.

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
| `history_complete` | signature | Origem + Docs + Cadeia (agregador automático) |

### Princípios invioláveis

- **Conquista é consequência, nunca ação.** Selos são derivados de evidências
  reais — não existe endpoint para "conceder" ou "revogar" manualmente.
- **Coerência com Preservação de Histórico.** Se um documento é rebaixado
  respeitando `mem://principles/preservacao-historico`, o selo cai junto —
  sem inconsistência.
- **Extensibilidade.** Novos selos = novo objeto no registry. Nenhum
  componente muda.

## Consequência

- Passaporte Digital exibe a grade completa (`BadgeGrid`) como diferencial
  público para o comprador — visão completa dos selos.
- Central da Moto e Saúde da Moto usam resumo enxuto (`BadgeSection`
  compact / `SingleBadgeChip`) com CTA para o Passaporte.
- Central de Documentos usa `SingleBadgeChip` para Origem + Documentação
  Completa.
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
- **Selo "Verificado pelo TrailBook" automático** — rejeitado nesta fase:
  o nome implica validação humana/oficial que ainda não ocorre. Reservado
  para futura fase que combine conferência documental, oficina homologada,
  inspeção técnica ou auditoria oficial. Enquanto não existir, o selo
  **não** aparece na UI, **não** é concedido automaticamente, **não** vai
  para Certificados nem Passaporte.

## Homologação

Fase 1 homologada no **Ambiente Permanente de Homologação (APH)** em
2026-07-11. Cenários validados:

| Cenário | Moto | Resultado esperado | Resultado obtido |
|---|---|---|---|
| M1 | Nova, sem histórico | Nenhum selo conquistado; todos `locked`/`partial` com critérios claros; score 0 | ✅ Aprovado |
| M2 | Histórico completo | Conquista de origem, documentação, cadeia e agregador `history_complete`; demais conforme dados | ✅ Aprovado |
| M4 | Pendências diversas | Selos parciais com critérios atendidos/pendentes + barra de progresso | ✅ Aprovado |
| M8 | Manutenção vencida | Perda imediata de `maintenance_on_track` ao vencer item; retorno após regularização | ✅ Aprovado |

Validado adicionalmente: determinismo do snapshot, reatividade automática a
mudanças de dados, consistência entre Central/Passaporte/Saúde/Documentos,
mobile sem cortes, console limpo, `tsgo --noEmit` limpo e build de produção
limpa.

## Regras permanentes

1. Selos são **derivados**, nunca armazenados em tabela (Fase 1).
2. Nunca criar endpoint / ação para conceder ou revogar selo manualmente.
3. Novo selo = novo objeto no registry. Se um selo exigir mudança em
   `BadgeChip`/`BadgeGrid`/`BadgeSection`, o design do registry falhou.
4. "Verificado pelo TrailBook" só volta com processo real de validação
   humana/parceiros.
5. Alterações futuras neste módulo devem entrar como **nova fase**.