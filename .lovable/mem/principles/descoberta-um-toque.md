---
name: Descoberta em um toque
description: Princípio permanente de UX — o usuário compreende qualquer funcionalidade em até um toque.
type: preference
---

## Princípio

"O TrailBook deve ser intuitivo. Sempre que um usuário encontrar um
termo, botão, indicador ou funcionalidade que possa gerar dúvida, ele
deverá conseguir compreender seu significado em até um toque."

## Como aplicar

Sempre que existir um termo que possa gerar dúvida:

1. Renomear o termo para algo mais intuitivo (preferido); **ou**
2. Adicionar `HelpTooltip` ao lado do termo.

A interface ensina; a FAQ complementa; o suporte é a última alternativa.

**Why:** curva de aprendizado próxima de zero é requisito
arquitetural. Se o usuário precisar perguntar o significado de algo, a
UX falhou — não o suporte.

## Referência

- ADR 0009 — Help Tooltips e Princípio da Descoberta em Um Toque.
- Padrão operacional: `mem://standards/help-tooltips`.