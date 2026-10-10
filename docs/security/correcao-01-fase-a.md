# TrailBook — Correção 01: entrega da Fase A

Data: 10/10/2026, UTC. Implementação e validação disponíveis concluídas. **Nenhuma migration aplicada ao banco compartilhado; nenhuma publicação realizada.**

## Decisão

**NO-GO para aplicação imediata em produção.** Os testes isolados passaram, mas a abertura de URLs assinadas reais e o fluxo fiscal completo no ambiente equivalente ao publicado ainda não foram homologados. Não criar acessos fiscais reais para contornar essa restrição. A aplicação depende de autorização específica da Fase B e dos critérios abaixo.

O risco original da RPC direta **continua no banco compartilhado** até aplicar a proposta; a defesa adicional da aplicação não substitui essa aplicação.

## Migration proposta, não aplicada

Identificação: `20261010030000_health_report_public_privacy`.

Arquivo: `docs/security/migrations/20261010030000_health_report_public_privacy.sql`. Mantido fora do diretório gerenciado de migrations para impedir aplicação acidental. É um script transacional independente, não uma migration registrada como aplicada.

SHA-256: `7247099e4eea5ee9aac533fe838b755dac36a3af7e4469990b87fc3ed2e547c4`.

Objetos propostos:

| Objeto | Alteração |
|---|---|
| `get_public_health_report(text)` | Filtra snapshot antes da resposta; aplica seções; remove share_id e motivos livres; mantém token, vínculo, expiração e revogação |
| `health_public_project(jsonb,jsonb)` | Helper recursivo por lista explícita e tipos; não executável por público/anon/autenticados |
| `health_public_snapshot(jsonb,text[])` | Helper de seleção de seções; não executável por público/anon/autenticados |
| `get_fiscal_document_url(text,uuid)` | Só service_role; identificação fiscal autorizada, vínculo com moto, tipo documental e TTL com arredondamento para baixo |
| `validate_health_report(text)` | Só metadados; remove outdated_reason livre, sem snapshot |

Remover EXECUTE de PUBLIC nas três RPCs. Conceder EXECUTE em leitura pública/validação somente a anon, authenticated e service_role; RPC documental somente a service_role. Nenhuma tabela, política ou registro modificado pela proposta. search_path explícito e nomes de tabelas qualificados.

## Contrato de privacidade

- Metadados mínimos: emissão, formato, validade e aviso. Versões internas da inteligência não são exportadas.
- Identificação: somente campos autorizados da moto; sem UUID, apelido livre ou foto privada.
- Resumo, componentes, plano, histórico, índices e ressalvas só nas respectivas seções.
- Objetos e arrays reconstruídos por lista explícita; novos campos não atravessam automaticamente.
- Sem owner, issuedBy, dataSources, scheduleId, rulesFired, títulos livres de eventos ou notas livres de inspeções.
- Campos de diagnóstico e recomendações gerados pela inteligência permanecem na seção autorizada; a lista de campos não é uma ferramenta universal de remoção de dados pessoais embutidos em qualquer texto. Caso textos de entrada livres contaminem esses campos, deve-se revisar sua origem antes de homologar produção.
- Configuração nula ou somente nomes desconhecidos: nenhuma seção; combinação com desconhecidos: somente as conhecidas. Snapshot inexistente ou não objeto: falha fechada.

### Fiscalização Digital

Interseção obrigatória das seções autorizadas com identification/summary. Componentes, histórico, índices, ressalvas e plano nunca liberados por manipulação de allowed_sections nesse preset.

Nome e CPF completo do **owner_id do laudo**, não do emissor, e referência a documento de origem da mesma moto só com preset fiscal e identification autorizada. CPF permanece fora do snapshot. Sem identification, nenhuma informação fiscal nem documento.

RPC documental verifica token, expiração/revogação, laudo, moto e invoice/bill_of_sale antes da assinatura. A aplicação usa o cliente de serviço gerado, carregado apenas no servidor. URLs limitadas a 300 segundos e ao tempo restante; URLs já emitidas têm janela residual até seu TTL. PDFs baixados não são revogados remotamente.

As regras pré-existentes de status de emissão/apresentação fiscal não foram ampliadas nesta correção; não foi imposta uma nova invalidação por status aos links históricos.

## Compartilhamentos existentes: leitura sem tokens ou dados pessoais

Foram encontrados cinco: três fiscais expirados; um comprador expirado; um comprador sem expiração, ativo. Nenhum revogado, removido ou prorrogado.

Consulta direta à RPC **atual** confirmou quatro respostas expired e uma ok. Uma matriz equivalente foi testada com tokens sintéticos na RPC corrigida isolada: quatro negativas e uma resposta sanitizada. Isso **não comprova ainda a execução da nova RPC contra os cinco registros reais**, pois sua aplicação foi proibida.

Comprador sem expiração: mantém acesso enquanto não revogado; risco de circulação do link por prazo indefinido. Recomenda-se futuramente expiração padrão e renovação consciente, com autorização separada antes de alterar links existentes. Nenhuma alteração de política ou prazo nesta entrega.

## Evidências e resultados

- PostgreSQL nativo standalone em 127.0.0.1:55432, cluster em /tmp, sem conexão ao banco compartilhado. Schema mínimo sintético, não réplica integral de produção.
- Script SQL proposto executado integralmente nesse ambiente, incluindo grants/revokes.
- **171 testes passaram em 6 arquivos**, incluindo **38 testes novos** de privacidade e 16 testes fiscais existentes.
- Chamadas diretas como anon e authenticated; papel externo sem EXECUTE herdado de PUBLIC; acesso negado a helpers/caminhos documentais; RLS sintética impedindo leitura do snapshot.
- Token válido/inválido/vazio, expiração/instante-limite, revogação de share/laudo, ausência de laudo/snapshot, seção individual, combinação desconhecida/nula, arrays malformados, ausência de sentinelas privadas e idempotência SQL/aplicação.
- PDF fiscal real gerado por jsPDF a partir do resultado sanitizado: cabeçalho PDF válido, CPF fiscal presente, sentinela privada ausente.
- Assinatura documental: adaptador testado com autorização SQL real e armazenamento simulado; caminho/TTL exatos e nenhuma assinatura quando não autorizado. **URL assinada real e download do arquivo não verificados.**
- Consumidor ReportSnapshotView renderizado com resposta parcial sem erro. Visualização privada mantém campos exclusivos quando recebe snapshot privado.
- Playwright na prévia: token sintético inválido mostra “Laudo indisponível / Este link não é válido”; zero erros de página. **Página fiscal válida completa com documento real não verificada.**
- Verificação automática do projeto: **build OK**. Não executado build manual; usados os sinais da plataforma.
- 15 snapshots reais; 0 divergências entre hashes armazenados do laudo e snapshot. Fingerprint de conteúdo antes/depois: `bb753c8af82bcfc45753964eb7239145` em ambas as leituras. Não equivale a novo cálculo de SHA-256 canônico individual; nenhum hash foi recalculado ou substituído.

## Arquivos alterados/criados

- `src/lib/health-reports.functions.ts`
- `src/lib/health-reports/public-payload.ts`
- `src/lib/health-reports/public-policy.json`
- `src/lib/health-reports/public-types.ts`
- `src/lib/health-reports/public-privacy.test.ts`
- `src/lib/health-reports/fiscal-document-signing.ts`
- `src/lib/health-reports/fiscal-pdf.ts`
- `src/lib/health-reports/sections.ts`
- `src/components/health/reports/ReportSnapshotView.tsx`
- `src/components/health/reports/FiscalShareDialog.tsx`
- `src/routes/l.$token.tsx`
- `src/lib/help/texts.ts`
- `src/lib/help/report-sharing-guidance.ts`
- `src/hooks/useAssistant.ts`
- `src/routes/_authenticated/faq.tsx`
- `src/routes/__root.tsx`: estreitamento mínimo de erro desconhecido, necessário para build; sem regra de outro módulo.
- `scripts/security/start-isolated-postgres.py`
- SQL proposto e este relatório em `docs/security/`
- `AGENTS.md`, `roadmap.md` e memória de restrições.

FAQ e Assistente compartilham uma correção local do artigo fiscal, sem escrita na base hospedada. Artigos hospedados permanecem intocados. Se houver leitores externos que consultem artigos diretamente, não receberão essa correção local até atualização autorizada separada.

## Pendências para a Fase B e contingência

1. Autorização específica para aplicar o SQL ao banco compartilhado.
2. Homologar página fiscal, URL assinada e download em ambiente isolado equivalente, com documento sintético e armazenamento privado de teste autorizado; não reutilizar dados pessoais nem criar shares reais.
3. Confirmar consumidores externos: o repositório não contém evidência de todos os clientes fora do TrailBook. Campos removidos podem afetá-los.
4. Antes de aplicar, preservar definições/permissões atuais das três RPCs em registro técnico restrito, conferir novamente objetos, executar transação e testar permissões efetivas.
5. Após aplicação autorizada: conferir cada link existente por resposta sanitizada sem registrar tokens/CPF; repetir fingerprint de integridade e verificar fluxo fiscal e validação por código.
6. Contingência: suspender temporariamente acesso público afetado por restrição de EXECUTE com autorização operacional; correção adiante. Não restaurar automaticamente a função vulnerável. A mudança do banco é imediata, independente da publicação do app.

Histórico antigo de migrations não reconciliado; nenhuma migration antiga reaplicada. Problemas de atomicidade de emissão, imutabilidade parcial e demais achados da auditoria continuam fora do escopo.