
-- Enums
DO $$ BEGIN CREATE TYPE public.use_profile AS ENUM ('light','normal','severe','motocross','competition','sand_mud','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.plan_item_action AS ENUM ('inspect','replace','lubricate','adjust','clean','check_level'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.plan_severity AS ENUM ('low','medium','high','critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.inspection_decision AS ENUM ('good','attention','replace_recommended','replaced','postpone','ignore'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add use profile columns to motorcycles
ALTER TABLE public.motorcycles
  ADD COLUMN IF NOT EXISTS use_profile public.use_profile,
  ADD COLUMN IF NOT EXISTS use_profile_note TEXT;

-- Templates (admin-managed catalog)
CREATE TABLE IF NOT EXISTS public.maintenance_plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  model TEXT,
  year_from INT,
  year_to INT,
  active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.maintenance_plan_templates TO authenticated, anon;
GRANT ALL ON public.maintenance_plan_templates TO service_role;
ALTER TABLE public.maintenance_plan_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates readable to authenticated"
  ON public.maintenance_plan_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "templates admin write"
  ON public.maintenance_plan_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_plan_templates_touch BEFORE UPDATE ON public.maintenance_plan_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Template items
CREATE TABLE IF NOT EXISTS public.maintenance_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.maintenance_plan_templates(id) ON DELETE CASCADE,
  category public.maintenance_category NOT NULL,
  item_name TEXT NOT NULL,
  action public.plan_item_action NOT NULL DEFAULT 'inspect',
  interval_hours NUMERIC,
  interval_km NUMERIC,
  interval_days INT,
  replace_hours NUMERIC,
  replace_km NUMERIC,
  replace_days INT,
  severity public.plan_severity NOT NULL DEFAULT 'medium',
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.maintenance_plan_items TO authenticated, anon;
GRANT ALL ON public.maintenance_plan_items TO service_role;
ALTER TABLE public.maintenance_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan items readable"
  ON public.maintenance_plan_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "plan items admin write"
  ON public.maintenance_plan_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_plan_items_touch BEFORE UPDATE ON public.maintenance_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS idx_plan_items_template ON public.maintenance_plan_items(template_id, sort_order);

-- Wear signs (checklist)
CREATE TABLE IF NOT EXISTS public.maintenance_wear_signs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.maintenance_category NOT NULL,
  item_name TEXT,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.maintenance_wear_signs TO authenticated, anon;
GRANT ALL ON public.maintenance_wear_signs TO service_role;
ALTER TABLE public.maintenance_wear_signs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wear signs readable"
  ON public.maintenance_wear_signs FOR SELECT TO authenticated USING (true);
CREATE POLICY "wear signs admin write"
  ON public.maintenance_wear_signs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Inspections
CREATE TABLE IF NOT EXISTS public.maintenance_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.maintenance_schedules(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  decision public.inspection_decision NOT NULL,
  signs JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  hours_at NUMERIC,
  km_at NUMERIC,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.maintenance_inspections TO authenticated;
GRANT ALL ON public.maintenance_inspections TO service_role;
ALTER TABLE public.maintenance_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inspection owner select"
  ON public.maintenance_inspections FOR SELECT TO authenticated
  USING (public.is_moto_owner(motorcycle_id));
CREATE POLICY "inspection owner insert"
  ON public.maintenance_inspections FOR INSERT TO authenticated
  WITH CHECK (public.is_moto_owner(motorcycle_id) AND created_by = auth.uid());
CREATE INDEX IF NOT EXISTS idx_inspections_moto ON public.maintenance_inspections(motorcycle_id, created_at DESC);

-- Seed default template + items (Transmissão + básicos)
DO $seed$
DECLARE v_tid UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.maintenance_plan_templates WHERE is_default) THEN
    INSERT INTO public.maintenance_plan_templates (name, description, is_default, active)
    VALUES ('Plano padrão off-road', 'Plano genérico para motos de trilha/enduro. Ajuste conforme o uso.', true, true)
    RETURNING id INTO v_tid;

    INSERT INTO public.maintenance_plan_items (template_id, category, item_name, action, interval_hours, severity, notes, sort_order) VALUES
      (v_tid,'transmission','Corrente','lubricate',3,'medium','Lubrificar após cada uso severo ou lavagem.',10),
      (v_tid,'transmission','Corrente','inspect',10,'medium','Verificar tensão, pontos travados e alinhamento.',20),
      (v_tid,'transmission','Kit transmissão','inspect',30,'high','Inspecionar coroa, pinhão e corrente em conjunto.',30);

    INSERT INTO public.maintenance_plan_items (template_id, category, item_name, action, replace_hours, severity, notes, sort_order) VALUES
      (v_tid,'transmission','Kit transmissão','replace',100,'high','Uso normal de trilha. Motocross: 60h · Uso leve: 150h.',40);

    INSERT INTO public.maintenance_plan_items (template_id, category, item_name, action, interval_hours, interval_days, severity, sort_order) VALUES
      (v_tid,'engine','Óleo do motor','replace',15,90,'critical',50),
      (v_tid,'engine','Filtro de ar','clean',5,30,'high',60),
      (v_tid,'engine','Vela','replace',30,180,'medium',70),
      (v_tid,'brakes','Fluido de freio','replace',NULL,365,'high',80),
      (v_tid,'brakes','Pastilhas dianteiras','inspect',10,60,'critical',90),
      (v_tid,'suspension','Óleo do garfo dianteiro','replace',40,365,'high',100),
      (v_tid,'cooling','Líquido de arrefecimento','replace',NULL,730,'high',110),
      (v_tid,'wheels','Aperto dos raios','inspect',10,60,'medium',120);
  END IF;
END $seed$;

-- Seed wear signs (transmissão como referência)
INSERT INTO public.maintenance_wear_signs (category, item_name, label, sort_order)
SELECT * FROM (VALUES
  ('transmission'::public.maintenance_category, 'Corrente', 'Elos com pontos travando', 10),
  ('transmission','Corrente','Necessidade de esticar com frequência', 20),
  ('transmission','Kit transmissão','Dentes da coroa ou pinhão afinados', 30),
  ('transmission','Kit transmissão','Dentes em formato de gancho', 40),
  ('transmission','Corrente','Corrente sai facilmente da coroa ao puxar para trás', 50),
  ('brakes','Pastilhas dianteiras','Ruído metálico ao frear', 10),
  ('brakes','Pastilhas dianteiras','Espessura da pastilha abaixo do mínimo', 20),
  ('engine','Filtro de ar','Filtro visivelmente sujo ou danificado', 10),
  ('engine','Óleo do motor','Óleo escurecido ou com resíduos', 10)
) AS v(category, item_name, label, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.maintenance_wear_signs LIMIT 1);
