# TrailBook Health — A Inteligência que acompanha a saúde da sua motocicleta

Reposicionamento completo: o TrailBook deixa de exibir notas e passa a entregar **diagnósticos, respostas e planos de ação**. A nota continua existindo, mas apenas como insumo interno de cálculo dentro da TIL.

Fase 1 é grande demais para uma única entrega segura. Proponho executá-la em **5 etapas homologáveis**, na ordem abaixo. Cada etapa entra em produção funcionando sozinha.

---

## Etapa 1 — Linguagem de Status e Diagnóstico (base de tudo)

Fundação semântica usada por todas as telas seguintes.

- Status universal oficial: 🟢 OK · 🟡 Atenção · 🔴 Necessita ação · ⚪ Dados insuficientes.
- Novo módulo `src/lib/til/diagnosis.ts`: para cada componente gera **motivos** (lista de fatos observados), **conclusão** (frase de decisão) e **status**.
- Enriquecimento do componente com: saúde estimada, vida útil restante, tendência (melhorando / estável / piorando), próxima manutenção, última manutenção, última inspeção.
- Novo módulo `src/lib/til/action-plan.ts`: plano de ação ordenado por prioridade (crítico → atenção → preventivo).
- UI: `TBStatusDot`, `TBDiagnosisCard`, `TBActionPlan` no design system.
- Notas numéricas saem da superfície visível (Cockpit, Saúde, Componentes) e passam a ser detalhe interno.

Sem mudanças de banco nesta etapa.

## Etapa 2 — Check-up Inteligente e Laudo TrailBook®

- Botão principal **🔍 Fazer Check-up** no Cockpit e na tela de Saúde.
- Motor `src/lib/til/checkup.ts` analisa manutenções, agenda, horas/KM, vida útil, documentação, histórico financeiro, fotos, proprietários, pendências, alertas, Índice de Conservação e Índice de Confiabilidade.
- Resultado persistido como **Laudo Inteligente TrailBook®** com: resumo geral, diagnóstico, itens críticos / atenção / excelentes, próximas manutenções, recomendações, confiabilidade da análise, índices, timeline resumida, fotos relevantes, histórico, QR Code, hash de integridade, versão do algoritmo, data de emissão e validade.
- Validade: 30 dias **ou** 20 horas de uso, o que ocorrer primeiro. Depois: 🟡 Desatualizado + "Gerar novo Check-up".
- Laudos são imutáveis: nunca sobrescrever, sempre criar nova versão.

## Etapa 3 — Central de Check-ups, Timeline e Evolução

- Módulo próprio com histórico permanente de todos os check-ups (Check-up 001, 002, …) com status e data.
- **Timeline de Saúde**: evolução por período com status, principais acontecimentos e mudanças importantes.
- **Evolução da Saúde**: gráficos de Índice de Conservação, Índice de Confiabilidade, itens críticos, itens em atenção e componentes excelentes ao longo do tempo.

## Etapa 4 — Comparador, Recomendações e Perfil de Cuidado

- **Comparador de Laudos**: selecionar dois check-ups e ver componentes que melhoraram/pioraram, itens resolvidos, novos problemas e variação dos dois índices.
- **Histórico de recomendações**: cada recomendação emitida vira registro com data de emissão e execução (✔ Executada / ⏳ Pendente), vinculada à atividade que a resolveu.
- **Perfil de Cuidado do Proprietário**: métrica em estrelas baseada no % de recomendações cumpridas no prazo — comprometimento com prevenção, nunca habilidade.
- **Previsão Inteligente** por regras: estimativa de horas/KM até a próxima substituição com base no padrão de uso.

## Etapa 5 — Compartilhamento do Laudo

- Link público somente leitura protegido por token e QR Code, reutilizando a infraestrutura já validada do Certificado Digital.
- Compartilhar (Web Share), imprimir, exportar PDF — usando a cascata de salvamento já homologada.
- Público-alvo: compradores, oficinas, seguradoras, concessionárias.

---

## Detalhes técnicos

- Toda inteligência permanece **exclusivamente na TIL** (`src/lib/til/`). Telas apenas leem o snapshot — nenhum cálculo em componente, conforme regra oficial do projeto.
- Novos módulos TIL: `diagnosis.ts`, `action-plan.ts`, `checkup.ts`, `forecast.ts`, `care-profile.ts`, expostos pela fachada `computeCockpitSnapshot` e por um novo `computeCheckup`.
- Banco (Etapa 2+): tabelas `health_checkups` (laudo imutável, snapshot JSONB, hash, versão do algoritmo, validade, token público) e `health_recommendations` (emissão, status, execução). RLS por propriedade da moto + GRANTs; leitura pública apenas via token do laudo.
- Geração do laudo roda em server function; o cálculo em si vive em módulo puro reutilizável no cliente, garantindo mesmo resultado nas duas pontas.
- Preparação para IA: o motor emite um **contexto estruturado** (fatos + evidências) e o texto do diagnóstico é gerado por uma camada substituível. Na Fase 2 basta trocar o gerador por IA sem tocar no motor.
- Compatibilidade preservada com Índice de Conservação, Índice de Confiabilidade, Passaporte Digital, Agenda, MotorcycleReviewState e Selos de Qualidade.
- Mobile-first absoluto em todas as telas, seguindo ADR 0004.
- Cada etapa encerra com ADR próprio e entrada no CHANGELOG.

Aprovando, começo pela Etapa 1.
