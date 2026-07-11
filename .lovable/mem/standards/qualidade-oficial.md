---
name: Regra Permanente de Qualidade TrailBook
description: Cinco etapas obrigatórias (Funcional, UX, Mobile, Comunicação, Final) que qualquer nova funcionalidade deve cumprir antes de ser homologada. Vigora a partir da v1.5.
type: preference
---

# Regra Permanente de Qualidade

Nenhuma funcionalidade é homologada sem passar pelas cinco etapas abaixo.
Ver [ADR 0008](docs/adr/0008-regra-permanente-qualidade.md).

## 1. Revisão Funcional
- Regras de negócio validadas.
- Fluxos principais e alternativos validados.
- Integrações validadas.
- Segurança e permissões (RLS, roles, `ModuleGate`) validadas.

## 2. Revisão de UX
- Navegação clara.
- Fácil de usar.
- Menor número possível de cliques.
- Botões bem posicionados.
- Funcionalidade fácil de descobrir.
- Consistência com o restante do sistema.
- Aplica `mem://principles/ux-official` e `mem://principles/evolucao-controlada`.

## 3. Revisão Mobile
- Layout responsivo.
- Nenhum texto cortado ou vazando.
- Nenhum scroll horizontal.
- Botões acessíveis ao toque (≥44px).
- Boa leitura em telas pequenas (mín. 384px).
- Componentes adaptados a smartphones.

## 4. Revisão de Comunicação
- Linguagem simples (`mem://principles/linguagem-oficial`).
- Textos objetivos.
- Sem termos técnicos quando houver alternativa clara.
- Tooltips quando necessário.
- FAQ atualizada quando a funcionalidade exigir orientação ao usuário.
- Documentação de ajuda atualizada.

## 5. Revisão Final
- Console sem erros.
- `tsgo --noEmit` limpo.
- Build de produção limpo.
- Sem regressões em funcionalidades existentes.
- Fluxo completo validado no Mobile.
- Fluxo completo validado por usuário comum (APH — ADR 0005).
- Documentação atualizada.
- `CHANGELOG.md` atualizado.
- ADR atualizado quando houver mudança arquitetural.
- Roadmap atualizado quando necessário.

## Governança
Esta regra é permanente. Uma funcionalidade que pule qualquer etapa NÃO está homologada, ainda que compile e passe em testes automatizados.