---
name: Diretrizes Permanentes de Desenvolvimento TrailBook
description: Padrões obrigatórios de arquitetura, segurança, UX, auditoria, responsividade, formulários, performance, homologação e documentação aplicáveis a toda nova funcionalidade do TrailBook a partir da v1.0.1.
type: preference
---

Aplicar a TODA nova tela, módulo ou funcionalidade. Verificar antes de concluir.

1. **Arquitetura** — escalável, modular, reutilizável, baixo acoplamento, performática, segura. Sem gambiarra.
2. **Controle de acesso** — integrar a roles (`user_roles`/`has_role`), permissões por módulo/ação, Feature Flags (`platform_modules` + `<ModuleGate />`). Nunca criar acessos fora desse padrão.
3. **Auditoria** — toda alteração relevante grava em `audit_log` (usuário, timestamp, operação, old/new values, origem). Imutável. Usar triggers ou `write_admin_audit`.
4. **UX** — padrão visual TrailBook: simplicidade, clareza, consistência. Nunca telas isoladas com comportamento divergente.
5. **Responsividade** — desktop + tablet + mobile obrigatoriamente.
6. **Formulários** — máscaras, validações, `Select`/combobox pesquisável, autocomplete. Evitar texto livre. SEMPRE incluir opção "Outros" que abre campo obrigatório de detalhamento.
7. **Confirmação de operações críticas** — usar `AlertDialog` com explicação clara, cancelamento e feedback pós-execução. Sem ações irreversíveis silenciosas.
8. **Feedback** — toda ação retorna via `sonner` (sucesso/erro/aviso/processando). Nunca deixar o usuário sem retorno.
9. **Navegação** — usar `PageHeader` com Voltar, Início, Breadcrumb. Usuário nunca preso.
10. **Padronização** — reutilizar componentes shadcn existentes (Button, Card, Table, Dialog, DropdownMenu, Badge, etc.) antes de criar novos.
11. **Pesquisa e filtros** — priorizar filtros por seleção. Em grande volume: filtros + ordenação + busca + agrupamentos.
12. **Segurança em camadas** — validar frontend + backend (server functions/RPCs) + DB (RLS + CHECK). Nunca confiar só na UI.
13. **Performance** — paginação, lazy loading, cache (React Query), consultas otimizadas.
14. **Escalabilidade** — preparar para novos módulos, perfis, planos, tipos de documento, integrações — sem grandes refatorações.
15. **Documentação** — ao concluir, atualizar Manual do Usuário, Documentação Funcional, CHANGELOG, Release Notes e Roadmap (quando aplicável) em `/mnt/documents/Documentation/`.
16. **Homologação** — nenhuma feature concluída sem testes funcionais, segurança, responsividade, navegação e permissões. Registrar resultado.
17. **Qualidade** — revisar UX/UI/performance/segurança/código/arquitetura antes de fechar. Aplicar melhorias evidentes.
18. **Inteligência de produto** — sugerir melhorias consistentes com o produto. Se não altera escopo, implementar e registrar no changelog. Se altera comportamento relevante, validar antes.

**Objetivo:** TrailBook evolui com padrão único de arquitetura, segurança, UX e qualidade.

**A partir de v1.5:** homologação exige também o checklist da [Regra Permanente de Qualidade](mem://standards/qualidade-oficial) (ADR 0008) e a [Linguagem oficial da UI](mem://principles/linguagem-oficial).