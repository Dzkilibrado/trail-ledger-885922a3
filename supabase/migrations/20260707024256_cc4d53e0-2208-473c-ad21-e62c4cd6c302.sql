
-- ============================================================
-- v1.2.1 Sub-fase A — Fundação da Saúde por item + Auditoria
-- ============================================================

-- 1. Novos status para maintenance_schedules
ALTER TYPE public.schedule_status ADD VALUE IF NOT EXISTS 'no_info';
ALTER TYPE public.schedule_status ADD VALUE IF NOT EXISTS 'not_applicable';
ALTER TYPE public.schedule_status ADD VALUE IF NOT EXISTS 'custom';

-- 2. Colunas de personalização e revisão em maintenance_schedules
ALTER TABLE public.maintenance_schedules
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS severity text,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_schedules_moto_sort
  ON public.maintenance_schedules(motorcycle_id, pinned DESC, sort_order NULLS LAST);

-- 3. Marca de revisão inicial (moto usada) em motorcycles
ALTER TABLE public.motorcycles
  ADD COLUMN IF NOT EXISTS initial_review_done_at timestamptz;

-- 4. Auditoria automática de schedules e items via trigger write_audit (já existente)
DROP TRIGGER IF EXISTS trg_audit_maintenance_schedules ON public.maintenance_schedules;
CREATE TRIGGER trg_audit_maintenance_schedules
  AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_schedules
  FOR EACH ROW EXECUTE FUNCTION public.write_audit();

DROP TRIGGER IF EXISTS trg_audit_maintenance_items ON public.maintenance_items;
CREATE TRIGGER trg_audit_maintenance_items
  AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_items
  FOR EACH ROW EXECUTE FUNCTION public.write_audit();
