# Correção 01 — esclarecimento incorporado à Fase A

10/10/2026. Complementa a entrega anterior, sem declarar homologação integral.

## Critério obrigatório

Compartilhamento público funcional por link, QR Code e PDF, sem login do destinatário, com conteúdo controlado pela finalidade e permissões do proprietário. Segurança e funcionamento integral devem ser comprovados conjuntamente; bloquear acesso legítimo não conclui a correção.

Links com e sem expiração, prazos e revogação pelo proprietário seguem as regras existentes. Nenhum link real foi alterado. Não foi aplicada migration ao banco compartilhado nem realizada publicação.

## Identificação preservada

- Código público do laudo, emissão, validade, versão de formato e hash: autenticidade e compreensão; preservados.
- Identificação autorizada da moto: TrailBook ID, marca/modelo/anos, placa, chassi mascarado e leituras previstas; preservados na seção identification.
- Fiscal autorizado: nome completo, CPF completo e metadados/documento de origem; preservados, fora do snapshot comum.
- Proprietário/emissor privados, contatos, fontes internas e IDs técnicos sem finalidade pública: não liberados automaticamente.
- Sem nova regra de expiração máxima nem invalidação de links existentes nesta fase.

## Implementação

Corrigido o adaptador de conferência pública: `exists` retornado pela RPC agora é reconhecido, sem confundir existência do documento com status de validade/revogação. Metadados explícitos de autenticidade são preservados. O adaptador não exporta o snapshot nem dados do proprietário. Funções públicas continuam sem middleware de login do destinatário; a autorização documental ocorre por token no servidor.

A proposta SQL permanece inalterada: `20261010030000_health_report_public_privacy.sql`, fora das migrations aplicáveis. Não houve mudança de permissões no backend compartilhado.

## Evidências atualizadas

**187 testes aprovados em 6 arquivos**, incluindo 54 testes da Correção 01. Verificação automática: build OK.

16 novos casos verificam:

- Acesso direto como anon nas modalidades comprador, oficina, personalizado e fiscal, incluindo links com e sem expiração.
- Cada uma das sete seções por RPC completa, com afirmações positivas para campos permitidos e negativas para todas as outras seções.
- Preservação da identificação autorizada e metadados de autenticidade.
- Prazos inalterados após consultas e resposta à revogação em registros sintéticos.
- Conferência por código passando da RPC ao adaptador público, com existência, hash, código e status.

A matriz equivalente aos cinco compartilhamentos usa agora cinco registros sintéticos independentes: três fiscais expirados, um comprador expirado e um comprador sem expiração.

## Limites e pendências

Os testes SQL são diretos no PostgreSQL isolado, não chamadas HTTP ponta a ponta. Nenhum dado pessoal real foi usado.

Continuam pendentes: página válida integrada, QR efetivamente aberto/decodificado, PDF final inspecionado visualmente, documento baixado por URL assinada real, expiração/revogação integrada e revisão de textos permitidos com dados pessoais embutidos. A seleção de documentos fiscais da mesma moto segue a regra existente; não foi restringida arbitrariamente ao documento mais recente.

Necessário ambiente isolado equivalente com armazenamento privado e documentos sintéticos para homologação integral. Esta entrega não altera essa infraestrutura nem solicita aplicação em produção. A Correção 01 permanece aberta; NO-GO para Fase B até comprovar segurança e funcionamento integral, seguido de autorização específica.

O relatório anterior conserva seus números e hash como registro daquela entrega; este complemento atualiza os resultados e corrige a incompatibilidade do adaptador de conferência identificada na validação final.