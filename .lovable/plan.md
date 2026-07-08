
# Fase C — Central da Moto como Painel Executivo

Proposta antes da implementação. Nada será alterado até homologação.

---

## 1. Estrutura atual

`MotoControlCenter` (501 linhas, 1 tela) empilha hoje **tudo ao mesmo tempo**:

- `PageHeader` + foto + auditoria
- `HealthOverview` completo (score + 4 cards de categoria)
- `ConservationCard` com 3 barras (categorias, docs, histórico)
- `ComponentsList` completa
- `NewEventDialog` inline
- Lista de últimos eventos com `EventActionsMenu`
- `MotorcycleDocuments` (galeria completa)
- `MotorcyclePhotos`
- `OwnershipTimeline`
- Certificados: `CertificateSettingsDialog` + `TransferOwnershipDialog` + QR
- Admin: `PlanCatalogSyncDialog`, `AdminMotoDangerZone`, arquivar/apagar

Tudo isso na **mesma rota** (`/motorcycles/$id/control`). Resultado: rolagem longa, hierarquia visual perdida, missão da tela indefinida.

---

## 2. Princípio: uma tela, uma missão

A Central da Moto tem **uma** missão: **acessar rapidamente tudo relacionado à motocicleta**.

Ela não é o lugar para diagnosticar (Check-up), gerenciar (Componentes), ou operar (registrar evento). É o **índice inteligente** que leva a cada uma dessas áreas.

Nas primeiras 5 segundos o usuário responde:
1. Como está a moto? → **linha compacta de Saúde no topo**
2. Existe algo urgente? → **badge no card afetado**
3. Qual a próxima ação? → **CTA único quando aplicável**
4. Onde encontro o restante? → **6 cards de resumo**

---

## 3. Estrutura proposta

```
┌─────────────────────────────────┐
│ ‹ Voltar · Título · ⋯          │  header limpo, ações secundárias no kebab
├─────────────────────────────────┤
│ Foto compacta (ou empty state) │
├─────────────────────────────────┤
│ ❤️ Saúde · Excelente · 64%      │  linha compacta (mesma do Cockpit)
│    Próxima: troca de óleo · 3h  │
├─────────────────────────────────┤
│ 6 cards resumo (grid 2 col)     │  ← núcleo do painel
│                                 │
│ 🔧 Componentes    📅 Próximas   │
│ 24 cadastrados    2 programadas │
│ 2 atenção         Óleo · 3h     │
│                                 │
│ 📄 Documentos     🏆 Certif.    │
│ Todos válidos     Plano Free    │
│                   1 disponível  │
│                                 │
│ 📈 Histórico      🔁 Transfer.  │
│ Última: 2 dias    Nenhuma ativa │
└─────────────────────────────────┘
```

Cada card = **um resumo objetivo + toque abre a área**. Nada de listas na tela principal.

### Cards e conteúdo do resumo

| Card | Resumo (1–2 linhas) | Ação |
|---|---|---|
| ❤️ **Saúde** | `Score · Status` + próxima pendência | → `/motorcycles/$id/health` |
| 🔧 **Componentes** | `N cadastrados` + `M merecem atenção` (badge âmbar) | → `/motorcycles/$id/components` |
| 📅 **Próximas Manutenções** | `N programadas` + próxima (`Óleo · em 3h`) | → `/motorcycles/$id/plan` |
| 📄 **Documentos** | `Todos válidos` **ou** `N pendentes` (badge) | Bottom sheet |
| 🏆 **Certificados** | Situação do plano + saldo/emissão | Bottom sheet |
| 📈 **Histórico** | `Última atividade: <tipo> · <data>` | Bottom sheet |

---

## 4. Onde vai cada coisa que sai da tela principal

| Antes (inline) | Depois |
|---|---|
| `HealthOverview` completo | Fica apenas no Check-up (rota própria); Central mostra só linha resumo |
| `ComponentsList` inline | Fica só na rota de Componentes |
| `NewEventDialog` inline | Vira ação do card Próximas / atalho no kebab |
| Lista de eventos + `EventActionsMenu` | Bottom sheet do card Histórico (últimos 5 + link "Ver tudo") |
| `MotorcycleDocuments` galeria | Bottom sheet do card Documentos |
| `MotorcyclePhotos` | Ação no kebab do header ("Fotos da moto") |
| `OwnershipTimeline` + `TransferOwnershipDialog` | Card Transferências → bottom sheet |
| `ConservationCard` (3 barras) | **Removido da Central** — a informação já está em Saúde |
| `CertificateSettingsDialog` | Bottom sheet do card Certificados |
| `PlanCatalogSyncDialog` (admin) | Movido para menu ⋯ (admin) |
| `AdminMotoDangerZone` | Menu ⋯ → "Zona de perigo" (bottom sheet confirmando) |
| Arquivar / apagar | Menu ⋯ com confirmação em drawer |

---

## 5. Padrão dos cards (Resumo → Ação → Detalhe)

```tsx
<button className="grid grid-cols-[auto_1fr_auto] ...">
  <IconTonal />               // saúde do card em cor tonal
  <div>
    <Title />                 // "Componentes"
    <Summary />               // "24 cadastrados · 2 atenção"
  </div>
  <ChevronRight />
</button>
```

- Área de toque ≥ 64 px de altura.
- Badge de urgência quando aplicável (âmbar/vermelho).
- `active:scale-[0.98]` como microinteração; nenhum ripple pesado.
- Estados vazios discretos ("—") em vez de blocos com dicas grandes.

---

## 6. Redução estimada

| Métrica | Hoje | Proposto |
|---|---|---|
| Altura total da tela (390 px) | ~4200 px (11+ rolagens) | ~1500 px (2 rolagens) |
| Elementos renderizados de largura total | ~9 | 1 header + 1 foto + 1 linha saúde + 6 cards |
| Diálogos/estados carregados no primeiro paint | ~5 | 0 (todos sob demanda) |
| Cargas de dados no primeiro render | events + schedules + attachments + items + docs + transfers | events + schedules + attachments (sob demanda o resto) |

---

## 7. Impactos técnicos

- Arquivo `src/components/MotoControlCenter.tsx` será **reescrito** como painel executivo (~150 linhas).
- Novos componentes de apresentação em `src/components/cockpit/central/`: `SummaryCard`, `HealthSummaryLine`, `DocumentsSheet`, `HistorySheet`, `CertificatesSheet`, `TransfersSheet`.
- **TIL intacta** — resumos leem do `snapshot` já computado (Saúde, Componentes, Próximas) e de queries dedicadas (Documentos, Transferências).
- Rotas inalteradas. `/motorcycles/$id/control` continua sendo a Central.
- Diálogos/lists existentes (`MotorcycleDocuments`, `OwnershipTimeline`, `TransferOwnershipDialog`, `CertificateSettingsDialog`, `AdminMotoDangerZone`, `PlanCatalogSyncDialog`, `EventActionsMenu`) **reutilizados** dentro dos bottom sheets — sem duplicar lógica.
- Zero mudança de dados, RLS ou migrations.

---

## 8. Ganhos Mobile

- ~75% menos rolagem no primeiro acesso.
- Uma missão clara por tela.
- Áreas de toque generosas e uniformes.
- Descoberta natural via 6 cards visualmente iguais.
- Payload inicial menor → primeira pintura mais rápida no 4G.

---

## 9. Critérios de homologação (espelham os do briefing)

- [ ] Tela responde às 4 perguntas em <5 s.
- [ ] Sem listas extensas na tela principal.
- [ ] Hierarquia visual clara (foto → saúde → 6 cards).
- [ ] Uma ação principal por bloco.
- [ ] Rolagem reduzida (~2 alturas de tela em 390 px).
- [ ] Todas as áreas antigas acessíveis via card ou menu ⋯.
- [ ] Typecheck limpo, console sem erros.
- [ ] Sensação de aplicativo nativo premium.

---

**Aguardo homologação para implementar.** Se quiser trocar quais 6 cards entram, renomear algum bloco, mover a auditoria/QR para outro lugar, ou preservar algo que está previsto sair, me diga antes que eu comece.
