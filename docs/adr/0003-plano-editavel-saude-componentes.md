# ADR 0003 — Plano Editável, Componentes e Saúde da Moto

- Status: Aceita
- Versão: v1.2.1
- Data: 2026-07-07

## Objetivo

Transformar o Plano de Manutenção em uma experiência editável por componente,
substituindo a visão agregada por uma **arquitetura por componente independente**
e derivando a **Saúde da Moto** exclusivamente da TIL.

## Problema Anterior

- Plano tratado como bloco único, sem histórico por componente.
- Matching por nome/`includes`, sujeito a colisões silenciosas.
- Saúde calculada em múltiplos pontos da UI, sem consistência.
- Ausência de fluxo para motos usadas / seminovas.

## Solução Adotada

### Sub-fase A — Fundação
- Vínculo exclusivo por `template_item_id`.
- Histórico individual em `maintenance_items`.
- Auditoria automática de mudanças.

### Sub-fase B — Componentes
- Nova aba **Componentes** no Centro de Controle.
- `ComponentSheet` com ações rápidas (registrar manutenção, editar, desativar,
  marcar não aplica).
- Componentes personalizados (`is_custom = true`) por moto.
- Severidade (`normal`, `atencao`, `alta`, `critica`) editável.
- `InitialReviewSheet` para motos usadas.

### Sub-fase C — Saúde
- `src/lib/til/health.ts` centraliza classificação: **Excelente / Boa / Atenção
  / Crítica**.
- Buckets: Vencidos, Atenção, Sem informação, Em dia. Vencidos expandido por
  padrão.
- `HealthOverview` (rota `/motorcycles/$id/health`) substitui o painel legado.
- Cockpit exibe apenas diagnóstico + item mais crítico via `HealthHeroWidget`.

## Regras Invioláveis

- Nenhuma tela calcula saúde/plano; consomem apenas snapshot da TIL.
- Última manutenção é sempre derivada de eventos (nunca editável direto).
- Edição de um componente NUNCA impacta outros componentes.

## Impactos Positivos

- Diagnóstico determinístico e testável.
- UX simplificada: check-up em vez de tabela técnica.
- Preparação para expansão de catálogos e receitas de manutenção.

## Compatibilidade

- Motos existentes continuam válidas; migração automática por
  `template_item_id`.
- Motos sem schedules exibem estado vazio com CTA para criar/aplicar plano.

## Próximas Evoluções

- Predição de próxima manutenção usando telemetria de uso.
- Receitas de manutenção compartilháveis entre motos do mesmo modelo.