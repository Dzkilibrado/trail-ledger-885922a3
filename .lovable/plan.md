
# Fase 1.2 — Integração de UI (Smart Receipt como Histórico Oficial de Propriedade)

Objetivo: transformar o Recibo Inteligente em **início oficial do Histórico de Propriedade**, incorporado naturalmente ao Passaporte TrailBook, sem criar módulos, menus ou telas novas.

## Princípios aplicados
- Uma tela = uma decisão. Resumo → Ação → Detalhe.
- Nenhum menu novo. Nenhum "Passaporte de Propriedade" separado.
- Mobile Native First: bottom sheets, wizard, cards, timeline.
- Toda lógica derivada — sem duplicar dados. Fontes: `smart_receipts`, `ownership_history`, `motorcycle_documents`, `events`.

## 1. Backend (migração enxuta)

Um único migration, sem novas tabelas de negócio:

- **Trigger `on_receipt_issued`** em `smart_receipts` (AFTER UPDATE OF status WHEN NEW.status='issued'):
  - Fecha `ownership_history` atual do vendedor (`ended_at = now()`).
  - Insere nova linha em `ownership_history` (method=`transfer`, owner=buyer se houver `buyer_user_id`, snapshot do nome externo caso contrário).
  - Marca o PDF do recibo como `is_origin_document=true` em `motorcycle_documents` (upsert de referência ao arquivo do bucket `smart-receipts`), removendo flag do documento anterior.
  - Insere evento em `events` (type=`ownership_transfer`, título "Transferência de propriedade", metadata com `receipt_code`).
  - Insere linha em `audit_log`.
- **View `motorcycle_origin_document_view`**: devolve, por moto, o documento de origem vigente (NF anexada OU recibo mais recente `issued`), com `source_kind` (`invoice|receipt`) e `receipt_code` quando aplicável.
- **RPC `get_active_negotiation(_moto_id)`**: retorna recibo `draft` mais recente da moto (para card na Central).

Sem novas colunas em `motorcycles`. Compatível com futura assinatura (ICP-Brasil/Gov.br/Clicksign) via novas colunas em `smart_receipts` no futuro (`signature_provider`, `signature_status`, `signed_at`, `signed_pdf_path`) — não implementado agora.

## 2. UI — Central da Moto (`MotoControlCenter.tsx`)

- **Ação primária "Vender / Transferir"** abre `EmitReceiptDialog` (já existente) como bottom sheet no mobile.
- **Card de negociação em andamento** (renderizado apenas quando `get_active_negotiation` retorna algo):
  ```
  Compra e Venda • Rascunho
  Comprador: <nome>
  [ Continuar ]  [ Cancelar ]
  ```
- **Banner de origem** atualizado: consome `motorcycle_origin_document_view` e mostra "Documento de origem: Recibo TB-RCV-YYYY-NNNNNN" com link para `/r/<code>` (ou NF quando for o caso). Reaproveita componente já criado.
- **Pendência inteligente** via `useDocumentPendencies`: quando existe recibo `issued` sem PDF assinado anexado (futuro), exibe "Recibo aguardando assinatura → Anexar documento". Hoje o recibo já vira automático o documento de origem; a pendência fica preparada para o fluxo de assinatura futuro (feature-flag off por padrão).

## 3. UI — Passaporte (`motorcycles.$id.passport.tsx`)

Reforça filosofia Resumo → Ação → Detalhe. **Não** cria abas nem sub-rotas.

Layout mobile-first, cards colapsados:

```
[Hero: moto + TrailBook ID + Índice de conservação]

Proprietários            3 registros    [Ver histórico]
Manutenção               58 eventos      [Ver histórico]
Documentos               12 anexos       [Ver documentos]
Recibos & Transferências 2 recibos       [Ver recibos]
Certificados             1 emitido       [Ver certificados]

[Timeline unificada — últimos 5 eventos + "Ver linha da vida completa"]
```

- **Card "Proprietários"** → abre `TBBottomSheet` com `OwnershipTimeline` (já existe). Mostra cronologia: Proprietário 1 → 2 → 3 → Atual.
- **Card "Recibos & Transferências"** → bottom sheet lista recibos (`listReceiptsForMotorcycle`) com status badge, versão, data, ações Ver PDF / Validar publicamente / Revogar (se emissor).
- **Timeline unificada** (`buildTimeline` em `src/lib/passport.ts`) — estendida para incluir entradas derivadas de `smart_receipts` (kind=`sale`/`purchase`) alinhadas com `ownership_history` (evita duplicar: a linha do recibo é a mesma da transferência, com botão "Ver recibo").
- **Bottom sheet "Linha da vida completa"** — timeline paginada, agrupada por ano, com ícones por tipo.

## 4. UI — Fluxos existentes

- **`TransferOwnershipDialog`**: adicionar botão secundário "Emitir recibo agora" que abre `EmitReceiptDialog` já preenchido com dados da transferência (comprador via e-mail TrailBook). O fluxo antigo (solicitação de transferência entre usuários) permanece — recibo passa a ser opcional, mas recomendado.
- **Rota `/r/$code`** (já existe): sem mudanças estruturais, apenas garantir badges de status/versão/data já implementados.
- **Certificados** (`certificates.tsx` / `CertificateSettingsDialog`): nada muda estruturalmente — o certificado já lê `ownership_history`, então a nova entrada aparece automaticamente após o trigger.

## 5. Notificações / experiência

- Após emissão do recibo:
  - Toast: "Recibo TB-RCV-XXXX emitido. Histórico de propriedade atualizado."
  - Invalidate queries: `smart_receipts`, `ownership_history`, `motorcycle_documents`, `events`, `passport`.
- Após emissão, redireciona para o Passaporte com o card "Recibos & Transferências" já aberto.

## 6. Arquivos

**Novos**
- `supabase/migrations/…_receipt_ownership_link.sql` — trigger + view + RPC.
- `src/components/passport/PassportSummaryCard.tsx` — card resumido reutilizável (título, contagem, CTA).
- `src/components/passport/OwnershipHistorySheet.tsx` — bottom sheet com `OwnershipTimeline`.
- `src/components/passport/ReceiptsHistorySheet.tsx` — bottom sheet listando recibos.
- `src/components/passport/PassportLifelineSheet.tsx` — timeline completa paginada.
- `src/components/ActiveNegotiationCard.tsx` — card da Central da Moto.
- `src/hooks/useActiveNegotiation.ts`, `src/hooks/useMotorcycleOriginDocument.ts`.

**Editados**
- `src/components/MotoControlCenter.tsx` — botão vender/transferir, card negociação, banner origem.
- `src/routes/_authenticated/motorcycles.$id.passport.tsx` — nova estrutura em cards + timeline resumida.
- `src/lib/passport.ts` — `buildTimeline` estendido para consolidar recibo↔transferência.
- `src/lib/smart-receipts.ts` — tipo `ActiveNegotiation` + helpers.
- `src/components/TransferOwnershipDialog.tsx` — CTA "Emitir recibo agora".
- `src/components/DocumentPendenciesCard.tsx` — pendência "recibo aguardando assinatura" (feature-flag off).

**Não tocar**: `EmitReceiptDialog`, `ReceiptStatusBadge`, `r.$code.tsx`, geração de PDF/QR/hash.

## 7. Validação (checklist de homologação)

- Emitir recibo → `ownership_history` fecha vendedor e abre comprador, `events` recebe `ownership_transfer`, PDF vira documento de origem, aparece na Central da Moto e no Passaporte sem refresh manual.
- Passaporte: cards com contagens corretas, cada CTA abre bottom sheet, timeline completa mostra recibo e transferência como um único evento vinculado.
- Central da Moto: negociação em rascunho aparece; concluída, some.
- `/r/<code>` continua validando publicamente, status/versão preservados.
- Typecheck limpo, console sem erros, ADR 0004 (mobile-first) respeitada.

## Fora de escopo (arquitetura preparada, não implementada)
- Assinatura eletrônica (ICP-Brasil, Gov.br, Clicksign, DocuSign).
- Fluxo de "anexar PDF assinado" (colunas já previstas no futuro).
- Compra por usuário externo com convite automático (usar fluxo existente `ownership_transfers` quando comprador não tem conta).

Aguardo aprovação para iniciar.
