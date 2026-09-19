-- ============================================================
-- KB REVISION Etapa 2: Fiscalização + Lacunas + Revisões
-- Conteúdo apenas — sem alteração de schema.
-- Idempotente: ON CONFLICT (slug) DO UPDATE em todos os INSERTs.
-- ============================================================

-- ── 1. NOVO artigo: fiscalizacao-laudo ────────────────────────
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label,
   context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'fiscalizacao-laudo',
  'Como apresentar minha moto em uma fiscalização?',
  'Compartilhe temporariamente informações essenciais do Laudo por QR ou link — com validade definida, acesso limitado e revogação a qualquer momento.',
  E'## Como apresentar minha moto em uma fiscalização?\n\nO TrailBook permite compartilhar um acesso temporário ao Laudo da sua moto com informações essenciais — sem expor dados privados e sem precisar mostrar o celular inteiro.\n\n### O que você precisa\n\n- Ter um Laudo válido emitido. Se ainda não tiver, faça um Check-up primeiro.\n\n### Como gerar o acesso\n\n1. Abra o Laudo da sua moto em **Check-ups**.\n2. Toque em **Fiscalização**.\n3. Escolha por quanto tempo o acesso ficará disponível: 30 minutos, 1 hora, 6 horas ou 24 horas.\n4. Toque em **Gerar acesso**.\n5. Apresente o QR Code ou copie o link.\n\n### O que é exibido\n\nO acesso de fiscalização mostra apenas:\n- Identificação da moto (marca, modelo, ano, placa e chassi mascarado)\n- Situação geral do Laudo e validade\n\nDados financeiros, histórico detalhado, documentos privados e informações pessoais **não são exibidos**.\n\n### Importante\n\n- O acesso expira automaticamente no horário escolhido.\n- Você pode revogar o acesso antes do vencimento a qualquer momento.\n- O Laudo original **não é alterado** pelo compartilhamento.\n- Este recurso não substitui documentos oficiais obrigatórios por lei.',
  'fiscalizacao',
  '/motorcycles/$motorcycleId/checkups',
  'Abrir Check-ups',
  ARRAY['fiscalização','laudo','qr','fiscal','apresentar','blitz','agente'],
  true, 'published', 180
)
ON CONFLICT (slug) DO UPDATE SET
  title          = EXCLUDED.title,
  summary        = EXCLUDED.summary,
  body_md        = EXCLUDED.body_md,
  cta_label      = EXCLUDED.cta_label,
  route_template = EXCLUDED.route_template,
  context_tags   = EXCLUDED.context_tags,
  module_key     = EXCLUDED.module_key,
  updated_at     = now();

-- ── 2. NOVO artigo: historico-manutencao ─────────────────────
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label,
   context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'historico-manutencao',
  'Histórico da moto',
  'Consulte todas as manutenções, revisões e eventos registrados na sua moto em ordem cronológica.',
  E'## Histórico da moto\n\nO histórico reúne tudo que foi registrado na sua moto: manutenções, revisões, atividades e eventos — em ordem cronológica.\n\n### Como acessar\n\nNo cockpit da moto, acesse **Histórico de Manutenção**.\n\n### O que você encontra\n\n- Todas as manutenções registradas com data, tipo e itens\n- Revisões e inspeções anteriores\n- Filtros por período e tipo de serviço\n\n### Dica\n\nUm histórico completo melhora a avaliação da saúde da moto e enriquece o Passaporte Digital.',
  'maintenance',
  '/motorcycles/$motorcycleId/historico-manutencao',
  'Ver histórico',
  ARRAY['histórico','manutenção','revisão','timeline','registros'],
  true, 'published', 135
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, cta_label = EXCLUDED.cta_label,
  route_template = EXCLUDED.route_template, context_tags = EXCLUDED.context_tags,
  updated_at = now();

-- ── 3. NOVO artigo: agenda ────────────────────────────────────
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label,
   context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'agenda-manutencao',
  'Agenda de manutenção',
  'Veja as próximas manutenções calculadas a partir do uso real da sua moto — sem planilhas ou estimativas manuais.',
  E'## Agenda de manutenção\n\nA Agenda mostra as próximas manutenções da sua moto calculadas pelo TrailBook com base no uso real, intervalos e histórico registrado.\n\n### Como acessar\n\nNo menu principal, acesse **Agenda**.\n\n### O que você encontra\n\n- Próximas revisões e manutenções programadas\n- Alertas de itens próximos do vencimento\n- Visão por moto quando você tem mais de uma\n\n### Dica\n\nMantenha o hodômetro e as manutenções atualizados para que a Agenda seja precisa.',
  'agenda',
  '/agenda',
  'Ver agenda',
  ARRAY['agenda','próximas manutenções','revisão','programação','alertas'],
  false, 'published', 155
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, cta_label = EXCLUDED.cta_label,
  route_template = EXCLUDED.route_template, context_tags = EXCLUDED.context_tags,
  updated_at = now();

-- ── 4. NOVO artigo: oficinas ──────────────────────────────────
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label,
   context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'oficinas',
  'Oficinas',
  'Consulte e gerencie as oficinas associadas às suas manutenções registradas no TrailBook.',
  E'## Oficinas\n\nO TrailBook permite registrar e consultar as oficinas onde sua moto foi atendida.\n\n### Como acessar\n\nNo menu principal, acesse **Oficinas**.\n\n### O que você encontra\n\n- Oficinas vinculadas às suas manutenções\n- Histórico de atendimentos por local\n\n### Dica\n\nVincular uma oficina ao registrar uma manutenção facilita o rastreamento do histórico por estabelecimento.',
  'maintenance',
  '/workshops',
  'Ver oficinas',
  ARRAY['oficina','workshop','serviço','mecânico','atendimento'],
  false, 'published', 165
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md, cta_label = EXCLUDED.cta_label,
  route_template = EXCLUDED.route_template, context_tags = EXCLUDED.context_tags,
  updated_at = now();

-- ── 5. Intent fiscalizacao-laudo ──────────────────────────────
INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'fiscal_laudo', id, 'Fiscalização — compartilhamento temporário do Laudo'
FROM public.help_articles WHERE slug = 'fiscalizacao-laudo'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

-- ── 6. Phrases fiscalizacao-laudo ─────────────────────────────
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight
FROM public.help_intents i,
  (VALUES
    ('como apresentar minha moto em uma fiscalizacao', 3),
    ('fiscalizacao', 3),
    ('compartilhar para fiscalizacao', 3),
    ('como gerar qr para fiscalizacao', 3),
    ('fui parado em uma fiscalizacao', 3),
    ('como mostrar o laudo numa fiscalizacao', 3),
    ('gerar acesso para fiscalizacao', 2),
    ('quero mostrar o laudo', 2),
    ('acesso temporario laudo', 2),
    ('blitz', 2),
    ('agente de transito', 2)
  ) AS p(phrase, weight)
WHERE i.intent_key = 'fiscal_laudo'
ON CONFLICT DO NOTHING;

-- ── 7. Intents para novos artigos ────────────────────────────
INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'view_history', id, 'Histórico de manutenção da moto'
FROM public.help_articles WHERE slug = 'historico-manutencao'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'view_agenda', id, 'Agenda de manutenções programadas'
FROM public.help_articles WHERE slug = 'agenda-manutencao'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'view_workshops', id, 'Oficinas vinculadas às manutenções'
FROM public.help_articles WHERE slug = 'oficinas'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

-- ── 8. Phrases view_history ───────────────────────────────────
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight
FROM public.help_intents i,
  (VALUES
    ('historico da moto', 3),
    ('ver historico', 3),
    ('historico de manutencao', 3),
    ('manutencoes anteriores', 2),
    ('registros anteriores', 2)
  ) AS p(phrase, weight)
WHERE i.intent_key = 'view_history'
ON CONFLICT DO NOTHING;

-- ── 9. Phrases view_agenda ────────────────────────────────────
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight
FROM public.help_intents i,
  (VALUES
    ('agenda', 3),
    ('proximas manutencoes', 3),
    ('quando trocar o oleo', 2),
    ('proximas revisoes', 2),
    ('programacao de manutencao', 2)
  ) AS p(phrase, weight)
WHERE i.intent_key = 'view_agenda'
ON CONFLICT DO NOTHING;

-- ── 10. Phrases view_workshops ────────────────────────────────
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight
FROM public.help_intents i,
  (VALUES
    ('oficinas', 3),
    ('oficina', 3),
    ('onde levei minha moto', 2),
    ('mecanico', 2)
  ) AS p(phrase, weight)
WHERE i.intent_key = 'view_workshops'
ON CONFLICT DO NOTHING;

-- ── 11. Atualizar check-up-laudo: mencionar Fiscalização ──────
UPDATE public.help_articles SET
  body_md = E'## Gerar e consultar um Laudo\n\nO Laudo é o documento formal gerado a partir de um Check-up. Ele registra o diagnóstico completo da moto no momento em que foi emitido.\n\n**Características do Laudo:**\n- Imutável: o conteúdo nunca muda depois de emitido\n- Possui validade (varia de 15 a 180 dias conforme o estado da moto)\n- Pode ser baixado como PDF\n- Pode ser compartilhado via link público e QR Code\n- Permite selecionar quais informações serão visíveis (comprador, oficina ou personalizado)\n- Pode ser revogado a qualquer momento\n\n**Como gerar:**\n1. Acesse o cockpit da sua moto\n2. Toque em **Check-ups**\n3. Toque em **Novo Check-up**\n4. Conclua o assistente de avaliação\n5. Emita o Laudo ao final\n\n**Como compartilhar:**\nNa tela do Laudo, toque em **Compartilhar** para gerar o link público e o QR Code.\n\n**Fiscalização:**\nDepois de emitir um Laudo, você também pode compartilhá-lo temporariamente para uma fiscalização — com acesso limitado, validade definida e revogação a qualquer momento.',
  updated_at = now()
WHERE slug = 'check-up-laudo';

NOTIFY pgrst, 'reload schema';
