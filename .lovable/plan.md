## Revisão da Navegação Principal — Mobile First

### 1. Estrutura atual

Sidebar principal hoje tem **10 itens** de Navegação + 4 de Conta + 6 de Admin:

**Navegação (10):**
- Dashboard
- Minhas Motos
- Documentos da Moto
- Agenda
- Certificados
- Chamados
- Mensagens
- Oficinas
- Financeiro
- Transferências

**Minha Conta (4):** Perfil · Configurações · Plano · Ajuda
**Administração (6):** Dashboard Admin · Usuários · Chamados · Mensagens · Documentos · Módulos
**Sessão:** Sair

**Problema:** muitos itens são funções *da moto* (Documentos, Agenda, Certificados, Financeiro, Transferências) que já existem dentro do contexto de cada motocicleta (Cockpit → Check-up, Componentes, Plano, Central da Moto). Duplicação + poluição visual no mobile.

---

### 2. Estrutura proposta

Menu principal reduzido a **5 módulos** (+ Administração para admin):

```
┌─ PRINCIPAL ─────────────────┐
│ 🏠  Início                  │  → /dashboard
│ 🏍️  Minhas Motos             │  → /motorcycles
│ 📂  Central                 │  → /central (novo hub)
│ 💬  Comunicação             │  → /comunicacao (novo hub)
│ 👤  Perfil                  │  → /perfil (novo hub)
└─────────────────────────────┘

┌─ ADMINISTRAÇÃO (admin) ─────┐
│ 🛡️  Administração            │  → /admin (hub já existente)
└─────────────────────────────┘
```

---

### 3. Agrupamentos e justificativas

#### 📂 Central — `/central`
Hub de artefatos transversais ao usuário (não pertencem a uma moto específica ou cruzam várias).

| Item | Origem | Justificativa |
|---|---|---|
| Documentos | `/documents` | Visão consolidada; documentos de moto continuam dentro da própria moto |
| Certificados | `/certificates` | Emitidos pelo usuário; ação pontual, não diária |
| Compartilhamentos | `/transfers` (renomeado) | "Transferências" é técnico; compartilhar/transferir moto é a mesma família |
| Oficinas | `/workshops` | Diretório de terceiros do usuário; baixa frequência de acesso |
| Financeiro | `/financial` | Consolidado multi-moto; o financeiro *da moto* fica no Cockpit |

**Por quê agrupar:** todos são "coisas do meu ecossistema" acessadas com baixa frequência. Um hub com 5 cards grandes é mais confortável no mobile que 5 itens espalhados no menu.

#### 💬 Comunicação — `/comunicacao`
Tudo que é troca de mensagem, alerta ou suporte.

| Item | Origem | Justificativa |
|---|---|---|
| Mensagens | `/messages` | Conversas |
| Chamados | `/tickets` | Suporte |
| Notificações | (hoje só no sino) | Centralizar histórico de notificações |

**Por quê agrupar:** três canais diferentes com a mesma natureza (mensagem recebida/enviada). O sino do header continua para acesso rápido; o hub é o "inbox unificado".

#### 👤 Perfil — `/perfil`
Substitui a seção "Minha Conta" da sidebar por uma tela única.

| Item | Origem |
|---|---|
| Dados | `/profile` |
| Configurações | `/settings` |
| Plano | `/plans` |
| Ajuda | `/help` |
| Sair | ação (com confirm existente) |

**Por quê agrupar:** todos são "sobre mim". Menos ruído no menu; a tela de Perfil vira o ponto único de auto-serviço.

---

### 4. O que **sai** do menu principal

Estes itens deixam de aparecer no menu — passam a viver **dentro do contexto de cada moto** (já existem no Cockpit / Central da Moto):

- Documentos **da moto** (fica em `/motorcycles/$id/control` — Central da Moto)
- Agenda **da moto** (fica no Cockpit + Plano de Manutenção)
- Certificados **da moto** (emissão dentro da moto)
- Financeiro **da moto** (dentro do Cockpit)
- Check-up, Componentes, Plano, Histórico — já são contextuais

Fica valendo a regra: **opções da moto se encontram dentro da moto**.

---

### 5. Mapeamento de rotas

| Rota antiga | Nova localização |
|---|---|
| `/documents` | `/central/documents` (ou permanece, agrupada em Central) |
| `/certificates` | `/central/certificates` |
| `/transfers` | `/central/shares` |
| `/workshops` | `/central/workshops` |
| `/financial` | `/central/financial` |
| `/messages` | `/comunicacao/messages` |
| `/tickets` | `/comunicacao/tickets` |
| `/profile` `/settings` `/plans` `/help` | tabs dentro de `/perfil` |

Rotas antigas mantêm-se funcionando via redirect (para não quebrar links existentes / notificações).

---

### 6. Impacto técnico (resumo)

- **Novos hubs:** `src/routes/_authenticated/central.tsx`, `comunicacao.tsx`, `perfil.tsx` (cada um com grid de cards TB navegando para as sub-rotas).
- **Sidebar (`src/routes/_authenticated/route.tsx`):** reduzir `NAV` de 10 para 5 itens; remover seção "Minha Conta" (vira `/perfil`).
- **`ROUTE_TO_MODULE`** (`src/lib/modules.ts`): mapear as novas rotas para os `moduleKey` existentes para preservar `ModuleGate`.
- **Header:** sino de notificações permanece; adicionar link direto de "Nova moto".
- **Redirects:** manter rotas antigas com `<Navigate to=... replace />` para não quebrar deep links.
- **Zero mudança de business logic** — só arquitetura de navegação + componentes de hub.

---

### 7. Validação após implementação

- ✅ Menu principal com 5 itens (6 se admin)
- ✅ Cada hub abre e lista as sub-áreas em cards mobile-friendly (44px+)
- ✅ Rotas antigas redirecionam sem quebrar bookmarks/notificações
- ✅ Sino de notificações e "Nova moto" continuam no header
- ✅ Admin toggle "Visualizar como Usuário" continua funcional
- ✅ Console limpo · typecheck limpo · mobile confortável

---

**Aguardo aprovação para iniciar a implementação.** Se quiser ajustar nomes (ex: "Central" vs "Meu Espaço", "Comunicação" vs "Mensagens"), ícones dos hubs, ou incluir/excluir algum item de algum grupo, me diga antes que eu comece.
