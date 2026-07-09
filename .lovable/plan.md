# Fase 1.2 — Recibo Inteligente & Transferência entre Usuários TrailBook

> Base: Fase 1.1 já entregue (tabela `smart_receipts`, view `public_receipt_validation`, origem da moto, pendências). Nada é reimplementado; esta fase apenas ativa o Recibo e o fluxo automatizado.

## 1. Ajustes solicitados nesta rodada (incorporados)

| # | Solicitação | Onde entra |
|---|---|---|
| 1 | Rodapé institucional "Emitido eletronicamente pelo TrailBook" | PDF (todas as páginas) |
| 2 | Exibir **versão** do documento | PDF + Página Pública |
| 3 | Exibir **status** (Ativo / Substituído / Revogado) | Página Pública (badge topo) |
| 4 | Exibir **data e hora** da emissão | PDF + Página Pública |
| 5 | URL amigável `/r/TB-RCV-2026-000001` | Rota pública renomeada de `/v/$code` → `/r/$code` |
| 6 | Passport consome do módulo, sem duplicar | Passport lê `smart_receipts` + `ownership_history` direto (sem colunas novas) |

## 2. Entregas técnicas

### 2.1 Banco (migração leve)
- Enum `receipt_status`: garantir valores `draft | issued | superseded | revoked` (mapear "Ativo"=`issued`, "Substituído"=`superseded`, "Revogado"=`revoked`).
- Trigger em `smart_receipts`: ao emitir novo recibo (`version > 1`) marcar o anterior como `superseded` e preencher `previous_receipt_id`.
- View `public_receipt_validation` já existe — adicionar colunas `version`, `status`, `issued_at` (mascaradas conforme necessário).
- Server function pública `get_public_receipt(_code text)` (SECURITY DEFINER, retorna somente campos seguros) — invocada pela página `/r/$code`.

### 2.2 Geração de PDF (server function)
- `generateSmartReceipt` (`createServerFn` + `requireSupabaseAuth`):
  1. Valida propriedade (RLS via `context.supabase`).
  2. Monta payload canônico JSON (moto, partes, valores, data/hora ISO, versão).
  3. Gera PDF com `pdf-lib` (A4, 1 página + rodapé em todas):
     - Cabeçalho: logo TrailBook, código `TB-RCV-YYYY-NNNNNN`, versão `v1`, emitido em `dd/mm/aaaa hh:mm` (America/Sao_Paulo).
     - Corpo: dados moto (marca/modelo/ano/chassi/horímetro), vendedor, comprador, valor, forma de pagamento, cláusulas padrão + off-road.
     - QR Code (via `qrcode` npm, canvas→PNG bytes) apontando para `https://trailbook.com.br/r/<code>`.
     - Rodapé institucional (repetido em toda página):
       `Documento emitido eletronicamente pelo TrailBook · Código <code> · Versão v<n> · SHA-256 <hash> · Valide em trailbook.com.br/r/<code>`
  4. Calcula SHA-256 dos bytes finais do PDF.
  5. Faz upload para bucket `smart-receipts` (privado, path `motorcycles/{id}/{code}-v{n}.pdf`).
  6. INSERT em `smart_receipts` com `pdf_path`, `sha256`, `status='issued'`, `version`, `previous_receipt_id`.
  7. Grava `audit_log` + evento na timeline (`receipt_generated`).

### 2.3 Página pública `/r/$code` (nova rota, fora de `_authenticated`)
- Arquivo `src/routes/r.$code.tsx` — SSR, `head()` com título/description dinâmicos e `og:image` opcional.
- Loader chama server fn pública `validateReceiptPublic({ code })` que executa `get_public_receipt` via client publishable + `anon`.
- Layout:
  - **Badge de status** no topo: `Ativo` (verde) · `Substituído` (âmbar, linkando ao novo código) · `Revogado` (vermelho).
  - Bloco: código, versão, data/hora de emissão, hash SHA-256 (mono).
  - Bloco moto: marca/modelo/ano/chassi.
  - Bloco partes: nome + CPF mascarado `***.***.***-NN`.
  - Bloco negociação: valor, forma de pagamento.
  - CTA "Verificar autenticidade": input file client-side → calcula SHA-256 → compara com o hash oficial → mostra ✅/❌.
  - Link para baixar PDF assinado (signed URL curta via server fn).

### 2.4 Fluxo "Transferência entre usuários TrailBook"
- Estende `TransferOwnershipDialog` existente (não cria menu novo):
  1. Vendedor busca comprador por e-mail/CPF (query em `profiles`).
  2. Preenche valor + forma de pagamento + observações + aceite LGPD.
  3. Envia solicitação (já existente via `request_ownership_transfer`).
  4. Comprador recebe notificação in-app; ao aceitar em `/transfers`, dispara server fn `confirmTrailbookTransfer` que **em uma única transação**:
     - Gera Recibo Inteligente (chama internamente `generateSmartReceipt`).
     - Fecha ownership atual, abre nova em `ownership_history`.
     - Marca `ownership_transfers.status='completed'` + `receipt_id`.
     - Grava audit + timeline dos dois lados + notifica vendedor.
- Sem upload manual de recibo assinado nesta variante (assinatura implícita — ambas as partes autenticadas + auditoria).

### 2.5 Integração com Passport (sem duplicar)
- `motorcycles.$id.passport.tsx` passa a ler:
  - Proprietário atual → `ownership_history` (aberto).
  - Histórico de donos → `ownership_history`.
  - Documento de origem → `motorcycle_documents WHERE is_origin_document`.
  - Último recibo → `smart_receipts WHERE status='issued' ORDER BY version DESC LIMIT 1`.
- **Nenhuma coluna nova** em `motorcycles` para essas infos — Passport é apenas leitor.

### 2.6 Storage
- Bucket privado `smart-receipts` (criação idempotente via migração).
- RLS: SELECT restrito ao vendedor, comprador, admins; download público apenas via signed URL emitida por `validateReceiptPublic`.

## 3. Novos arquivos

```text
src/routes/r.$code.tsx                          # página pública (SSR)
src/lib/smart-receipts.functions.ts             # generateSmartReceipt, validateReceiptPublic, confirmTrailbookTransfer, revokeReceipt
src/lib/smart-receipts.server.ts                # PDF/QR/hash helpers (server-only)
src/lib/smart-receipts.ts                       # utils compartilhados (formatação código, status labels)
src/components/receipts/SmartReceiptWizard.tsx  # dentro do TransferOwnershipDialog
src/components/receipts/ReceiptStatusBadge.tsx
src/components/receipts/PublicReceiptView.tsx
```

Arquivos editados:
- `src/components/TransferOwnershipDialog.tsx` (novo passo: dados da negociação)
- `src/routes/_authenticated/motorcycles.$id.passport.tsx` (novo bloco Propriedade & Recibo)
- `src/routes/_authenticated/transfers.tsx` (ação "Aceitar e gerar recibo")

## 4. Dependências npm
- `pdf-lib` (já é padrão validado no projeto)
- `qrcode` (puro JS, Worker-safe)
- Hash: `crypto.subtle` (browser) + `node:crypto` (server) — sem dependência.

## 5. Ordem de execução

1. **Migração**: enum de status + trigger de versão + view atualizada + bucket + `get_public_receipt`.
2. **Server**: helpers de PDF/QR/hash + `generateSmartReceipt` + `validateReceiptPublic`.
3. **Rota pública `/r/$code`** com verificação de autenticidade.
4. **Wizard de transferência TB** + `confirmTrailbookTransfer` transacional.
5. **Passport** consumindo do módulo.
6. **Homologação**: cenários (1ª emissão, reemissão v2, revogação, transferência TB completa, validação pública com hash correto e adulterado).

## 6. Regras jurídicas mantidas da Fase 1.1
- Cláusula off-road no PDF.
- Aviso "não substitui ATPV-e / CRV / DETRAN".
- Consentimento LGPD antes de gerar (checkbox obrigatório no wizard).
- CPF mascarado na página pública.

## 7. Fora do escopo (confirmado)
Gov.br · ICP-Brasil · assinatura digital ICP · DETRAN · alienação · copropriedade. Arquitetura fica pronta para receber esses módulos sem refatoração (campos `signed_at`, `signature_provider` já reservados em `smart_receipts`).
