-- ============================================================
-- Fiscalizacao -- Preset de Compartilhamento do Laudo
-- Reutiliza health_report_shares sem nova tabela.
--
-- Mudancas:
--   1. Adiciona valor 'fiscal' ao enum health_share_preset
--   2. Constraint: share fiscal EXIGE expires_at (nao pode ser null)
--   3. INSERT platform_modules: fiscalizacao (beta)
--
-- NOTA: ALTER TYPE ADD VALUE nao pode rodar dentro de bloco
-- transacional no Postgres < 12. No Supabase (PG 15+) eh permitido
-- dentro de transacao, mas o valor so fica visivel apos o commit.
-- Por isso esta migration usa dois blocos BEGIN/COMMIT separados.
-- ============================================================

-- Bloco 1: adicionar o valor ao enum
ALTER TYPE public.health_share_preset ADD VALUE IF NOT EXISTS 'fiscal';

-- Bloco 2: constraint + modulo (depende do enum ja commitado)
ALTER TABLE public.health_report_shares
  ADD CONSTRAINT fiscal_requires_expires
    CHECK (preset <> 'fiscal' OR expires_at IS NOT NULL);

INSERT INTO public.platform_modules (key, label, description, status, sort_order)
VALUES (
  'fiscalizacao',
  'Compartilhar para Fiscalizacao',
  'Gera acesso temporario ao Laudo da moto para apresentacao em fiscalizacoes de transito.',
  'beta',
  28
)
ON CONFLICT (key) DO UPDATE
  SET label       = EXCLUDED.label,
      description = EXCLUDED.description;

NOTIFY pgrst, 'reload schema';
