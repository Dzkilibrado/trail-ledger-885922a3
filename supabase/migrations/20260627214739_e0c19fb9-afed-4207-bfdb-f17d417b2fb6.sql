
-- =========================================================================
-- TrailBook v1.0 — UX hardening migration
-- 1) Adiciona estado e snooze a maintenance_schedules
-- 2) Novos tipos de evento: incident (sinistro) e declaration (declaração)
-- 3) Adiciona incident_declaration em motorcycles
-- =========================================================================

-- 1. Schedule status & snooze
DO $$ BEGIN
  CREATE TYPE public.schedule_status AS ENUM ('active', 'snoozed', 'ignored', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.maintenance_schedules
  ADD COLUMN IF NOT EXISTS status public.schedule_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_completed_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

-- 2. Novos valores no enum event_type (idempotente)
DO $$ BEGIN
  ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'incident';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'declaration';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Declaração de sinistro na moto
ALTER TABLE public.motorcycles
  ADD COLUMN IF NOT EXISTS incident_declaration jsonb;

COMMENT ON COLUMN public.motorcycles.incident_declaration IS
  'Declaração inicial do proprietário sobre histórico de sinistro. Formato: { value: "yes|no|unknown", accepted_at: timestamp, text: string }';
