# Correção — Registrar Uso adicional

## Implementação e resultado
- Exclusivamente o atalho passa a receber quantidade adicional e mostra total atual, uso informado e novo total previsto calculado na TIL.
- Nova função proposta `commit_usage_increment` delega deltas a `commit_event_and_recompose`. Este motor persiste o incremento em `events.hours_delta/km_delta`, recompõe `hours_at_event/km_at_event`, totais da moto e referências `last_done_*` de manutenção na mesma transação.
- Usa o advisory lock oficial por moto (chave 42), trava a linha da moto e consulta identidade persistida `usage_increment_request_id` antes de gravar. Duas solicitações independentes de +10 h resultam em dois eventos e total 30 h a partir de 10 h; repetição da mesma identidade grava somente um evento.
- `commit_usage_reading` não foi modificado; testes de leitura acumulada continuam íntegros. Não existe soma cliente seguida de gravação de um total: o resumo é apenas uma previsão, enquanto o total confirmado vem da recomposição do servidor.
- Todas as consultas ativas são atualizadas antes da confirmação; consultas não montadas ficam invalidadas. Isso abrange início, Cockpit, totais, histórico, próximas manutenções, vencimentos e alertas.

## Evidência
- **267 testes aprovados** em 10 arquivos, incluindo todos os 237 testes anteriores e 30 novos; build automático OK.
- Exemplos persistidos no PostgreSQL sintético isolado: 10 + 10 = 20 h; 10 + 1,5 = 11,5 h; 1500 + 80 = 1580 km.
- Testes adicionais: local vazio, idempotência, duas conexões simultâneas, retroativos aceitos após última leitura e rejeitados antes dela, manutenção/alertas TIL, rollback integral, autorização, zero/negativo/precisão e compatibilidade da leitura acumulada.
- Preview autenticado: rótulo Horas utilizadas (h), resumo 10/10/20 h, rejeição de zero, celular 393 px sem transbordamento e sem erros de execução. Nenhum registro real submetido; a chamada de gravação foi interceptada para comprovar mensagem segura de liberação pendente.

## Liberação autorizada e aplicada — 10/10/2026
SQL proposto: `docs/security/migrations/20261010043000_usage_increment.sql`, fora das migrations autoaplicáveis.

**Aprovação específica recebida: “pode seguir”, 04:30 UTC.** Aplicada como `drizzle/migrations/0003_usage_increment.sql`. Cria somente uma função em public, com execução para authenticated e negação a PUBLIC/anon, conferidas após aplicação. Dependências `is_moto_owner`, `commit_event_and_recompose` e `commit_usage_reading` confirmadas antes da aplicação. Tipos regenerados; cliente usa agora a assinatura tipada.

Função incremental disponível no backend compartilhado. Sem publicação do aplicativo. Fingerprints agregados dos eventos, motocicletas e snapshots idênticos antes/depois; definição de `commit_usage_reading` também idêntica. Nenhum uso real criado para testar.

Após liberação, o preview enviou uma chamada real à nova RPC com quantidade alterada para zero pelo teste: rejeição correta do backend, formulário preservado e nenhum registro criado. Resumo 10 + 10 = 20 h e rótulos confirmados no celular; sem erros de execução. Build automático OK após uso da assinatura tipada.

Reversão/contensão: retirar o acesso à nova função e manter o atalho incremental indisponível; não retornar ao significado acumulado com rótulos de uso adicional. Não excluir registros gerados nem reverter históricos. Não publicar sem autorização.

## Limites preservados
- Usa o calendário America/Sao_Paulo e o posicionamento no fim do dia do atalho anterior, com ordenação secundária `created_at` no motor oficial. A data de hoje recebe horário de fim de dia; consumidores que filtram eventos até `now()` podem exibi-lo posteriormente. Alterar essa convenção exigiria avaliar snapshots existentes, não foi feito neste ajuste.
- Retroativos anteriores à última atividade com uso continuam recusados para não reescrever snapshots históricos; usos na mesma data ou posteriores são aceitos. Eventos sem incremento não estabelecem uma nova leitura de uso no contrato oficial.
- A busca de identidade usa eventos da moto sem índice novo específico de metadata; não foi realizado teste de carga de grandes históricos. Não há contratação de infraestrutura adicional.
- Confirmação visual dos indicadores após uso real fica para homologação do usuário; funcionamento transacional, manutenção e alertas comprovados em dados sintéticos isolados. Suíte reexecutada após aplicação: 267 testes aprovados.