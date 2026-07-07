# ADR 0002 — TrailBook Cockpit + Intelligence Layer (TIL)

- **Status:** Aceita
- **Data:** 2026-07-07
- **Versão de entrega:** v1.2 (em implementação)
- **Autores:** Equipe TrailBook

## 1. Objetivo

Estabelecer o **Cockpit** como centro oficial da experiência do TrailBook e a
**TrailBook Intelligence Layer (TIL)** como única fonte de cálculos,
indicadores, agenda, alertas e previsões. A meta é responder, em até 30
segundos, às perguntas: "Minha moto está boa? Preciso fazer manutenção?
Quanto rodou? Quanto gastei? Existe alerta?" — sem que o usuário precise
navegar ou aprender o sistema.

## 2. Problema anterior

A tela de detalhe da moto acumulava múltiplos cards, gráficos e informações
redundantes; cálculos estavam espalhados por componentes; o usuário
precisava procurar o que era importante. Isso viola a filosofia oficial do
projeto (mais funcionalidades ⇒ MAIS simples) e a Regra dos 30 segundos.

## 3. Solução adotada

### 3.1 Cockpit (camada de apresentação)

- Uma única tela principal por moto, com hierarquia enxuta:
  1. **Cartão-herói de saúde**: índice (%), frase única de estado,
     próxima manutenção com CTA único ("Registrar manutenção").
  2. **Linha secundária**: última atividade · horímetro · KM · próximo alerta.
  3. Nada mais — apenas se necessário.
- Toque no cartão-herói abre o **Centro de Controle** com abas:
  Saúde · Manutenção · Agenda · Histórico · Documentação · Custos · Alertas.
- Composto internamente por **Widgets** (arquitetura), mas o usuário não
  percebe isso — sem grid configurável, sem "arraste para reorganizar".
- Personalização mínima: fixar favoritos, ocultar painel, restaurar padrão.
- Mobile-first: layout desenhado para 375px primeiro; desktop é adaptação.

### 3.2 TrailBook Intelligence Layer (TIL)

- Módulo TypeScript sob `src/lib/til/`:
  - `health.ts` — índice de saúde (0–100) e frase de estado.
  - `schedule.ts` — próxima manutenção, agenda ordenada, vencidos/próximos.
  - `alerts.ts` — alertas priorizados (manutenção vencida, documento
    vencendo, plano não revisado, etc.).
  - `usage.ts` — horímetro/KM atuais, uso recente, média diária/mensal.
  - `costs.ts` — total gasto, por categoria, por período.
  - `suggestions.ts` — próxima ação sugerida ("Registrar agora",
    "Revisar plano", "Renovar documento").
  - `index.ts` — fachada `getCockpit(motoId)` que retorna um snapshot
    tipado consumido pelo Cockpit.
- Regras:
  - Nenhum componente calcula. Componentes só leem o snapshot da TIL.
  - TIL é pura (funções determinísticas sobre dados já carregados) — sem
    efeitos colaterais, sem fetch dentro de widgets.
  - Consultas ao backend acontecem em loaders/hooks; a TIL recebe os
    dados como entrada e retorna o snapshot.
  - Testável isoladamente e pronta para receber lógica de IA no futuro
    (mesma fachada, implementação evolui).

### 3.3 Widgets

- Cada bloco visível do Cockpit é um Widget React sob
  `src/components/cockpit/widgets/`.
- Widget = função pura de `(snapshotTIL) → JSX`. Sem estado próprio além
  de UI local (aberto/fechado).
- Registro central em `src/components/cockpit/registry.ts` para permitir
  novos widgets (Oficina, Eventos, Seguro, Localização, Marketplace, IA)
  sem alterar a arquitetura.

### 3.4 Inteligência de ação

- A TIL sempre expõe `nextAction` no snapshot; o Cockpit renderiza o CTA
  correspondente. O usuário nunca procura a ação.

## 4. Alternativas avaliadas

| Alternativa | Motivo da rejeição |
| --- | --- |
| Dashboard tradicional com muitos cards e gráficos | Contradiz a filosofia e a Regra dos 30 segundos. |
| Manter cálculos nos componentes com hooks compartilhados | Duplicação, difícil evoluir para IA, difícil testar. |
| Grid de widgets configurável pelo usuário | Excesso de configuração = confusão; personalização fica em 3 ações. |
| Server-side rendering dos indicadores (edge fn dedicada) | Fora de escopo agora; TIL client-side já atende com dados carregados via TanStack Query. |

## 5. Motivo da decisão

- Alinha 100% com a filosofia oficial e a Regra dos 30 segundos.
- Separa apresentação (Cockpit) de raciocínio (TIL), habilitando IA
  futuramente sem reescrever telas.
- Widgets permitem crescimento sem alterar arquitetura.

## 6. Impactos positivos

- Interface drasticamente mais leve.
- Regra clara: "telas não calculam".
- Base sólida para novos módulos (Oficina, Eventos, Seguro, IA).
- Testes de negócio ficam concentrados na TIL.

## 7. Compatibilidade

- A rota atual `/_authenticated/motorcycles/$id` passa a renderizar o
  Cockpit. O conteúdo detalhado migra para o Centro de Controle
  (`.../$id/control/*` ou tabs internas — decidir na implementação).
- Dados existentes não mudam; a TIL consome os mesmos modelos.
- ADR 0001 (recomposição cronológica) permanece vigente e é consumida
  pela TIL.

## 8. Riscos conhecidos

- Migrar telas existentes sem regredir informações que o usuário já usa
  hoje. Mitigação: Centro de Controle preserva todo detalhe atual.
- Custo de cálculo no client em históricos longos. Mitigação: memoização
  por moto + snapshot cacheado por TanStack Query.
- Tentação de reintroduzir cards ao longo do tempo. Mitigação: filosofia
  gravada em memória do projeto + revisão obrigatória contra a pergunta
  "isso torna a vida do usuário mais simples?".

## 9. Próximas evoluções previstas

- Widgets adicionais: Oficina, Eventos, Seguro, Localização,
  Marketplace, IA.
- Sugestões preditivas na TIL (baseadas em padrão de uso).
- Notificações push a partir de `alerts.ts`.
- Personalização estendida somente se dados de uso mostrarem
  necessidade real.

## 10. Princípios oficiais decorrentes

1. **Telas não calculam.** Qualquer cálculo vive na TIL.
2. **Cockpit responde 5 perguntas em 30 segundos.** Qualquer elemento
   que não sirva a essas perguntas fica fora do topo.
3. **Mobile-first sempre.** Desenhar 375px primeiro; desktop é adaptação.
4. **Personalização mínima.** Fixar favoritos, ocultar painel, restaurar
   padrão — nada além disso sem nova ADR.
5. **Ação sugerida.** Toda pendência vem com CTA direto; o usuário não
   procura.
6. **Widgets são arquitetura, não UI configurável.** O usuário não
   percebe o conceito.
7. **Filtro de decisão de UX:** "isso torna a vida do usuário mais
   simples?". Se não, reavaliar antes de implementar.

## 11. Referências

- Filosofia oficial e Regra dos 30 segundos: `mem://index.md` (Core).
- ADR 0001 — Recomposição cronológica da timeline.
- Plano de fases: `.lovable/plan.md`.