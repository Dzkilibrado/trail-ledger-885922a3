ALTER TABLE public.maintenance_schedules
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.maintenance_schedules.is_custom IS
  'True quando o componente foi criado manualmente pelo usuário (não veio do catálogo/template).';

CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_is_custom
  ON public.maintenance_schedules (motorcycle_id) WHERE is_custom = true;