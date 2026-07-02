-- Vínculo estruturado evento → catálogo → schedule.
ALTER TABLE public.maintenance_schedules
  ADD COLUMN IF NOT EXISTS template_item_id UUID REFERENCES public.maintenance_plan_items(id) ON DELETE SET NULL;

ALTER TABLE public.maintenance_items
  ADD COLUMN IF NOT EXISTS template_item_id UUID REFERENCES public.maintenance_plan_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.maintenance_schedules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schedules_template_item ON public.maintenance_schedules(template_item_id);
CREATE INDEX IF NOT EXISTS idx_maint_items_schedule ON public.maintenance_items(schedule_id);
CREATE INDEX IF NOT EXISTS idx_maint_items_template_item ON public.maintenance_items(template_item_id);

-- Backfill: casa schedules existentes ao item do catálogo padrão pelo nome atual.
-- Usa "Item — Ação" (formato do proposeSchedules) para bater com o item_name.
UPDATE public.maintenance_schedules s
   SET template_item_id = pi.id
  FROM public.maintenance_plan_items pi
  JOIN public.maintenance_plan_templates t ON t.id = pi.template_id AND t.is_default
 WHERE s.template_item_id IS NULL
   AND s.name = pi.item_name || ' — ' || CASE pi.action::text
     WHEN 'inspect' THEN 'Inspecionar'
     WHEN 'replace' THEN 'Troca prevista'
     WHEN 'lubricate' THEN 'Lubrificar'
     WHEN 'adjust' THEN 'Ajustar'
     WHEN 'clean' THEN 'Limpar'
     WHEN 'check_level' THEN 'Verificar nível'
   END;