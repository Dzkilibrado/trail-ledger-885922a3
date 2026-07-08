# Project Memory

## Core
- TrailBook: identidade digital permanente da moto off-road. Tema escuro premium (grafite/laranja), fontes Inter + Space Grotesk. Nunca hardcode cores — usar tokens semânticos em `src/styles.css`.
- UX oficial: aplicar SEMPRE os princípios `mem://principles/ux-official` — 3 perguntas antes de adicionar, regra do usuário cansado, uma tela = uma decisão, menos é mais, decisão acima da informação.
- Toda nova funcionalidade DEVE seguir as Diretrizes Permanentes de Desenvolvimento (`mem://standards/dev-directives`): arquitetura escalável, RLS + roles + ModuleGate, auditoria imutável, UX consistente, responsivo desktop/tablet/mobile, formulários com seletores + "Outros", confirmação em ações críticas, feedback via sonner, navegação com PageHeader, reuso de componentes shadcn, validação frontend+backend+DB, paginação/lazy/cache, homologação e atualização de docs.
- Admin fixo: dzkilibrado@gmail.com. Trava de auto-rebaixamento ativa.
- Módulos controlados por `platform_modules` (active/maintenance/disabled/beta) via `<ModuleGate />`. Sidebar reage ao status.
- Auditoria: `audit_log` + triggers + `write_admin_audit`. Imutável.
- Documentação oficial vive em `/mnt/documents/Documentation/`. Atualizar CHANGELOG/Release Notes/Manual ao concluir features.

## Memories
- [Diretrizes de desenvolvimento](mem://standards/dev-directives) — Padrões obrigatórios (18 pontos) aplicáveis a toda nova funcionalidade v1.0.1+
- [Princípios oficiais de UX](mem://principles/ux-official) — Filosofia mandatória: 3 perguntas, usuário cansado, uma tela = uma decisão, menos é mais, decisão > informação