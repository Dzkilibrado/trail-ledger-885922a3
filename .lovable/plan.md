# PRD-005 — Módulo de Propriedade e Documentação (Sprint 1)

> Proposta para homologação. **Nada será implementado antes do "De Acordo".**
> Substitui e amplia a proposta anterior de "Documento de Origem & Recibo C/V" (`.lovable/plan.md`), agora alinhada ao PRD-005 v1.0.
> Filosofia mantida: **zero menus novos na navegação principal**; tudo entra em fluxos existentes (Cadastro, Central da Moto, Documentos, Passport, Dashboard, Timeline, Auditoria).

---

## 1. Escopo desta Sprint (o que ENTRA)

| Bloco | Entrega |
|---|---|
| **Origem da moto** | Novo passo no wizard de cadastro: "Como esta motocicleta foi adquirida?" (5 opções) |
| **Documentos** | Nota Fiscal + Recibo de Compra e Venda como documentos de 1ª classe, com flag `is_origin_document` |
| **Recibo Inteligente** | Geração de PDF assinável com Código Único, QR Code, Hash SHA-256 e Página Pública de Validação |
| **Transferência entre usuários TB** | Fluxo automatizado (estende `TransferOwnershipDialog`) — vendedor → comprador → recibo gerado automaticamente |
| **Pendências Documentais** | "Enviar Posteriormente" sempre disponível; gera pendência não-bloqueante em Dashboard, Timeline e Auditoria |
| **Propriedade & Documentação** | Nova seção dentro da Central da Moto (não é rota nova) com: Proprietário Atual · Histórico · Documentação · Recibos · Transferências · Auditoria |
| **Passport** | Consome automaticamente proprietário atual, data, documento, status, pendências e nº de proprietários |
| **Viewer + Compartilhamento** | Reuso do viewer existente de `MotorcycleDocuments` |
| **Auditoria + Timeline** | Todos os eventos registrados via `audit_log` + `events` |

## 2. Fora do escopo (confirmado pelo PRD)

Gov.br · ICP-Brasil · DETRAN · Alienação · Financiamento · Copropriedade · Procuração · Biometria · Múltiplos proprietários.

---

## 3. Onde cada peça vive (sem novos menus)

```text
Cadastro da Moto (wizard)
  └─ novo passo "Origem"  →  fluxo por tipo  →  documento OU "enviar depois"

Central da Moto (rota existente motorcycles.$id)
  └─ nova aba/seção "Propriedade & Documentação"
        ├─ Proprietário Atual        (from ownership_history)
        ├─ Histórico de Proprietários (OwnershipTimeline já existe)
        ├─ Documentação              (MotorcycleDocuments existente + filtro NF/Recibo)
        ├─ Recibos                   (novo — lista de smart_receipts da moto)
        ├─ Transferências            (ownership_transfers existente)
        └─ Auditoria                 (audit_log filtrado por motorcycle_id)

Passport (motorcycles.$id.passport)
  └─ novo bloco "Propriedade" no topo (proprietário, aquisição, documento, pendências, #donos)

Dashboard
  └─ novo card "Pendências Documentais" (agrega motos do usuário com pendência)

Timeline
  └─ eventos: origin_set · document_attached · document_pending · receipt_generated · receipt_signed · ownership_transferred
```

Nenhum item novo no menu principal. Nenhuma rota nova de topo.

---

## 4. Fluxos (resumo executivo)

**Zero KM:** pergunta NF → anexar OU enviar depois → conclui. Pendência = "Nota Fiscal pendente".

**Compra Particular / Loja:** NF **OU** Recibo (gerar novo | anexar existente | enviar depois).

**Compra entre usuários TrailBook (100% automatizado):**
```text
Vendedor: "Transferir Motocicleta"
   ↓ seleciona comprador (busca por email/CPF/tel em profiles)
Comprador recebe notificação in-app + e-mail
   ↓ confirma recebimento
Sistema, em uma transação:
   • gera Recibo Inteligente (PDF + QR + hash + código)
   • fecha ownership atual, abre nova em ownership_history
   • dispara audit + timeline + notificações
   • atualiza Passport
```

Sem etapas manuais adicionais. Sem upload de recibo assinado nesta variante (partes já autenticadas na plataforma = assinatura implícita registrada em auditoria).

---

## 5. Recibo Inteligente — anatomia

```text
Código Único:   TB-RCV-YYYY-XXXXXX
Hash SHA-256:   dos bytes do PDF + payload canônico
QR Code:        aponta para https://trailbook.com.br/v/<codigo>
Página Pública: /v/$code  (rota pública, sem auth)
  └─ mostra: código, hash, data, moto (marca/modelo/ano/chassi),
             vendedor (nome + CPF mascarado ***.***.***-NN),
             comprador (idem), valor, status
             + "Verificar autenticidade" (recalcula hash do PDF anexado)
Versionamento:  toda regeneração cria nova versão; hash antigo permanece consultável
```

Conteúdo do PDF (1 página A4) mantém o modelo já homologado no plano anterior, agora com rodapé:
`Código TB-RCV-… · SHA-256: <hash> · Valide em trailbook.com.br/v/<código>`

---

## 6. Modelo de dados (novas estruturas)

Novas tabelas / colunas (detalhes SQL na fase de implementação):

- `motorcycles.origin_type` enum: `zero_km | private | dealer | trailbook_transfer | other`
- `motorcycles.origin_set_at`, `origin_notes`
- `motorcycle_documents.is_origin_document boolean` (índice único parcial por moto)
- `motorcycle_documents.doc_type` estende: adicionar `bill_of_sale`
- **`smart_receipts`** (nova): id, motorcycle_id, code (único), sha256, pdf_path, qr_path, seller_id, buyer_id, negotiation jsonb, status (`draft|issued|signed|cancelled`), version, previous_receipt_id, created_at
- **`document_pendencies`** (view materializada ou tabela leve): motorcycle_id, kind (`origin_document|receipt`), created_at, resolved_at
- Extensão de `audit_log` (só eventos, sem schema change)

Todas com RLS por titularidade + `service_role` + grants explícitos.

---

## 7. Página Pública de Validação — `/v/$code`

Rota pública em `src/routes/v.$code.tsx` (fora do `_authenticated`). SSR-friendly:
- Consulta via server publishable client (SELECT `TO anon` em view segura `public_receipt_validation`).
- Exibe apenas dados não sensíveis (CPF mascarado, sem endereço, sem observações privadas).
- Botão "Verificar autenticidade" faz upload local (browser) do PDF, recalcula SHA-256 client-side e compara.

---

## 8. Impacto técnico

- **PDF**: `pdf-lib` server-side (Worker-compatible), reuso do padrão já validado no projeto.
- **QR Code**: `qrcode` npm (~puro JS, safe no Worker).
- **Hash**: `crypto.subtle` (browser) + `node:crypto` (server) — determinístico.
- **RLS**: `smart_receipts` visível para seller_id, buyer_id e admins; validação pública via view restrita.
- **Frontend**: zero componentes novos de baixo nível. Novos wizards de topo:
  - `OriginStep.tsx` (dentro do cadastro)
  - `PropertyDocSection.tsx` (dentro da Central da Moto)
  - `SmartReceiptWizard.tsx` (estende `TransferOwnershipDialog`)
  - `ReceiptPublicView.tsx` (rota `/v/$code`)
- **Server functions**: `generateSmartReceipt`, `attachOriginDocument`, `confirmTrailbookTransfer`, `validateReceiptPublic` (públic).

---

## 9. Pontos jurídicos que **exigem** validação antes de codar

Herdados da proposta anterior + novos do PRD:
1. Cláusula off-road / garantia entre particulares.
2. Aviso "modelo — não substitui orientação jurídica" nos PDFs.
3. Explicitar que **não substitui** ATPV-e / CRV / DETRAN.
4. LGPD: consentimento explícito de ambas as partes antes do PDF (com registro em auditoria).
5. Retenção do PDF: proposta = permanente para as partes + admin, com auditoria de download.
6. Assinatura implícita na transferência TB (partes autenticadas) — validar se advogado aceita como suficiente sem assinatura física.
7. CPF de menor / representação — bloquear ou permitir com responsável?
8. Página pública `/v/$code` mostra CPF mascarado — validar se mesmo mascarado exige consentimento.

---

## 10. Ordem de execução sugerida (após "De Acordo")

**Fase 1.1 — Base (baixo risco)**
1. Migração: `origin_type` + `is_origin_document` + `doc_type=bill_of_sale` + tabela `smart_receipts` + view pública + grants + RLS.
2. Wizard "Origem" no cadastro (5 opções + "enviar depois").
3. Pendência não-bloqueante: card Dashboard + banner Central da Moto + evento Timeline/Auditoria.
4. Seção "Propriedade & Documentação" na Central (agrega o que já existe: OwnershipTimeline, MotorcycleDocuments, TransferOwnershipDialog).
5. Passport lê `origin_type`, proprietário atual e pendências.

**Fase 1.2 — Recibo Inteligente**
6. Geração de PDF + QR + hash + código (server fn).
7. Página pública `/v/$code` com verificação de autenticidade.
8. Fluxo "Compra entre usuários TrailBook" (estende TransferOwnershipDialog): confirmação bilateral → recibo automático → transferência atômica.

**Fase 1.3 — Homologação**
9. Auditoria completa dos novos eventos, checklist de cenários (5 origens × 3 desfechos).

---

## Filtro de Evolução Controlada

1. **Resolve problema real?** Sim — origem e cadeia de propriedade são o principal ponto fraco de confiança hoje.
2. **Uso frequente?** Origem: 1x por moto (obrigatório na jornada). Transferência: eventual, mas de altíssimo valor.
3. **Cabe em fluxo existente?** Sim — Cadastro, Central, Passport, Dashboard, Timeline, Auditoria. **Zero menus novos.**
4. **Aumenta complexidade?** Não na navegação. Backend cresce (2 tabelas/1 view/2 colunas), mas invisível ao usuário.
5. **Existe mais simples?** Para origem e pendência, não. Para o Recibo Inteligente, o mínimo viável seria PDF sem QR/hash — mas isso quebra o requisito de "Documento Inteligente" do PRD.

**Conclusão:** aderente à filosofia TrailBook e ao PRD-005 v1.0. Aguardando **"De Acordo"** para iniciar a Fase 1.1 (migração + wizard de origem + pendências).
