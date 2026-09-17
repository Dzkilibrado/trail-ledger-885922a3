-- ============================================================
-- MIGRATION 2 — ASSISTENTE TRAILBOOK: SEED
-- platform_modules + 20 artigos (12 FAQ consolidados + 8 novos)
-- + 20 intents + ~60 phrases
--
-- Idempotente via ON CONFLICT + UPSERT por slug/intent_key/phrase.
-- As 27 FAQs atuais são integralmente mapeadas nos 12 artigos
-- consolidados. Nenhum conteúdo é perdido.
-- ============================================================

-- ── Módulo: Assistente TrailBook ──────────────────────────────
INSERT INTO public.platform_modules (key, label, description, status, sort_order)
VALUES (
  'assistente',
  'Assistente TrailBook',
  'Assistente de orientação, ajuda contextual e base de conhecimento para usuários do TrailBook.',
  'beta',
  10
)
ON CONFLICT (key) DO NOTHING;

-- ── ARTIGOS ───────────────────────────────────────────────────
-- UPSERT por slug: re-executar a migration não cria duplicatas,
-- mas atualiza conteúdo se alterado.

-- ARTIGO 1: CPF obrigatório (FAQs 1)
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label, context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'cpf-obrigatorio',
  'Por que preciso informar meu CPF?',
  'O CPF garante que cada moto tenha um dono real, evita cadastros duplicados e dá validade jurídica aos documentos gerados.',
  '## Por que o CPF é obrigatório?

O CPF garante que cada motocicleta tenha um dono real e único no TrailBook, evitando cadastros duplicados e dando validade jurídica aos documentos como o Recibo de Compra e Venda.

Sem CPF validado não é possível gerar documentos oficiais como recibos e laudos.',
  'profile', '/perfil', 'Editar perfil',
  ARRAY['perfil', 'cadastro', 'cpf'], false, 'published', 10
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, updated_at = now();

-- ARTIGO 2: Alterar CPF (FAQ 2)
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label, context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'alterar-cpf',
  'Como alterar meu CPF no TrailBook?',
  'Depois de validado, o CPF só pode ser alterado por chamado no suporte, para proteger seu histórico.',
  '## Alteração de CPF

Após a validação inicial, o CPF fica bloqueado para alteração direta. Isso protege seu histórico e evita fraudes.

**Para alterar:** abra um chamado no suporte informando o motivo. Nossa equipe analisa e realiza a alteração com segurança.',
  'support', '/tickets/new', 'Abrir chamado',
  ARRAY['cpf', 'cadastro', 'suporte'], false, 'published', 20
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, updated_at = now();

-- ARTIGO 3: Atualizar cadastro (FAQs 3, 4)
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label, context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'atualizar-cadastro',
  'Como atualizar meus dados de cadastro?',
  'Acesse Configurações → Dados do perfil para atualizar nome, telefone, endereço e outros dados a qualquer momento.',
  '## Atualizar seus dados

Em **Configurações → Dados do perfil** você pode atualizar:
- Nome completo
- Telefone
- Endereço
- Outros dados pessoais

**Dados obrigatórios:** nome completo, CPF, data de nascimento, telefone e e-mail. Endereço é necessário para documentos oficiais.',
  'profile', '/perfil', 'Ir para perfil',
  ARRAY['perfil', 'cadastro', 'dados'], false, 'published', 30
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, updated_at = now();

-- ARTIGO 4: Documento de origem (FAQs 5, 6, 7)
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label, context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'documento-origem',
  'O que é o Documento de Origem da moto?',
  'É o documento que comprova como a moto chegou até você: Nota Fiscal (moto nova) ou Recibo de Compra e Venda (moto usada).',
  '## Documento de Origem

O Documento de Origem comprova a procedência da sua motocicleta no TrailBook.

**Tipos aceitos:**
- **Nota Fiscal** — para motos novas ou compradas em concessionária/pessoa jurídica
- **Recibo de Compra e Venda** — para motos compradas de outra pessoa física

Você faz o upload do documento no cadastro da moto ou pode adicionar depois no cockpit da moto.',
  'motorcycle', NULL, NULL,
  ARRAY['moto', 'documento', 'origem', 'nota fiscal', 'recibo'], true, 'published', 40
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, updated_at = now();

-- ARTIGO 5: Substituir documento de origem (FAQs 8, 9, 10)
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label, context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'substituir-documento-origem',
  'Como substituir o Documento de Origem?',
  'Você pode enviar um novo documento a qualquer momento. O anterior é mantido no histórico e nunca é apagado.',
  '## Substituindo o Documento de Origem

Você pode substituir o Documento de Origem a qualquer momento no cockpit da sua moto.

**O que acontece com o anterior?**
O TrailBook preserva integralmente o histórico. O documento antigo continua registrado e visível no histórico — apenas deixa de ser o documento ativo.

**Preservação do histórico:**
Toda substituição rebaixa o documento anterior de "ativo" para "histórico". Nenhum dado é apagado. Isso garante rastreabilidade completa da cadeia de propriedade.',
  'motorcycle', NULL, NULL,
  ARRAY['moto', 'documento', 'origem', 'histórico', 'substituir'], true, 'published', 50
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, updated_at = now();

-- ARTIGO 6: Recibo de compra e venda (FAQs 11, 12, 13, 14, 15)
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label, context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'recibo-compra-venda',
  'Como gerar e usar o Recibo de Compra e Venda?',
  'O Recibo é um documento oficial do TrailBook para registrar a negociação de uma moto. Gere no cockpit da moto, receba um PDF e anexe o assinado.',
  '## Recibo de Compra e Venda

O Recibo é um documento oficial gerado pelo TrailBook para registrar a negociação de uma motocicleta entre comprador e vendedor.

**Quando usar:**
Sempre que vender ou comprar uma moto usada. Ele documenta valor, forma de pagamento, data e as partes envolvidas.

**Como gerar:**
Na tela da moto, toque na opção de gerar Recibo. Preencha os dados da negociação e confirme.

**Como imprimir:**
Após gerar, você recebe um PDF pronto para imprimir e assinar fisicamente.

**Após a assinatura:**
Use a opção de anexar o documento assinado para registrá-lo no histórico da moto.',
  'motorcycle', NULL, 'Gerar recibo',
  ARRAY['recibo', 'venda', 'compra', 'documento', 'pdf'], true, 'published', 60
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, updated_at = now();

-- ARTIGO 7: Recibo entre usuários / externo (FAQs 16, 17)
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label, context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'recibo-trailbook-externo',
  'Recibo com comprador no TrailBook ou externo?',
  'Se o comprador usa TrailBook, a transferência é digital. Se for externo, você imprime, colhe a assinatura e anexa o documento.',
  '## Recibo: comprador TrailBook vs externo

**Comprador também usa TrailBook:**
O sistema identifica o comprador pelo CPF e envia uma solicitação para ele aceitar dentro do próprio TrailBook. Não precisa imprimir.

**Comprador externo (não usa TrailBook):**
Você gera o recibo normalmente, imprime, colhe a assinatura física e depois anexa o documento assinado ao histórico da moto.',
  'motorcycle', NULL, NULL,
  ARRAY['recibo', 'venda', 'comprador', 'transferência'], true, 'published', 70
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, updated_at = now();

-- ARTIGO 8: Passaporte Digital (FAQs 18, 19, 20, 21)
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label, context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'passaporte-digital',
  'O que é o Passaporte Digital?',
  'O Passaporte é uma visão pública e confiável da sua moto: modelo, estado de conservação, Selos e resumo do histórico. Você controla o compartilhamento.',
  '## Passaporte Digital

O Passaporte Digital é uma visão pública e confiável da sua motocicleta, criada para facilitar negociações e inspeções.

**O que é exibido:**
Dados da moto, Selos de Qualidade conquistados e resumo do histórico.

**O que NÃO é exibido:**
Documentos privados (Nota Fiscal, Recibo), valores pagos e dados pessoais.

**Quem pode visualizar:**
Qualquer pessoa com o link. Você controla quando gerar e quando desativar.

**Seus documentos ficam públicos?**
Não. Apenas as informações marcadas como públicas aparecem no Passaporte. Seus documentos privados ficam sempre protegidos.',
  'passport', NULL, 'Ver Passaporte',
  ARRAY['passaporte', 'compartilhar', 'link', 'público', 'qrcode'], true, 'published', 80
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, updated_at = now();

-- ARTIGO 9: Selos de Qualidade (FAQs 22, 23, 24, 25)
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label, context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'selos-qualidade',
  'O que são os Selos de Qualidade?',
  'Selos mostram visualmente que sua moto tem histórico comprovado. São conquistados automaticamente ao cumprir critérios. Se um critério for perdido, o selo é retirado.',
  '## Selos de Qualidade

Os Selos mostram, de forma visual, que a sua motocicleta tem histórico comprovado — origem, documentação, manutenções e cadeia de propriedade.

**Como conquistar:**
Os Selos são conquistados automaticamente conforme você cumpre os critérios. Não existe botão para "forçar" um selo.

**Histórico Completo:**
É o selo agregador: sua moto tem origem comprovada, documentação em dia e cadeia de propriedade íntegra.

**Por que um selo sumiu?**
Se uma condição deixou de ser atendida (ex: uma manutenção venceu), o selo é retirado automaticamente. Basta regularizar para reconquistar.',
  'certificate', NULL, 'Ver certificado',
  ARRAY['selos', 'qualidade', 'certificado', 'histórico'], true, 'published', 90
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, updated_at = now();

-- ARTIGO 10: Privacidade de documentos (FAQ 26)
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label, context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'privacidade-documentos',
  'Quem pode ver meus documentos?',
  'Apenas você. Compartilhamento só ocorre via Passaporte Digital (dados públicos) ou Recibo (partes da negociação).',
  '## Privacidade dos seus documentos

**Apenas você** pode visualizar seus documentos privados (Nota Fiscal, Recibo assinado, comprovantes).

**Exceções controladas por você:**
- **Passaporte Digital:** compartilha somente dados públicos — você gera e desativa quando quiser.
- **Recibo de Compra e Venda:** compartilhado apenas com as partes da negociação.',
  'profile', NULL, NULL,
  ARRAY['privacidade', 'documentos', 'segurança'], false, 'published', 100
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, updated_at = now();

-- ARTIGO 11: LGPD (FAQ 27)
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label, context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'lgpd-privacidade',
  'LGPD e privacidade no TrailBook',
  'Seus dados são tratados conforme a LGPD. Você pode consultar, atualizar e solicitar exclusão a qualquer momento pelo suporte.',
  '## LGPD no TrailBook

Seus dados pessoais são tratados conforme a Lei Geral de Proteção de Dados (LGPD).

**Seus direitos:**
- Consultar os dados que temos sobre você
- Solicitar atualização de dados incorretos
- Solicitar exclusão dos seus dados

**Como exercer:**
Entre em contato pelo suporte. Nossa equipe atenderá dentro do prazo legal.',
  'support', '/tickets/new', 'Abrir chamado',
  ARRAY['lgpd', 'privacidade', 'dados', 'segurança'], false, 'published', 110
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, updated_at = now();

-- ARTIGO 12: Cadastrar moto (NOVO)
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label, context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'cadastrar-moto',
  'Como cadastrar uma motocicleta?',
  'Acesse Minhas Motos → Nova Moto e preencha modelo, ano e placa. Em seguida, adicione o Documento de Origem para completar o cadastro.',
  '## Cadastrar sua motocicleta

1. Acesse **Minhas Motos** no menu
2. Toque em **Nova Moto**
3. Preencha: marca, modelo, ano, placa
4. Adicione o Documento de Origem (Nota Fiscal ou Recibo)
5. Adicione fotos da moto (opcional, recomendado)
6. Confirme o cadastro

Após o cadastro, sua moto aparecerá no painel principal e você poderá registrar manutenções, gerar o Passaporte e muito mais.',
  'motorcycle', '/motorcycles/new', 'Cadastrar moto',
  ARRAY['moto', 'cadastro', 'nova moto'], false, 'published', 120
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, updated_at = now();

-- ARTIGO 13: Registrar manutenção (NOVO)
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label, context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'registrar-manutencao',
  'Como registrar uma manutenção?',
  'No cockpit da moto, toque em Registrar Manutenção. Escolha entre Buscar, Catálogo, Mapa, Meus Itens ou Manutenção Geral para adicionar peças e serviços.',
  '## Registrar uma manutenção

1. Abra o cockpit da sua moto
2. Toque em **Registrar Manutenção**
3. Escolha como adicionar itens:
   - **Buscar** — pesquise por nome de peça ou serviço
   - **Catálogo** — navegue por categoria
   - **Mapa da moto** — toque na região da moto
   - **Meus Itens** — sua biblioteca pessoal
   - **Manutenção Geral** — formulário livre
4. Informe quantidade, valor e data
5. Confirme o registro

A manutenção é registrada no histórico e pode contribuir para Selos de Qualidade.',
  'maintenance', NULL, 'Registrar manutenção',
  ARRAY['manutenção', 'registrar', 'troca', 'revisão', 'óleo', 'peça', 'serviço'], true, 'published', 130
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, updated_at = now();

-- ARTIGO 14: Plano de manutenção (NOVO)
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label, context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'plano-manutencao',
  'Como funciona o Plano de Manutenção?',
  'O Plano mostra o que está pendente, em atenção ou em dia na sua moto, baseado nos intervalos de quilometragem e tempo definidos.',
  '## Plano de Manutenção

O Plano de Manutenção organiza os componentes da sua moto em três estados:

- 🟢 **Em dia** — dentro do intervalo de manutenção
- 🟡 **Em atenção** — próximo do vencimento
- 🔴 **Pendente** — vencido ou sem registro

**Como funciona:**
Cada componente tem um intervalo recomendado (km ou tempo). Quando você registra uma manutenção, o componente volta ao estado "em dia".

**Para registrar a manutenção de um item:**
Toque no item → confirme o serviço realizado.',
  'maintenance', NULL, 'Ver plano',
  ARRAY['plano', 'manutenção', 'pendente', 'revisão', 'cronograma', 'intervalo'], true, 'published', 140
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, updated_at = now();

-- ARTIGO 15: Health 4.0 (NOVO)
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label, context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'health-avaliacao',
  'Como funciona o Health 4.0?',
  'O Health avalia a saúde da sua moto com base no histórico de manutenções, documentação e conservação. Quanto mais completo o histórico, melhor a pontuação.',
  '## Health 4.0 — Avaliação da Moto

O Health 4.0 é a avaliação inteligente da saúde da sua motocicleta no TrailBook.

**O que é avaliado:**
- Histórico de manutenções (frequência e completude)
- Documentação (Documento de Origem, fotos)
- Conservação (registros e selos)
- Cadeia de propriedade

**Como melhorar:**
Mantenha o histórico de manutenções sempre atualizado. Adicione o Documento de Origem e fotos da moto.',
  'health', NULL, 'Ver avaliação',
  ARRAY['health', 'avaliação', 'saúde', 'pontuação', 'estado'], true, 'published', 150
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, updated_at = now();

-- ARTIGO 16: Meus Itens (NOVO)
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label, context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'meus-itens',
  'O que são Meus Itens?',
  'Meus Itens é sua biblioteca pessoal de peças, produtos e serviços. Cadastre uma vez e reutilize em todas as suas manutenções futuras.',
  '## Meus Itens — Biblioteca Pessoal

Meus Itens permite criar uma biblioteca pessoal de peças, produtos e serviços que você usa com frequência.

**Benefícios:**
- Cadastre uma vez, use em múltiplas manutenções
- Seus itens ficam disponíveis na Busca e no Catálogo
- Totalmente privado: ninguém mais vê seus itens

**Como usar:**
Em Registrar Manutenção → Meus Itens → pesquise ou cadastre um novo item.',
  'maintenance', NULL, 'Registrar manutenção',
  ARRAY['meus itens', 'biblioteca', 'peça', 'serviço', 'pessoal'], true, 'published', 160
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, updated_at = now();

-- ARTIGO 17: Abrir chamado (NOVO)
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label, context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'abrir-chamado',
  'Como abrir um chamado de suporte?',
  'Acesse Central → Chamados → Novo Chamado. Descreva o problema, escolha a categoria e envie. Você acompanha a resposta pelo próprio app.',
  '## Abrir um chamado de suporte

1. Acesse **Central** no menu
2. Toque em **Chamados**
3. Toque em **Novo Chamado**
4. Escolha a categoria (dúvida, erro, sugestão etc.)
5. Descreva o problema com detalhes
6. Envie

**Acompanhamento:**
Você recebe notificações sobre atualizações do seu chamado. Pode também responder e adicionar informações diretamente no app.',
  'support', '/tickets/new', 'Abrir chamado',
  ARRAY['suporte', 'chamado', 'problema', 'dúvida', 'bug', 'ajuda'], false, 'published', 170
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, updated_at = now();

-- ARTIGO 18: Modo Fiscalização (NOVO)
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label, context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'modo-fiscalizacao',
  'Como funciona o Modo Fiscalização?',
  'O Modo Fiscalização exibe as informações essenciais da moto em uma tela legível para agentes de trânsito, sem expor dados privados.',
  '## Modo Fiscalização

O Modo Fiscalização exibe as informações essenciais da moto (placa, modelo, ano, documento de origem) em uma tela clara e legível para agentes de trânsito.

**O que é exibido:**
Dados públicos da moto. Sem acesso a documentos privados, histórico completo ou dados pessoais.

**Como acessar:**
No cockpit da moto → ícone de fiscalização / modo controle.',
  'fiscal', NULL, 'Abrir modo fiscalização',
  ARRAY['laudo', 'fiscalização', 'controle', 'blitz', 'agente'], true, 'published', 180
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, updated_at = now();

-- ARTIGO 19: Passaporte para venda (NOVO)
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label, context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'usar-passaporte-venda',
  'Como usar o Passaporte para vender a moto?',
  'Gere o link do Passaporte Digital e compartilhe com o comprador. Ele verá o histórico público, Selos e estado de conservação sem precisar de conta no TrailBook.',
  '## Usando o Passaporte na venda

O Passaporte Digital aumenta a confiança do comprador ao mostrar o histórico público da moto.

**Passo a passo:**
1. Abra o cockpit da sua moto
2. Toque em **Passaporte Digital**
3. Gere o link de compartilhamento
4. Envie o link para o comprador (WhatsApp, e-mail, etc.)

O comprador abre o link sem precisar criar conta no TrailBook e vê os Selos, estado de conservação e histórico público.

**Após a venda:**
Desative o link do Passaporte e use o Recibo de Compra e Venda para registrar a transação.',
  'passport', NULL, 'Ver Passaporte',
  ARRAY['passaporte', 'venda', 'compartilhar', 'link', 'comprador'], true, 'published', 190
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, updated_at = now();

-- ARTIGO 20: Editar dados da moto (NOVO)
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label, context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'editar-moto',
  'Como editar os dados da minha moto?',
  'No cockpit da moto, acesse as configurações ou a opção de edição para alterar modelo, ano, placa, foto e outros dados cadastrais.',
  '## Editar os dados da moto

1. Abra o cockpit da sua moto
2. Toque no ícone de edição (lápis) ou acesse as configurações da moto
3. Altere os dados desejados: modelo, ano, placa, foto, apelido
4. Salve as alterações

**Atenção:** a placa e o chassi são usados para identificar a moto. Alterações nesses campos podem exigir validação.',
  'motorcycle', NULL, 'Editar moto',
  ARRAY['editar', 'moto', 'dados', 'placa', 'modelo', 'foto'], true, 'published', 200
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, updated_at = now();

-- ── INTENTS ───────────────────────────────────────────────────

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'cpf_obrigatorio', id, 'Dúvidas sobre CPF no cadastro'
FROM public.help_articles WHERE slug = 'cpf-obrigatorio'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'alterar_cpf', id, 'Alterar CPF após validação'
FROM public.help_articles WHERE slug = 'alterar-cpf'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'atualizar_cadastro', id, 'Atualizar dados pessoais'
FROM public.help_articles WHERE slug = 'atualizar-cadastro'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'documento_origem', id, 'Entender Documento de Origem'
FROM public.help_articles WHERE slug = 'documento-origem'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'substituir_documento', id, 'Trocar Documento de Origem'
FROM public.help_articles WHERE slug = 'substituir-documento-origem'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'gerar_recibo', id, 'Gerar Recibo de Compra e Venda'
FROM public.help_articles WHERE slug = 'recibo-compra-venda'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'recibo_comprador', id, 'Recibo com comprador TrailBook ou externo'
FROM public.help_articles WHERE slug = 'recibo-trailbook-externo'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'passaporte_digital', id, 'Passaporte Digital da moto'
FROM public.help_articles WHERE slug = 'passaporte-digital'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'selos_qualidade', id, 'Selos de Qualidade TrailBook'
FROM public.help_articles WHERE slug = 'selos-qualidade'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'privacidade_docs', id, 'Privacidade de documentos'
FROM public.help_articles WHERE slug = 'privacidade-documentos'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'lgpd', id, 'LGPD e dados pessoais'
FROM public.help_articles WHERE slug = 'lgpd-privacidade'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'add_motorcycle', id, 'Cadastrar nova motocicleta'
FROM public.help_articles WHERE slug = 'cadastrar-moto'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'register_maintenance', id, 'Registrar manutenção na moto'
FROM public.help_articles WHERE slug = 'registrar-manutencao'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'view_plan', id, 'Plano de manutenção da moto'
FROM public.help_articles WHERE slug = 'plano-manutencao'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'view_health', id, 'Avaliação Health da moto'
FROM public.help_articles WHERE slug = 'health-avaliacao'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'my_items', id, 'Meus Itens — biblioteca pessoal'
FROM public.help_articles WHERE slug = 'meus-itens'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'open_support', id, 'Abrir chamado de suporte'
FROM public.help_articles WHERE slug = 'abrir-chamado'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'fiscal_mode', id, 'Modo Fiscalização / Laudo'
FROM public.help_articles WHERE slug = 'modo-fiscalizacao'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'view_passport', id, 'Usar Passaporte para vender'
FROM public.help_articles WHERE slug = 'usar-passaporte-venda'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'edit_motorcycle', id, 'Editar dados da moto'
FROM public.help_articles WHERE slug = 'editar-moto'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

-- ── PHRASES ───────────────────────────────────────────────────
-- Upsert por (intent_id, phrase): re-executar não duplica.
-- Usando subquery para obter intent_id por intent_key.

-- Helper: inserir phrase por intent_key
-- cpf_obrigatorio
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight FROM public.help_intents i,
  (VALUES
    ('por que preciso do cpf', 3),
    ('cpf obrigatorio', 3),
    ('para que serve o cpf', 2),
    ('cpf no trailbook', 2)
  ) AS p(phrase, weight) WHERE i.intent_key = 'cpf_obrigatorio'
ON CONFLICT DO NOTHING;

-- alterar_cpf
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight FROM public.help_intents i,
  (VALUES
    ('alterar cpf', 3),
    ('mudar cpf', 3),
    ('trocar cpf', 2),
    ('corrigir cpf', 2)
  ) AS p(phrase, weight) WHERE i.intent_key = 'alterar_cpf'
ON CONFLICT DO NOTHING;

-- atualizar_cadastro
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight FROM public.help_intents i,
  (VALUES
    ('atualizar cadastro', 3),
    ('alterar dados pessoais', 3),
    ('mudar meu nome', 2),
    ('atualizar telefone', 2),
    ('editar perfil', 2),
    ('dados obrigatorios', 2)
  ) AS p(phrase, weight) WHERE i.intent_key = 'atualizar_cadastro'
ON CONFLICT DO NOTHING;

-- documento_origem
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight FROM public.help_intents i,
  (VALUES
    ('documento de origem', 3),
    ('nota fiscal moto', 3),
    ('comprovante de compra', 2),
    ('recibo de origem', 2),
    ('origem da moto', 2)
  ) AS p(phrase, weight) WHERE i.intent_key = 'documento_origem'
ON CONFLICT DO NOTHING;

-- substituir_documento
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight FROM public.help_intents i,
  (VALUES
    ('trocar documento de origem', 3),
    ('substituir documento', 3),
    ('novo documento', 2),
    ('historico apagado', 2)
  ) AS p(phrase, weight) WHERE i.intent_key = 'substituir_documento'
ON CONFLICT DO NOTHING;

-- gerar_recibo
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight FROM public.help_intents i,
  (VALUES
    ('gerar recibo', 3),
    ('recibo de compra e venda', 3),
    ('vender moto', 3),
    ('documento de venda', 2),
    ('comprovante de venda', 2),
    ('imprimir recibo', 2)
  ) AS p(phrase, weight) WHERE i.intent_key = 'gerar_recibo'
ON CONFLICT DO NOTHING;

-- recibo_comprador
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight FROM public.help_intents i,
  (VALUES
    ('comprador trailbook', 3),
    ('comprador externo', 3),
    ('transferencia digital', 2),
    ('recibo sem imprimir', 2)
  ) AS p(phrase, weight) WHERE i.intent_key = 'recibo_comprador'
ON CONFLICT DO NOTHING;

-- passaporte_digital
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight FROM public.help_intents i,
  (VALUES
    ('passaporte digital', 3),
    ('o que e o passaporte', 3),
    ('link da moto', 2),
    ('compartilhar moto', 2),
    ('quem ve o passaporte', 2)
  ) AS p(phrase, weight) WHERE i.intent_key = 'passaporte_digital'
ON CONFLICT DO NOTHING;

-- selos_qualidade
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight FROM public.help_intents i,
  (VALUES
    ('selos de qualidade', 3),
    ('conquistar selos', 3),
    ('selo sumiu', 3),
    ('historico completo', 2),
    ('certificado trailbook', 2)
  ) AS p(phrase, weight) WHERE i.intent_key = 'selos_qualidade'
ON CONFLICT DO NOTHING;

-- privacidade_docs
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight FROM public.help_intents i,
  (VALUES
    ('quem ve meus documentos', 3),
    ('documentos publicos', 3),
    ('privacidade', 2),
    ('minha nota fiscal publica', 2)
  ) AS p(phrase, weight) WHERE i.intent_key = 'privacidade_docs'
ON CONFLICT DO NOTHING;

-- lgpd
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight FROM public.help_intents i,
  (VALUES
    ('lgpd', 3),
    ('lei de protecao de dados', 3),
    ('excluir meus dados', 2),
    ('solicitar exclusao', 2)
  ) AS p(phrase, weight) WHERE i.intent_key = 'lgpd'
ON CONFLICT DO NOTHING;

-- add_motorcycle
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight FROM public.help_intents i,
  (VALUES
    ('cadastrar moto', 3),
    ('adicionar moto', 3),
    ('nova moto', 3),
    ('registrar motocicleta', 2),
    ('como cadastro minha moto', 2)
  ) AS p(phrase, weight) WHERE i.intent_key = 'add_motorcycle'
ON CONFLICT DO NOTHING;

-- register_maintenance
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight FROM public.help_intents i,
  (VALUES
    ('registrar manutencao', 3),
    ('troquei o oleo', 3),
    ('fiz revisao', 3),
    ('adicionar peca', 2),
    ('lancar servico', 2),
    ('lancar revisao', 2),
    ('como registro manutencao', 2)
  ) AS p(phrase, weight) WHERE i.intent_key = 'register_maintenance'
ON CONFLICT DO NOTHING;

-- view_plan
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight FROM public.help_intents i,
  (VALUES
    ('plano de manutencao', 3),
    ('proxima revisao', 3),
    ('quando trocar', 2),
    ('cronograma', 2),
    ('manutencao pendente', 2),
    ('quando fazer revisao', 2)
  ) AS p(phrase, weight) WHERE i.intent_key = 'view_plan'
ON CONFLICT DO NOTHING;

-- view_health
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight FROM public.help_intents i,
  (VALUES
    ('health', 3),
    ('saude da moto', 3),
    ('avaliacao da moto', 3),
    ('estado da moto', 2),
    ('pontuacao', 2)
  ) AS p(phrase, weight) WHERE i.intent_key = 'view_health'
ON CONFLICT DO NOTHING;

-- my_items
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight FROM public.help_intents i,
  (VALUES
    ('meus itens', 3),
    ('biblioteca pessoal', 3),
    ('pecas salvas', 2),
    ('servicos cadastrados', 2),
    ('itens pessoais', 2)
  ) AS p(phrase, weight) WHERE i.intent_key = 'my_items'
ON CONFLICT DO NOTHING;

-- open_support
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight FROM public.help_intents i,
  (VALUES
    ('abrir chamado', 3),
    ('suporte', 3),
    ('problema no sistema', 2),
    ('bug', 2),
    ('preciso de ajuda', 2),
    ('duvida nao respondida', 2)
  ) AS p(phrase, weight) WHERE i.intent_key = 'open_support'
ON CONFLICT DO NOTHING;

-- fiscal_mode
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight FROM public.help_intents i,
  (VALUES
    ('modo fiscalizacao', 3),
    ('laudo', 3),
    ('blitz', 3),
    ('agente de transito', 2),
    ('modo controle', 2)
  ) AS p(phrase, weight) WHERE i.intent_key = 'fiscal_mode'
ON CONFLICT DO NOTHING;

-- view_passport
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight FROM public.help_intents i,
  (VALUES
    ('mostrar passaporte para comprador', 3),
    ('compartilhar historico', 3),
    ('passaporte na venda', 3),
    ('link para vender', 2),
    ('qrcode da moto', 2)
  ) AS p(phrase, weight) WHERE i.intent_key = 'view_passport'
ON CONFLICT DO NOTHING;

-- edit_motorcycle
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight FROM public.help_intents i,
  (VALUES
    ('editar moto', 3),
    ('alterar dados da moto', 3),
    ('corrigir cadastro da moto', 2),
    ('mudar placa', 2),
    ('mudar foto da moto', 2)
  ) AS p(phrase, weight) WHERE i.intent_key = 'edit_motorcycle'
ON CONFLICT DO NOTHING;

-- ── Reload schema ─────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
