
# TrailBook — Revisão Geral de UX Mobile

Proposta completa antes de qualquer implementação. Nada será alterado até homologação.

---

## 1. Arquitetura atual (resumo)

**Menu principal (pós-última entrega):** Início · Minhas Motos · Central · Comunicação · Perfil (+ Administração).

**Dentro de uma moto (Cockpit):** foto + saudação + hero de Saúde + próxima ação + stats + 3 cards (Check-up, Componentes, Central da Moto).

**Problemas remanescentes identificados na homologação:**
- Check-up mostra as 4 categorias abertas ao mesmo tempo (Vencidos, Atenção, Sem info, Em dia) → rolagem longa.
- Componentes sem filtros rápidos → lista contínua.
- Central da Moto acumula muita informação simultânea.
- Card de Saúde do Cockpit ocupa muito espaço para pouca informação essencial.
- Próximas Manutenções apresentadas como lista, não como ação.
- Títulos ainda podem cortar em telas estreitas (390px).
- Cabeçalhos com múltiplas ações competindo com o título.
- Empty States inconsistentes.

---

## 2. Arquitetura proposta

### 2.1 Menu principal — mantém 5 módulos

```
🏠 Início · 🏍 Minhas Motos · 📂 Central · 💬 Comunicação · 👤 Perfil
🛡 Administração (admin)
```

Sem novos itens. Toda funcionalidade **da moto** vive **dentro da moto**.

### 2.2 Moto Ativa (oficialização)

- Início mostra **1 moto** (a ativa) + botão "Trocar moto" → **TBBottomSheet** com lista compacta.
- Lista completa "Suas motos (N)" inicia **recolhida**.
- Selecionar moto atualiza contexto global (`useActiveMotorcycle` já existe — apenas oficializar).

### 2.3 Navegação contextual dentro da moto

```
Moto Ativa
 ├─ Cockpit (home da moto)
 ├─ Check-up
 ├─ Componentes
 ├─ Plano / Agenda
 ├─ Histórico
 └─ Central da Moto
     ├─ Documentos
     ├─ Certificados
     ├─ Financeiro
     └─ Transferências
```

Central/Comunicação/Perfil no menu principal seguem sendo **transversais ao usuário** (não da moto).

---

## 3. Redesenho tela a tela

### 3.1 Cockpit (home da moto)
- **Foto**: card compacto quando ausente (já implementado ✓).
- **Saudação**: mantida, uma linha.
- **Saúde**: reduzir hero — linha única `❤️ Saúde · Excelente · 64%` + subtítulo "Próxima: troca de óleo em 3h" (ou "Nenhuma pendência").
- **Próxima ação**: um botão CTA grande apenas quando existir pendência.
- **Áreas**: 3 cards atuais mantidos (Check-up, Componentes, Central).

### 3.2 Check-up Completo (mudança maior)
Substituir as 4 seções abertas por **4 cards executáveis** empilhados:

```
🔴 Vencidos           (2)  ›
🟠 Atenção            (3)  ›
⚪ Sem informação     (4)  ›
🟢 Em dia            (18)  ›
```

Toque abre **TBBottomSheet** com apenas aquela categoria (interface progressiva nível 2). Contagem 0 = card desabilitado com "Nada aqui ✓".

### 3.3 Componentes
- **Empty state** amigável + CTA "Cadastrar componente".
- **TBFilterBar** sticky no topo: `Todos · Atenção · Vencidos · Em dia · Personalizados`.
- Renderiza somente a categoria ativa.

### 3.4 Central da Moto (painel executivo)
Grid de 6 cards resumo, cada um com 1 número + 1 status. Toque abre a área:

```
❤️ Saúde · 64%      🔧 Componentes · 12
📅 Próximas · 3     📄 Documentos · 5
🏆 Certificados · 1 📈 Histórico · 47
```

Sem listas, sem timeline embutida, sem gráficos.

### 3.5 Próximas Manutenções
Cards orientados a ação:

```
Troca de óleo · Em 3h        [ Registrar ]
Filtro de ar  · Em 5 dias    [ Registrar ]
```

Empty state amigável quando não houver.

### 3.6 Cabeçalhos (todas as telas)
Padrão único: `‹ Voltar · Título · Ação principal · ⋯`.
- Título nunca truncado; pode quebrar em 2 linhas (`break-words leading-tight`, já aplicado em `TBPageHeader`).
- Ações secundárias em menu `⋯` (kebab).

### 3.7 Empty states / progressão
Padrão oficial em todo o sistema:
```
Resumo → Filtro/Categoria → Detalhe
```
Nunca exibir tudo simultaneamente.

---

## 4. Menus/telas que mudam de contexto

| Hoje | Vai para |
|---|---|
| Check-up com 4 listas abertas | 4 cards executáveis + bottom sheet |
| Componentes lista contínua | Filtros + categoria única |
| Central da Moto densa | 6 cards resumo |
| Hero de Saúde grande | Linha compacta no Cockpit |
| Próximas manutenções em lista | Cards com botão "Registrar" |

Nenhuma rota nova. Nenhuma mudança de business logic.

---

## 5. Roadmap por fases

**Fase A — Cockpit + Moto Ativa (baixo risco)**
- Compactar hero de Saúde.
- Oficializar bottom sheet de troca de moto no Início.
- Auditoria de títulos e cabeçalhos (PageHeader, TBPageHeader).

**Fase B — Check-up progressivo**
- Trocar 4 seções por 4 cards executáveis + TBBottomSheet por categoria.

**Fase C — Componentes com filtros**
- TBFilterBar sticky + empty state + renderização por categoria.

**Fase D — Central da Moto painel executivo**
- Refatorar `MotoControlCenter` em grid de 6 cards resumo.

**Fase E — Próximas manutenções orientadas a ação**
- Cards com CTA "Registrar" reaproveitando `NewEventDialog`.

**Fase F — Auditoria geral**
- Varredura de todas as telas (390px): truncamento, áreas de toque ≥44px, espaçamento, empty states, consistência.

Cada fase é entregável e homologável isoladamente.

---

## 6. Benefícios Mobile

- Menos rolagem (interface progressiva).
- Menos carga cognitiva (1 categoria por vez).
- Descoberta natural (ações no lugar de listas).
- Áreas de toque generosas (cards executáveis).
- Regra dos 3 toques respeitada em todos os fluxos principais.

## 7. Impactos / riscos

- **Zero** mudança de dados, TIL, RLS, migrations.
- Mudança concentrada em componentes de apresentação.
- Rotas antigas mantidas (redirects já implementados).
- Risco baixo; cada fase reversível.

---

## 8. Detalhes técnicos (referência)

- **TIL intacta** (`src/lib/til/*`) — telas continuam apenas consumindo snapshot.
- **Design system**: usar `TBBottomSheet`, `TBFilterBar`, `TBEmptyState`, `TBActionCard`, `TBKpiCard` já existentes.
- **Componentes tocados**:
  - `src/components/cockpit/Cockpit.tsx` + `widgets/HealthHeroWidget.tsx` (compactação).
  - `src/components/health/HealthOverview.tsx` (4 cards executáveis + sheet).
  - `src/components/components/ComponentsList.tsx` (filtros).
  - `src/components/MotoControlCenter.tsx` (grid de 6 resumos).
  - `src/routes/_authenticated/dashboard.tsx` (bottom sheet oficial).
  - `PageHeader.tsx` / `TBPageHeader.tsx` (auditoria).
- **Sem novas rotas, sem novos hooks, sem novas tabelas.**

---

**Aguardo homologação.** Posso iniciar por qualquer fase — recomendo A → B → C → D → E → F. Se quiser priorizar diferente, ajustar nomes/ícones/agrupamentos, ou remover alguma fase, me diga antes de começar.
