-- ============================================================
-- KB REVISION Etapa 1: Nomenclatura e Consistencia
-- Atualizacao de conteudo dos artigos do Assistente TrailBook
-- NAO altera schema. Apenas atualiza dados de seed existentes.
--
-- Mudancas:
--   1. health-avaliacao -> remove "Health 4.0", reescreve para
--      "Saude da Moto e Check-up" com linguagem de motociclista
--   2. modo-fiscalizacao -> status archived (some do Assistente)
--   3. INSERT de artigo check-up-laudo
--   4. Intent + phrases para o novo artigo
-- ============================================================

-- 1. Reescrever artigo health-avaliacao
UPDATE public.help_articles SET
  title       = 'Saude da Moto e Check-up',
  summary     = 'Acompanhe o estado da sua moto em tempo real e faca um Check-up para emitir um Laudo formal com diagnostico completo.',
  body_md     = '## Saude da Moto e Check-up

**Saude da Moto** e o painel de acompanhamento continuo da sua motocicleta. Com base nas manutencoes registradas, o TrailBook mostra o que esta em dia, o que merece atencao e o que precisa ser resolvido.

**Check-up** e a avaliacao guiada: em poucos passos voce revisa os dados da moto e recebe um diagnostico completo.

**Laudo** e o documento gerado ao concluir o Check-up. Ele registra o estado da moto naquele momento, tem validade, pode ser compartilhado e nunca muda depois de emitido.

### Como acessar

No cockpit da sua moto, toque em **Saude** para ver o painel atual, ou acesse **Check-ups** para ver laudos anteriores e iniciar um novo.',
  cta_label      = 'Ver saude da moto',
  route_template = '/motorcycles/$motorcycleId/health',
  module_key     = 'health',
  context_tags   = ARRAY['saude','check-up','laudo','avaliacao','manutencao'],
  updated_at     = now()
WHERE slug = 'health-avaliacao';

-- 2. Arquivar modo-fiscalizacao
UPDATE public.help_articles SET
  status     = 'archived',
  updated_at = now()
WHERE slug = 'modo-fiscalizacao';

-- 3. Criar artigo check-up-laudo
INSERT INTO public.help_articles
  (slug, title, summary, body_md, module_key, route_template, cta_label,
   context_tags, needs_motorcycle, status, sort_order)
VALUES (
  'check-up-laudo',
  'Gerar e consultar um Laudo',
  'O Laudo registra o estado da moto em um momento especifico, tem validade, pode ser compartilhado via QR e nunca muda depois de emitido.',
  '## Gerar e consultar um Laudo

O Laudo e o documento formal gerado a partir de um Check-up. Ele registra o diagnostico completo da moto no momento em que foi emitido.

**Caracteristicas do Laudo:**
- Imutavel: o conteudo nunca muda depois de emitido
- Possui validade (varia de 15 a 180 dias conforme o estado da moto)
- Pode ser baixado como PDF
- Pode ser compartilhado via link publico e QR Code
- Permite selecionar quais informacoes serao visiveis (comprador, oficina ou personalizado)
- Pode ser revogado a qualquer momento

**Como gerar:**
1. Acesse o cockpit da sua moto
2. Toque em **Check-ups**
3. Toque em **Novo Check-up**
4. Conclua o assistente de avaliacao
5. Emita o Laudo ao final

**Como compartilhar:**
Na tela do Laudo, toque em **Compartilhar** para gerar o link publico e o QR Code.',
  'health',
  '/motorcycles/$motorcycleId/checkups',
  'Ir para Check-ups',
  ARRAY['laudo','check-up','compartilhar','qr','pdf','diagnostico'],
  true, 'published', 145
)
ON CONFLICT (slug) DO UPDATE SET
  title          = EXCLUDED.title,
  summary        = EXCLUDED.summary,
  body_md        = EXCLUDED.body_md,
  cta_label      = EXCLUDED.cta_label,
  route_template = EXCLUDED.route_template,
  context_tags   = EXCLUDED.context_tags,
  updated_at     = now();

-- 4. Intent para check-up-laudo
INSERT INTO public.help_intents (intent_key, article_id, description)
SELECT 'checkup_laudo', id, 'Check-up e Laudo da moto'
FROM public.help_articles WHERE slug = 'check-up-laudo'
ON CONFLICT (intent_key) DO UPDATE SET article_id = EXCLUDED.article_id;

-- 5. Phrases para check-up-laudo
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight
FROM public.help_intents i,
  (VALUES
    ('gerar laudo', 3),
    ('laudo da moto', 3),
    ('check up laudo', 3),
    ('emitir laudo', 3),
    ('consultar laudo', 3),
    ('compartilhar laudo', 3),
    ('fazer check up', 3),
    ('novo check up', 3),
    ('pdf do laudo', 2),
    ('qr do laudo', 2),
    ('laudo valido', 2),
    ('meu laudo', 2)
  ) AS p(phrase, weight)
WHERE i.intent_key = 'checkup_laudo'
ON CONFLICT DO NOTHING;

-- 6. Remover phrases com "health 4" se existirem
DELETE FROM public.help_intent_phrases
WHERE phrase ILIKE '%health 4%';

-- 7. Adicionar phrases de saude da moto ao intent view_health
INSERT INTO public.help_intent_phrases (intent_id, phrase, weight)
SELECT i.id, p.phrase, p.weight
FROM public.help_intents i,
  (VALUES
    ('saude da moto', 3),
    ('ver saude', 3),
    ('como esta minha moto', 3),
    ('estado da moto', 2),
    ('avaliacao da moto', 2),
    ('check up', 3),
    ('fazer avaliacao', 2)
  ) AS p(phrase, weight)
WHERE i.intent_key = 'view_health'
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
