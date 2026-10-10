# Ajuste 01 — Registrar Uso

Implementado em 10/10/2026 para homologação, sem publicação.

## Resultado funcional
- Registrar Uso abre diretamente na tela inicial um formulário de data, leitura acumulada na unidade oficial e local opcional.
- Usuários novos e existentes recebem o atalho primeiro **na primeira consulta das preferências desta versão**, com inicialização persistida e serializada por perfil. Não é uma alteração em massa dos perfis.
- Todos os itens anteriores e sua ordem relativa são preservados. Limite passa de 9 para 10; remoção, lista vazia e reorganização posteriores persistem entre sessões.
- `commit_usage_reading` reutiliza `commit_event_and_recompose` e a recomposição oficial, calculando apenas o incremento necessário dentro do mesmo bloqueio/transação. De 10 para 13 horas: total 13, incremento 3.
- Repetição da mesma solicitação é idempotente. Concorrência, autorização, precisão, datas e leituras inválidas são verificadas no backend.
- Histórico, moto ativa, plano, alertas, evidências e demais consultas ativas são sincronizados antes da confirmação de sucesso; telas não montadas são invalidadas para a próxima consulta.

## Estruturas modificadas
- `drizzle/migrations/0002_register_usage_reading_and_initial_shortcut.sql`: coluna de inicialização no perfil e duas funções; aplicada com autorização específica. Nenhuma atividade histórica modificada pela migration; sem novos dados de teste no backend compartilhado.
- Evidência SQL: `docs/security/migrations/20261010041000_register_usage.sql`.
- Catálogo e preferências: `src/lib/home-shortcuts.ts`, `src/hooks/useHomeShortcuts.ts`, `src/routes/_authenticated/perfil.atalhos.tsx`.
- Formulário/início: `src/components/RegisterUsageDialog.tsx`, `src/routes/_authenticated/dashboard.tsx`.
- Validação TIL: `src/lib/til/usage-reading.ts`; três arquivos de testes em `src/lib/home-shortcuts.test.ts` e `src/lib/til/usage-*.test.ts`.
- Comunicação: `src/lib/help/usage-guidance.ts`, `src/hooks/useAssistant.ts`, `src/routes/_authenticated/faq.tsx`, `src/lib/help/texts.ts`, `CHANGELOG.md`, `AGENTS.md`, `roadmap.md`.
- Tipos do backend regenerados automaticamente pela ferramenta de migration.

## Validação
| Verificação | Resultado | Ambiente |
|---|---|---|
| Suíte completa | 237 testes aprovados em 9 arquivos; 46 testes novos | Local |
| Preferências novas/existentes, ordem, remoção, nove itens, duplicações | Aprovado | PostgreSQL sintético isolado + funções puras |
| Horas/km, local opcional, leitura acumulada, precisão, duplicação, datas | Aprovado | PostgreSQL sintético isolado + TIL |
| Concorrência real entre duas conexões | Um registro, total correto | PostgreSQL sintético isolado |
| Falha durante gravação | Transação revertida, sem evento ou alteração de total | PostgreSQL sintético isolado |
| Plano, alerta e snapshot de manutenção anterior | Aprovado pela TIL oficial e RPC oficial | PostgreSQL sintético isolado |
| Atalho e formulário, sessão autenticada | Visíveis; três campos, unidade horímetro | Preview, sem registrar uso real |
| Desktop/celular | Formulário legível, sem transbordamento | Chromium 1280 e 393 px |
| Erro de leitura/falha de persistência | Mensagem clara, formulário permanece, sem sucesso falso | Preview; falha de persistência simulada |
| Build automático | OK | Última entrada verificada em `/tmp/observability/build-errors.log` |

## Limitações conhecidas
- O projeto atualmente só define a paleta escura em `src/styles.css`; retirar a classe dark não produz um tema claro. O formulário usa os tokens existentes, mas **tema claro não foi homologado**. Não foi criado um tema global fora do escopo.
- Cadastros `both` e `not_informed` são bloqueados com orientação para definir uma unidade única; não há escolha manual no formulário.
- Retroativos são aceitos somente em data igual/posterior à última atividade com incremento e não anterior ao cadastro quando não há atividade. Inserir uma leitura anterior alteraria snapshots históricos no motor existente; este atalho não faz essa alteração.
- Não houve salvamento de uso real no backend compartilhado nem teste de gravação completa pela interface com conta sintética hospedada. A gravação/integridade foi comprovada em banco sintético isolado; a interface e a inicialização das preferências foram verificadas no preview.
- Nenhuma publicação realizada. Pendências anteriores de Correção 01/GitHub permanecem fora deste ajuste.