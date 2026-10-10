# Correção 01 — liberação autorizada em 10/10/2026

## Aplicação e preservação

Autorização recebida permite aplicação e publicação sem homologação integral prévia. Aplicada a proposta original, SHA-256 `3cc610dd7f94f3c1a7b20f8ac342f7169840d6def8c858301e65a13021e5f702`, registrada automaticamente como `drizzle/migrations/0000_health_report_public_privacy.sql`.

A conferência real identificou `allowed_sections` como JSONB, enquanto a simulação anterior usava text[]. O link ativo falhou com `unnest(jsonb)`. Corrigido para frente, sem restaurar funções vulneráveis, pela migration específica `drizzle/migrations/0001_health_report_jsonb_sections.sql`; proposta de evidência em `docs/security/migrations/20261010033000_health_report_jsonb_sections.sql`. Nenhuma migration antiga foi reaplicada. O teste isolado agora reproduz JSONB e verifica rejeição de estruturas malformadas.

Antes e depois de ambas as aplicações, os fingerprints de linhas completas, ordenadas pelo mesmo conteúdo JSON, permaneceram idênticos:

| Conjunto | Quantidade | MD5 agregado antes/depois |
|---|---:|---|
| Laudos | 15 | 0d0aa4c1158e570c800cabd017c43170 |
| Snapshots | 15 | 8b5c711f73acfaa99e57bfb54331a382 |
| Compartilhamentos | 5 | 50d1f6fad373a83c120cff0f7754a7ad |
| Documentos | 18 | c9c2ed18c43a671d39d8942cb65ad353 |

Não foram modificados documentos, hashes, tokens, prazos, revogações ou conteúdo histórico. Acesso público ao relatório e validação continuam disponíveis para anon/authenticated; caminhos documentais só podem ser autorizados pelo serviço. Os helpers não são RPCs públicas.

## Verificações

- 191 testes aprovados em seis arquivos, incluindo 58 de privacidade; o total anterior de 190 permanece aprovado.
- Sinal automático de build OK após aplicações e testes.
- RPC anônima real: link comprador sem expiração retorna somente campos permitidos, sem erro.
- Página real do comprador ativo abre sem login; quatro links existentes expirados permanecem indisponíveis corretamente, inclusive três fiscais. Nenhum erro de página detectado.
- Entrada e sessão autenticada verificadas em localhost; início `/dashboard` renderiza. Isso não comprova senha, Google ou envio de e-mail.
- QR de laudos usa o link `/l/` gerado pela aplicação; a alegação de rota `/v/` necessária não corresponde ao contrato atual. Decodificação e PDF fiscais sintéticos já validados anteriormente.
- Scanner de backend concluído às 03:26:47 UTC: sem achados críticos, uma advertência e seis informativos preexistentes; não é garantia universal de segurança.

## Pendências explícitas

Não há link fiscal vigente entre os cinco registros existentes; não reativar nem mudar prazo para testar. Abertura fiscal válida, assinatura/download real e expiração do armazenamento continuam pendentes de homologação. Nomes desconhecidos em texto livre não possuem anonimização semântica universal.

GitHub principal não verificável: não existe conexão GitHub acessível nesta sessão. Não confundir commits automáticos no armazenamento Lovable com sincronização confirmada em `Dzklibrado/trail-ledger-885922a3`.

O pedido de publicação e sua verificação posterior devem ser distinguidos: agendamento não comprova implantação concluída. Evidências operacionais temporárias ficam em `/tmp/browser/release01/`, sem tokens em relatórios.