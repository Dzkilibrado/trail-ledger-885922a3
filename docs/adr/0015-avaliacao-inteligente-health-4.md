# ADR 0015 — TrailBook Health 4.0: da nota para a avaliação inteligente

Status: aceito · v1.9.0

## Contexto
O Índice de Conservação era exibido ao proprietário como nota/percentual.
O usuário não deve interpretar números — o TrailBook deve interpretar e comunicar.

## Decisão
Toda funcionalidade que apresenta uma avaliação segue obrigatoriamente esta ordem:

1. O TrailBook avaliou a motocicleta
2. Diagnóstico
3. O que encontramos durante a avaliação?
4. O que recomendamos fazer agora?
5. Posso rodar hoje?

Estados oficiais: ⚪ Sem dados suficientes · 🟢 Saudável · 🟡 Atenção · 🟠 Revisão recomendada · 🔴 Necessita ação.

Camada de apresentação: `src/lib/ui/evaluation.ts` (+ `EvaluationCard`, `EvaluationPill`).
Ela apenas traduz o resultado já calculado pela TIL.

## Modo Técnico
Índice de Conservação, confiabilidade numérica, pesos, penalizações, bonificações,
auditoria e snapshot ficam restritos a administradores (`useIsAdmin`).

## Consequências
Nenhuma regra da TIL, snapshot, auditoria, validade, telemetria ou compartilhamento
foi alterada. A mudança é exclusivamente de UX/UI.
