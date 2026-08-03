# Project Memory

## Core
- **Constituição do TrailBook (ADR 0016, `mem://principles/constituicao-trailbook`) — diretriz permanente acima de tudo.** Missão oficial: "Ser o Especialista Digital em Saúde da Motocicleta." O TrailBook entrega interpretação, não dados. Toda avaliação responde: diagnóstico, o que foi encontrado, o que recomendamos, posso rodar hoje. Linguagem humana, justificativa sempre, foco preventivo, Timeline = evolução da saúde. TIL inalterada; IA futura amplia, não substitui. Antes de qualquer feature: "isso ajuda o TrailBook a ser o Especialista Digital em Saúde da Motocicleta?"
O usuário nunca vê nota/percentual: avaliação → diagnóstico → achados → recomendação → "posso rodar hoje?". Números só no Modo Técnico (admin).
- TrailBook: identidade digital permanente da moto off-road. Tema escuro premium (grafite/laranja), fontes Inter + Space Grotesk. Nunca hardcode cores — usar tokens semânticos em `src/styles.css`.
- UX oficial: aplicar SEMPRE os princípios `mem://principles/ux-official` — 3 perguntas antes de adicionar, regra do usuário cansado, uma tela = uma decisão, menos é mais, decisão acima da informação.
- Evolução controlada: toda nova funcionalidade passa pelas 5 perguntas de `mem://principles/evolucao-controlada` (problema real, uso frequente, cabe em fluxo existente, impacto na complexidade, solução mais simples). Cada versão deve tornar o TrailBook melhor, nunca mais complexo. Na dúvida entre mais features e melhor UX → sempre UX.
- Toda nova funcionalidade DEVE seguir as Diretrizes Permanentes de Desenvolvimento (`mem://standards/dev-directives`): arquitetura escalável, RLS + roles + ModuleGate, auditoria imutável, UX consistente, responsivo desktop/tablet/mobile, formulários com seletores + "Outros", confirmação em ações críticas, feedback via sonner, navegação com PageHeader, reuso de componentes shadcn, validação frontend+backend+DB, paginação/lazy/cache, homologação e atualização de docs.
- Admin fixo: dzkilibrado@gmail.com. Trava de auto-rebaixamento ativa.
- Módulos controlados por `platform_modules` (active/maintenance/disabled/beta) via `<ModuleGate />`. Sidebar reage ao status.
- Auditoria: `audit_log` + triggers + `write_admin_audit`. Imutável.
- Documentação oficial vive em `/mnt/documents/Documentation/`. Atualizar CHANGELOG/Release Notes/Manual ao concluir features.
- Ambiente Permanente de Homologação (APH): contas `@homolog.trailbook.test` + motos `[HOMOLOG]` marcadas com `is_homologation=true`. Operado em `/admin/homolog`. Toda feature nova ganha ao menos um cenário aqui antes de homologar. NÃO confundir com Demo Mode (futuro, uso comercial).
- Smart Receipt Fase 1.2 está HOMOLOGADA E ENCERRADA (2026-07-10). Não alterar `smart_receipts.*`, triggers `on_smart_receipt_completed` / `smart_receipts_supersede_previous` / `generate_smart_receipt_code`, RPC `get_public_receipt`, rota `/r/:code` nem `src/lib/smart-receipts*` sem nova solicitação formal. Detalhes em CHANGELOG.md.
- Preservação de histórico é princípio permanente (`mem://principles/preservacao-historico`): substituir documento NUNCA apaga o anterior — só rebaixa `is_current`/`is_origin_document`. Arquivo, autor, data e auditoria permanecem intactos.
- Selos de Qualidade do Histórico — Fase 1 **HOMOLOGADA E ENCERRADA** (`mem://features/selos-qualidade`, ADR 0007): registry declarativo em `src/lib/badges/registry.ts` + motor puro `evaluateBadges`. Selos são DERIVADOS de evidências (nunca armazenados/manuais); adicionar selo = adicionar objeto no registry, sem tocar em componentes. Alterações futuras entram como nova fase.
- Linguagem oficial da UI: português simples e amigável, sem termos técnicos quando houver alternativa clara. Glossário e regras em `mem://principles/linguagem-oficial`. Nomes técnicos ficam restritos a código, ADR e docs.
- Regra Permanente de Qualidade (`mem://standards/qualidade-oficial`, ADR 0008): toda funcionalidade nova precisa passar pelas 5 revisões (Funcional, UX, Mobile, Comunicação, Final) antes de ser homologada. Vigora a partir da v1.5.
- Descoberta em um toque (`mem://principles/descoberta-um-toque`, ADR 0009): todo termo ambíguo é (a) renomeado ou (b) explicado por `HelpTooltip`. Componente único e textos vindos SEMPRE do registry `src/lib/help/texts.ts` (`HELP`). FAQ e suporte são complementos, nunca a primeira porta.
- Descoberta progressiva (`mem://principles/descoberta-progressiva`, ADR 0010): TrailBook ensina em camadas — Interface → HelpTooltip → Como funciona → FAQ → Suporte. Toda funcionalidade nova responde às 6 perguntas (Home, FAQ, Onboarding, Tooltip, Como funciona, Novidades) na etapa Comunicação da ADR 0008; SIM = item obrigatório.
- Padrões visuais e loading (Sprint v1.6 encerrada, 2026-07-12): fonte única de tones em `src/lib/ui/status-styles.ts` (`TONE`, `BADGE_TIER_STYLE`, `SCORE_TIER_STYLE`) — nunca redeclarar dicionários locais. Loading padronizado: skeletons em `src/components/Skeletons.tsx`, spinner em `src/components/InlineSpinner.tsx`, empty state em `src/components/EmptyState.tsx`. Nunca usar texto "Carregando…" em tela cheia — sempre skeleton. `signedUrl` (`src/lib/trailbook.ts`) tem cache com TTL; router usa `defaultPreload: "intent"`.
- Sucesso só após sincronia da UI (`mem://principles/sucesso-apos-sincronia`, ADR 0011): nenhuma mensagem de sucesso pode aparecer antes da interface refletir o novo estado. Toda mutação em `createServerFn` retorna a linha atualizada via `.update().eq().select().single()`; cliente aplica estado + aguarda `invalidateQueries` antes do toast. 0 linhas = erro. Sem optimistic updates em aceites/transferências/conclusões.
- Erro com recuperação (`mem://principles/erro-com-recuperacao`, ADR 0012): falhas por estado desatualizado disparam sincronia automática (refetch + invalidate) ANTES de qualquer mensagem. Backend lança `STALE_STATE:` (helper `src/lib/errors/stale-state.ts`), frontend sincroniza e só então mostra mensagem amigável — nunca "recarregue a página". Retry só habilita após sincronia e é idempotente. Par permanente com ADR 0011.
- Landing pública (`mem://principles/landing-page-conversao`, ADR 0013): missão = converter, não ensinar. Estrutura fixa em `src/routes/index.tsx`: Hero → Benefícios (≤5) → Como funciona (≤4) → Carrossel (≤4 telas, scroll-snap, sem autoplay) → FAQ (5) → CTA final → Rodapé mínimo. Detalhes vão para `/como-funciona`, `/faq` ou app. Proibido vídeo/autoplay/tour animado/bibliotecas pesadas de carrossel. Nova seção só entra passando pelas 3 perguntas de UX + ADR 0008.

## Memories
- [Avaliação inteligente (Health 4.0)](.lovable/mem/principles/avaliacao-inteligente.md) — estrutura obrigatória da avaliação; nota só no Modo Técnico
- [Diretrizes de desenvolvimento](mem://standards/dev-directives) — Padrões obrigatórios (18 pontos) aplicáveis a toda nova funcionalidade v1.0.1+
- [Princípios oficiais de UX](mem://principles/ux-official) — Filosofia mandatória: 3 perguntas, usuário cansado, uma tela = uma decisão, menos é mais, decisão > informação
- [Princípio da Evolução Controlada](mem://principles/evolucao-controlada) — 5 perguntas obrigatórias antes de qualquer nova funcionalidade + arquitetura evolutiva + prioridade da experiência
- [ADR 0005 — Ambiente Permanente de Homologação](docs/adr/0005-ambiente-permanente-homologacao.md) — convenções, contas, cenários, operação via `/admin/homolog`
- [Campos: Seleção > Autocomplete > Texto livre](mem://principles/campos-selecao-oficial) — regra oficial; UF/Cidade via IBGE em `src/lib/br-locations.ts` + `LocationPicker` reutilizável
- [Informar uma vez. Reutilizar sempre.](mem://principles/informar-uma-vez) — módulos consomem `useProfileSnapshot` + `<ProfileDataChip />`; nunca pedir de novo nem escrever de volta
- [Alteração de CPF via Suporte](mem://features/alteracao-cpf) — fluxo excepcional auditado; `admin_approve_cpf_change` é a única forma legítima de trocar CPF já validado
- [ADR 0006 — Cadastro Completo (Fases A · B · D · E)](docs/adr/0006-cadastro-completo-fases.md) — entrega v1.3 encerrada; gate, wizard, imutabilidade do CPF, reutilização automática e alteração via suporte
- [Preservação de Histórico](mem://principles/preservacao-historico) — Prontuário Digital: substituição só alterna "atual", nunca destrói registro/arquivo/auditoria
- [Selos de Qualidade do Histórico](mem://features/selos-qualidade) — Fase 1: registry + motor + hooks + UI reusável; integrado em Central, Passaporte, Saúde e Documentos
- [ADR 0007 — Selos de Qualidade do Histórico](docs/adr/0007-selos-qualidade-historico.md) — fundação arquitetural, princípios invioláveis, roadmap Fase 2
- [Linguagem oficial da UI](mem://principles/linguagem-oficial) — português simples, glossário e regras de aplicação
- [Regra Permanente de Qualidade](mem://standards/qualidade-oficial) — 5 revisões obrigatórias antes de qualquer homologação
- [ADR 0008 — Regra Permanente de Qualidade](docs/adr/0008-regra-permanente-qualidade.md) — portão final de homologação
- [Descoberta em um toque](mem://principles/descoberta-um-toque) — princípio permanente de UX (compreensão em até um toque)
- [Padrão oficial de Help Tooltips](mem://standards/help-tooltips) — componente único, registry único, onde aplicar
- [ADR 0009 — Help Tooltips e Descoberta em Um Toque](docs/adr/0009-help-tooltips-e-descoberta.md) — regras operacionais e reservas (Verificado pelo TrailBook)
- [Descoberta progressiva](mem://principles/descoberta-progressiva) — camadas de aprendizado + checklist de 6 perguntas
- [ADR 0010 — Descoberta Progressiva](docs/adr/0010-descoberta-progressiva.md) — encerramento da Revisão de UX v1.5
- [Sucesso só após sincronia da UI](mem://principles/sucesso-apos-sincronia) — princípio permanente para fluxos assíncronos
- [ADR 0011 — Sucesso só após sincronia da UI](docs/adr/0011-sucesso-apos-sincronia.md) — causa raiz do bug de aceite do Recibo e correção estrutural
- [Erro com recuperação](mem://principles/erro-com-recuperacao) — sincronia automática antes de qualquer pedido manual ao usuário
- [ADR 0012 — Erro com recuperação](docs/adr/0012-erro-com-recuperacao.md) — padrão oficial de tratamento de estados desatualizados
- [Landing Page — conversão](mem://principles/landing-page-conversao) — estrutura fixa e divulgação progressiva
- [ADR 0013 — Landing Page: conversão e divulgação progressiva](docs/adr/0013-landing-page-conversao.md) — redesign v1.6.5
- [Tela de Boas-vindas do TrailBook](mem://principles/tela-de-boas-vindas) — app abre na Boas-vindas; Landing vira site institucional em /site
- [ADR 0017 — Tela de Boas-vindas (UX 2.0)](docs/adr/0017-tela-de-boas-vindas.md) — background dinâmico, Ken Burns, saudação contextual
- [Retorno perceptível a toda ação](mem://principles/retorno-perceptivel) — nenhum clique pode terminar em silêncio
- [ADR 0014 — Retorno Perceptível a Toda Ação](docs/adr/0014-retorno-perceptivel.md) — Sprint v1.6.7 de navegação, comunicação e atendimento
- [ADR 0015 — Health 4.0: da nota para a avaliação inteligente](docs/adr/0015-avaliacao-inteligente-health-4.md) — estrutura oficial da avaliação e Modo Técnico
- [Constituição do Produto TrailBook](mem://principles/constituicao-trailbook) — missão e 10 princípios permanentes
- [ADR 0016 — Constituição do Produto TrailBook](docs/adr/0016-constituicao-do-produto.md) — registro oficial das diretrizes permanentes