# Architecture Decision Records (ADR)

Este diretório mantém o **histórico permanente das decisões arquiteturais** do
TrailBook. Cada ADR documenta uma decisão relevante já homologada e serve como
referência obrigatória para evoluções futuras, evitando regressões e
preservando o racional das escolhas feitas.

## Convenções

- Nome do arquivo: `NNNN-titulo-curto.md` (numeração sequencial, começando em `0001`).
- Uma ADR por decisão. Decisões descartadas ou substituídas não são apagadas —
  são marcadas com `Status: Substituída por ADR NNNN` e mantidas para histórico.
- Estrutura mínima de cada ADR:
  1. Objetivo da mudança
  2. Problema anterior
  3. Solução adotada
  4. Alternativas avaliadas
  5. Motivo da decisão
  6. Impactos positivos
  7. Compatibilidade
  8. Riscos conhecidos
  9. Próximas evoluções previstas

## Índice

| ADR | Título | Status | Versão |
| --- | --- | --- | --- |
| [0001](./0001-recomposicao-cronologica-timeline.md) | Recomposição cronológica da timeline como padrão oficial | Aceita | v1.1 |
| [0002](./0002-cockpit-e-til.md) | TrailBook Cockpit + Intelligence Layer (TIL) | Aceita | v1.2 |