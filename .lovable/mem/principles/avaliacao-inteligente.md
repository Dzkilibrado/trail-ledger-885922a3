---
name: Avaliação inteligente (Health 4.0)
description: Estrutura obrigatória de qualquer avaliação exibida ao proprietário; proibido mostrar notas/percentuais fora do modo técnico
type: preference
---
Toda avaliação exibida ao proprietário segue: 1) O TrailBook avaliou a motocicleta,
2) Diagnóstico, 3) O que encontramos, 4) O que recomendamos, 5) Posso rodar hoje?

Estados oficiais: Sem dados suficientes (⚪), Saudável (🟢), Atenção (🟡),
Revisão recomendada (🟠), Necessita ação (🔴).

Proibido exibir ao proprietário: nota, percentual, pontuação, peso, penalização,
bonificação, índice numérico. Esses dados só aparecem no Modo Técnico (admin).

Como aplicar: usar `src/lib/ui/evaluation.ts` + `EvaluationCard`/`EvaluationPill`.
A TIL nunca é alterada — a camada de avaliação apenas traduz o que ela calculou.
