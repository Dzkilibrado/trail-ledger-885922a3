# TrailBook v1.6 — Polish Sprint

> **STATUS: ✅ HOMOLOGADA E ENCERRADA (2026-07-12).**
>
> - **Bloco A — UX/Mobile/Visual** (CHANGELOG `[1.6.0]`).
> - **Bloco B — Performance percebida** (CHANGELOG `[1.6.1]`).
> - **Bloco C — Limpeza técnica e padronização** (CHANGELOG `[1.6.2]`).
>
> Nenhuma regra de negócio, RLS, migration, edge function ou fluxo
> homologado foi alterada nos três blocos. A Sprint consolida qualidade,
> organização, performance, UX e padronização antes das próximas
> grandes evoluções do produto.

Sprint de polimento, sem novas funcionalidades e sem tocar em regras de negócio homologadas. Entrego em **3 blocos coerentes**, do maior impacto percebido para o mais técnico. Cada bloco fecha em si mesmo (typecheck limpo, screenshots mobile, sem regressões).

## Princípios que regem toda a sprint

- **Descoberta Progressiva + Linguagem Oficial + Mobile First** aplicados por padrão.
- **Nada** que altere `smart_receipts.*`, `evaluator` de selos, RLS, migrations, `client.ts`, `client.server.ts`, `auth-middleware.ts`, `types.ts`.
- Regra de decisão: solução mais simples, mais intuitiva, menos cliques, funciona no Mobile 384px.

---

## Bloco A — UX, Mobile e Consistência Visual (maior impacto)

**Componentes de plataforma (fonte única):**
- Consolidar tokens já usados (`TBPageHeader`, `TBCard`, `TBButton`, `TBChip`) em auditoria rápida para garantir uso onde há reinvenção manual (`div className="surface-elevated ..."` repetidos).
- Padronizar cabeçalho de página com `PageHeader` em todas as rotas (algumas ainda montam h1 solto).
- Padronizar chip de status/severidade (Crítico/Atenção/Info) em componente único; hoje é replicado em Passaporte, Documentos e Central.

**Layout mobile-safe (384px):**
- Sweep de todos os headers de página aplicando `grid-cols-[minmax(0,1fr)_auto]` + `min-w-0` + `shrink-0` + `truncate` — padrão já registrado em `responsive-layout-patterns`.
- Trocar barras de ações horizontais (`flex flex-wrap gap-2` de 5+ botões) por menu overflow (`•••`) no mobile em: `MotoControlCenter`, `Passaporte`, `MotorcycleDocuments`.
- Dialogs longos (`EmitReceiptDialog`, `TransferOwnershipDialog`, upload de documentos) recebem `max-h-[85dvh] overflow-y-auto` e footer sticky para o botão principal nunca sair da viewport com teclado aberto.
- Inputs com `inputMode` correto onde ainda faltar (números, tel, decimal).
- Trocar remanescentes de `h-screen`/`min-h-screen` por `h-dvh`/`min-h-dvh` (regressão comum de teclado).

**Dashboard (Home):**
- Ordem revisada: **Moto ativa → Pendências → Próximas manutenções → Atalhos → Últimas atividades → Novidades**. Novidades desce para o fim (não é urgente) e "Próximas manutenções" sobe (é acionável).
- Remover métricas duplicadas: o "investido" já aparece no card da moto ativa — sai do bloco de métricas do fim.
- Cabeçalho de saudação enxuto (uma linha, sem duplicar título da página).

**Textos / linguagem:**
- Sweep final de `toast.success/error` e `title`/`description` de Dialogs eliminando termos como "SHA-256", "Storage privado", "URL assinada" da UI visível (permanecem só em selos/tooltips técnicos).
- Padronizar rótulos de botão: verbo + objeto ("Anexar documento", "Registrar atividade", "Compartilhar Passaporte") — remover "Emitir", "Persistir", "Gerar" onde houver equivalente natural.
- Fechar mensagens confusas apontadas por leitura crítica: banner de origem, pendências, EmitReceipt.

**Help Tooltips (revisão do que já existe):**
- Auditoria rápida — remover se algum ficou redundante com o próprio nome do campo já intuitivo. Adicionar apenas 2 casos identificados: "Nota Fiscal" e "Recibo de Compra e Venda" dentro do seletor de tipo de documento.

**Dark Mode & Acessibilidade:**
- Sweep de contraste: substituir `text-muted-foreground/50`, `text-white/60`, cores arbitrárias por tokens semânticos.
- Garantir `aria-label` em todos os `Button size="icon"` (regra a11y — costuma escapar em toolbars).
- Área de toque mínima 44×44 em ícones-ação primários mobile (Bump `size="icon"` para `min-h-11 min-w-11` em CTAs mobile).

## Bloco B — Performance e Percepção

- Skeletons consistentes: extrair `<Skeleton>` unificado (hoje há `animate-pulse` inline em cada tela) e aplicar em Dashboard, Central, Passaporte, Documentos.
- `useQuery` staleTime / gcTime: definir defaults sensatos no `QueryClient` (dashboards/listas 30s, dados por ID 5min) — corta refetch desnecessário sem alterar semântica.
- `React.memo` em componentes pesados repetidos em lista (`BadgeChip`, `EventTypeIcon`, `SingleBadgeChip`).
- Lazy-load de rotas pesadas menos usadas (`/admin/*`, `/como-funciona`, `/faq`) via TanStack Router lazy files.
- Remover `console.log`/warnings residuais.
- Preload da foto principal da moto ativa (`<link rel="preload" as="image">` no head da rota `/motorcycles/$id`).

## Bloco C — Limpeza técnica

- Remoção de imports não usados (sweep automático com `bunx eslint --fix --rule 'unused-imports/no-unused-imports: error'` se disponível, senão manual).
- Remoção de componentes/hooks órfãos comprovadamente sem referência (busca por nome; só deleta se `rg` retornar zero call-sites).
- Consolidar `TIER_STYLE` e `SEVERITY_STYLE` duplicados em `src/lib/ui/status-styles.ts`.
- Fechar TODOs antigos triviais (comentários obsoletos).

## Fora de escopo (explícito)

- Não mexer em: `smart_receipts.*`, evaluator de selos, RLS/roles, migrations, edge functions, `client*.ts`, `types.ts`, auto-gen de router.
- Não iniciar Fase 2 de selos, TrailBook Score, valorização, IA — mesmo se aparecerem sugestões.
- Não alterar arquitetura ou criar novos módulos/menus.

## Homologação de encerramento

- `bunx tsgo --noEmit` limpo.
- Playwright: 6 screenshots mobile (384×703) — Dashboard, Central, Passaporte, Documentos, EmitReceipt (step 1), Cadastro.
- 3 screenshots desktop (1280×800) das mesmas telas principais.
- Console limpo em navegação padrão.
- Sem migrations. Sem novas dependências (exceto se a limpeza pedir explicitamente e for aprovado).
- CHANGELOG `[1.6.0]` com resumo por bloco + atualização de `.lovable/plan.md`.

---

## Como quer prosseguir?

Como a sprint é ampla, sugiro escolher uma das opções:

1. **Executar os 3 blocos em sequência** em uma única entrega grande (mais tempo até o primeiro deploy, resultado completo).
2. **Bloco A primeiro** (maior impacto visível), homologar, depois B e C. — **Minha recomendação**, porque quase todo ganho percebido está em A e você pode validar antes de investir em B/C.
3. **Só um subconjunto específico** de A que você queira priorizar (ex.: só Mobile + Dashboard + Textos).

Responda **A**, **B** ou detalhe o subconjunto — na sua confirmação eu já começo a implementar.
