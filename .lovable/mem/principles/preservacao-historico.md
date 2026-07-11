---
name: Preservação de Histórico (Prontuário Digital)
description: TrailBook nunca apaga registros documentais; substituições apenas alternam qual é o "atual"
type: principle
---

O TrailBook é um Prontuário Digital de motocicletas. Histórico jamais é
destruído em fluxos comuns — apenas o **estado atual** muda.

## Regras invioláveis

Ao substituir um Documento de Origem (ou qualquer outro documento com
conceito de "atual"), NUNCA:

- excluir o registro anterior no banco;
- remover o arquivo do storage;
- sobrescrever `storage_path`, `file_name`, `sha256`, `created_by`, `created_at`;
- perder metadados de auditoria.

O novo documento entra como uma nova linha:

- `is_current = true`
- `is_origin_document = true` (quando aplicável)

O documento anteriormente ativo é apenas rebaixado:

- `is_current = false`
- `is_origin_document = false`

Todo o restante (arquivo original, autor, data de inclusão, tipo, versão,
trilha de auditoria) permanece disponível para consulta na Central de
Documentos, na linha do tempo e nos exports.

## Onde aplicar

- Central de Documentos (upload / substituição / modo "origem")
- Fotos oficiais, laudos, certificados versionados
- Qualquer módulo futuro que exponha o conceito de "versão atual"

## Exceções permitidas

- **Lixeira**: soft-delete com `deleted_at` mantém a linha; hard-delete só
  após consentimento explícito do dono (e nunca apaga a auditoria).
- **Admin**: purga por LGPD, sob ticket e trilha imutável.