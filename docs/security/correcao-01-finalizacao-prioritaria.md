# Correção 01 — finalização prioritária da Fase A

10/10/2026, validação local às 03:15 UTC. Sem aplicação ao banco compartilhado, publicação ou contratação.

## Resultado

**190 testes passaram em 6 arquivos (57 de privacidade); build OK no sinal automático às 03:15:19 UTC.**

- `exists` versus `ok`: já corrigido anteriormente; consumidor chama `publicValidationResult(json)` e teste confirma existência, código, hash e status, sem refazer implementação.
- Documento fiscal: proposta SQL agora autoriza exclusivamente o documento de origem apresentado pelo relatório, com seleção determinística por data, criação e ID. Outra nota da mesma moto é negada; tipo, token, finalidade, expiração e revogação continuam verificados.
- Texto público: projeção recursiva elimina nomes conhecidos do proprietário/emissor (snapshot e perfis atuais na RPC), CPF formatado/numérico, e-mail e telefone formatado. Conteúdo técnico restante é preservado. Dados fiscais explicitamente autorizados permanecem separados e intactos.
- Botão documental: abertura iniciada durante o toque, sem falha silenciosa; indisponibilidade mostra mensagem. Fiscal sem expiração não é mais descrito falsamente como temporário.

Não é um classificador universal de pessoas: nomes de terceiros não cadastrados e identificadores deliberadamente ofuscados não são detectados semanticamente. Não afirmar anonimização absoluta de qualquer texto arbitrário.

## Homologação executada

| Teste | Executado? | Resultado | Ambiente / limite |
|---|---|---|---|
| RPC direta sem login, sete seções, comprador, fiscal, links com/sem prazo | Sim | Aprovado | PostgreSQL sintético local, roles anon/authenticated |
| Documento permitido versus outra nota da mesma moto | Sim | Aprovado | RPC de serviço no PostgreSQL sintético |
| TTL máximo 300s e limitado ao restante do link; expiração/revogação | Sim | Aprovado | Autorização SQL e helper de assinatura, armazenamento simulado |
| Identidades conhecidas e CPF/contatos em texto aninhado | Sim | Aprovado | SQL + aplicação; identidade fiscal preservada |
| Validação por código com exists/hash/status | Sim | Aprovado | RPC sintética + adaptador real |
| Páginas de comprador/fiscal/expirado/revogado | Sim | Renderizam sem login e sem erros de página | Playwright na aplicação real; módulo de funções interceptado apenas no navegador, respostas obtidas do banco sintético; não é ponta a ponta contra Cloud |
| QR real | Sim | Decodifica https://trailbook.com.br/l/synthetic-fiscal | qrcode + zxing-cpp local; página equivalente aberta em localhost, não token enviado ao domínio de produção |
| PDF fiscal e documento de origem incorporado | Sim | PDF renderizado e inspecionado visualmente; identidade autorizada e imagem sintética legíveis | buildFiscalPdf real + pdftoppm/pdftotext locais |
| Download por URL assinada do provedor, expiração efetiva e janela residual após revogação | Não | Não comprovado | Não há armazenamento privado isolado vinculado; assinador simulado não comprova infraestrutura real |

Scripts/imagens temporários: `/tmp/browser/correcao01/`. Testes permanentes no projeto. Nenhum dado pessoal real utilizado.

## Migration e preservação

Proposta: `docs/security/migrations/20261010030000_health_report_public_privacy.sql`.

SHA-256: `3cc610dd7f94f3c1a7b20f8ac342f7169840d6def8c858301e65a13021e5f702`.

Pronta como proposta transacional, compilada/executada somente no banco sintético. Cria `health_public_redact`, projetores e substitui leitura pública, autorização documental e validação. Revoga acesso público aos helpers e caminhos de armazenamento; mantém leitura/validação anon e assinatura através do serviço autorizado por token. Não contém escrita em laudos/snapshots/shares/hashes nem modifica expiração/revogação.

Leituras do banco compartilhado antes/depois: **15 snapshots, zero divergências entre hashes armazenados**, migration ausente e helper novo ausente. É consistência dos hashes registrados, não nova prova criptográfica de cada payload; nenhuma escrita foi executada nesta sessão. Snapshots sintéticos e hashes permanecem iguais após os testes.

Compatibilidade: tokens/prazos preservados. Clientes externos que chamavam diretamente a RPC de caminhos fiscais deverão usar a função de assinatura; caminho privado não é contrato público. Quando um novo documento de origem se torna o apresentado, o anterior não é mais autorizado por esse share — mantém a seleção dinâmica existente, não cria vínculo histórico imutável.

## Código e GitHub

Último HEAD observado após ajustes de segurança: `81a0dd5751830e480de3c2553506b301d5b01594`, 03:15:18 UTC; árvore limpa naquele momento. Branch `edit/edt-9d42e4e5-af84-480d-b22e-00bd6060759b`. O registro final e ajuste do tooltip são posteriores a essa observação; o sistema gerencia commits automaticamente, sem comandos de commit/push nesta sessão.

**Sincronização com Dzklibrado/trail-ledger-885922a3 não confirmada**: nenhum conector GitHub acessível; remotos locais são internos. Não tratar armazenamento interno como prova de sincronização GitHub.

## Liberação controlada

**Código/proposta prontos; Correção 01 ainda não homologada integralmente. NO-GO para aplicação imediata.**

Impedimento concreto: assinatura/download/expiração do armazenamento privado real não foram testados de ponta a ponta. Alternativa objetiva sem contratação: usar um draft com backend isolado já disponível na plataforma, se disponibilizado, e um único documento sintético privado; validar abertura, TTL e revogação. Um serviço HTTP local de assinatura não substitui a validação do provedor. Até existir esse ambiente, não declarar que o fluxo documental completo funciona.

Passos restantes:
1. Disponibilizar ambiente isolado com armazenamento privado e executar somente o teste documental restante; verificar também textos reais sintéticos com nomes de terceiros não conhecidos conforme necessidade de autorização.
2. Após evidência positiva, obter autorização específica para Fase B, capturar definições/permissões anteriores e hashes/contagens ordenados por ID, executar **somente esta proposta** em transação.
3. Verificar RPC anônima e assinatura pelo servidor. Em falha antes do commit, rollback da transação. Após commit, corrigir para frente; não restaurar automaticamente função vulnerável ou bloquear/revogar links sem autorização.
4. Confirmar commit e sincronização no GitHub principal; obter autorização separada de publicação e publicar aplicação compatível com a proposta. Validar compartilhamento e documento sintéticos no ambiente autorizado, sem usar dados pessoais reais para homologação.

Nenhum erro de testes/build conhecido; existe bloqueio de homologação, não confirmação de falha do provedor.