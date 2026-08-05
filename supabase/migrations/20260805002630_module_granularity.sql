-- =========================================================
-- Atualização da lista de módulos: granularidade para as
-- sub-áreas da moto que hoje são controladas junto com
-- "Motos" como um bloco só.
-- =========================================================
-- Não removemos módulos antigos (documents, marketplace, ai) mesmo os que
-- hoje não têm rota associada — são preservados para histórico/auditoria.
-- O painel admin agora avisa automaticamente quando um módulo não está
-- vinculado a nenhuma rota real (ver LINKED_MODULE_KEYS no front-end),
-- então não há necessidade de apagar linhas para manter a lista "limpa".

INSERT INTO public.platform_modules (key, label, description, status, sort_order) VALUES
  ('checkups', 'Check-ups e Laudos', 'Check-ups periódicos e emissão de laudos digitais da moto', 'active', 22),
  ('passport', 'Passaporte Digital', 'Compartilhamento do histórico da moto com terceiros (Passaporte e Selos)', 'active', 24),
  ('moto-control', 'Central da Moto', 'Documentos, recibos, atividades e ações administrativas de cada moto', 'active', 26)
ON CONFLICT (key) DO NOTHING;
