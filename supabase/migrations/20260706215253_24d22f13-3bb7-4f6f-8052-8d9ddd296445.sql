
CREATE TABLE public.motorcycle_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.motorcycle_brands TO anon, authenticated;
GRANT ALL ON public.motorcycle_brands TO service_role;
ALTER TABLE public.motorcycle_brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brands_read_all" ON public.motorcycle_brands FOR SELECT USING (true);
CREATE POLICY "brands_admin_write" ON public.motorcycle_brands FOR ALL TO authenticated
  USING (public.is_user_admin(auth.uid())) WITH CHECK (public.is_user_admin(auth.uid()));
CREATE TRIGGER trg_brands_touch BEFORE UPDATE ON public.motorcycle_brands
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.motorcycle_types_ref (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.motorcycle_types_ref TO anon, authenticated;
GRANT ALL ON public.motorcycle_types_ref TO service_role;
ALTER TABLE public.motorcycle_types_ref ENABLE ROW LEVEL SECURITY;
CREATE POLICY "types_read_all" ON public.motorcycle_types_ref FOR SELECT USING (true);
CREATE POLICY "types_admin_write" ON public.motorcycle_types_ref FOR ALL TO authenticated
  USING (public.is_user_admin(auth.uid())) WITH CHECK (public.is_user_admin(auth.uid()));

CREATE TABLE public.motorcycle_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.motorcycle_brands(id) ON DELETE CASCADE,
  type_code TEXT NOT NULL REFERENCES public.motorcycle_types_ref(code) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 100,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id, type_code, name)
);
CREATE INDEX idx_models_brand_type ON public.motorcycle_models(brand_id, type_code) WHERE active;
GRANT SELECT ON public.motorcycle_models TO anon, authenticated;
GRANT ALL ON public.motorcycle_models TO service_role;
ALTER TABLE public.motorcycle_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "models_read_all" ON public.motorcycle_models FOR SELECT USING (true);
CREATE POLICY "models_admin_write" ON public.motorcycle_models FOR ALL TO authenticated
  USING (public.is_user_admin(auth.uid())) WITH CHECK (public.is_user_admin(auth.uid()));
CREATE TRIGGER trg_models_touch BEFORE UPDATE ON public.motorcycle_models
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.motorcycle_model_engines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES public.motorcycle_models(id) ON DELETE CASCADE,
  displacement INT NOT NULL CHECK (displacement > 0 AND displacement < 3000),
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_id, displacement)
);
CREATE INDEX idx_engines_model ON public.motorcycle_model_engines(model_id) WHERE active;
GRANT SELECT ON public.motorcycle_model_engines TO anon, authenticated;
GRANT ALL ON public.motorcycle_model_engines TO service_role;
ALTER TABLE public.motorcycle_model_engines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "engines_read_all" ON public.motorcycle_model_engines FOR SELECT USING (true);
CREATE POLICY "engines_admin_write" ON public.motorcycle_model_engines FOR ALL TO authenticated
  USING (public.is_user_admin(auth.uid())) WITH CHECK (public.is_user_admin(auth.uid()));

CREATE TABLE public.motorcycle_model_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES public.motorcycle_models(id) ON DELETE CASCADE,
  year_make INT NOT NULL CHECK (year_make BETWEEN 1970 AND 2100),
  year_model INT NOT NULL CHECK (year_model BETWEEN 1970 AND 2100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_id, year_make, year_model)
);
CREATE INDEX idx_years_model ON public.motorcycle_model_years(model_id);
GRANT SELECT ON public.motorcycle_model_years TO anon, authenticated;
GRANT ALL ON public.motorcycle_model_years TO service_role;
ALTER TABLE public.motorcycle_model_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "years_read_all" ON public.motorcycle_model_years FOR SELECT USING (true);
CREATE POLICY "years_admin_write" ON public.motorcycle_model_years FOR ALL TO authenticated
  USING (public.is_user_admin(auth.uid())) WITH CHECK (public.is_user_admin(auth.uid()));

CREATE TABLE public.motorcycle_model_defaults (
  model_id UUID PRIMARY KEY REFERENCES public.motorcycle_models(id) ON DELETE CASCADE,
  suggested_control_type public.control_type,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.motorcycle_model_defaults TO anon, authenticated;
GRANT ALL ON public.motorcycle_model_defaults TO service_role;
ALTER TABLE public.motorcycle_model_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "defaults_read_all" ON public.motorcycle_model_defaults FOR SELECT USING (true);
CREATE POLICY "defaults_admin_write" ON public.motorcycle_model_defaults FOR ALL TO authenticated
  USING (public.is_user_admin(auth.uid())) WITH CHECK (public.is_user_admin(auth.uid()));
CREATE TRIGGER trg_defaults_touch BEFORE UPDATE ON public.motorcycle_model_defaults
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='motorcycles' AND column_name='condition') THEN
    ALTER TABLE public.motorcycles
      ADD COLUMN condition TEXT NOT NULL DEFAULT 'used' CHECK (condition IN ('new','used'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='motorcycles' AND column_name='catalog_model_id') THEN
    ALTER TABLE public.motorcycles
      ADD COLUMN catalog_model_id UUID REFERENCES public.motorcycle_models(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='motorcycles' AND column_name='plan_review_status') THEN
    ALTER TABLE public.motorcycles
      ADD COLUMN plan_review_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (plan_review_status IN ('pending','reviewed','skipped'));
  END IF;
END $$;

INSERT INTO public.motorcycle_types_ref(code,label,sort_order) VALUES
  ('trail','Trilha',10),
  ('enduro','Enduro',20),
  ('motocross','Motocross',30),
  ('rally','Rally',40),
  ('adventure','Adventure',50),
  ('big_trail','Big Trail',60)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.motorcycle_brands(name,sort_order) VALUES
  ('Honda',10),('Yamaha',20),('KTM',30),('Kawasaki',40),
  ('Suzuki',50),('Husqvarna',60),('Sherco',70),('GasGas',80)
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public._seed_model(_brand TEXT, _type TEXT, _name TEXT, _disp INT, _ctrl public.control_type)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE v_brand UUID; v_model UUID;
BEGIN
  SELECT id INTO v_brand FROM public.motorcycle_brands WHERE name = _brand;
  IF v_brand IS NULL THEN RETURN; END IF;
  INSERT INTO public.motorcycle_models(brand_id, type_code, name)
    VALUES (v_brand, _type, _name)
    ON CONFLICT (brand_id, type_code, name) DO UPDATE SET updated_at = now()
    RETURNING id INTO v_model;
  IF v_model IS NULL THEN
    SELECT id INTO v_model FROM public.motorcycle_models WHERE brand_id=v_brand AND type_code=_type AND name=_name;
  END IF;
  IF _disp IS NOT NULL THEN
    INSERT INTO public.motorcycle_model_engines(model_id, displacement)
      VALUES (v_model, _disp)
      ON CONFLICT (model_id, displacement) DO NOTHING;
  END IF;
  IF _ctrl IS NOT NULL THEN
    INSERT INTO public.motorcycle_model_defaults(model_id, suggested_control_type)
      VALUES (v_model, _ctrl)
      ON CONFLICT (model_id) DO UPDATE SET suggested_control_type = EXCLUDED.suggested_control_type, updated_at = now();
  END IF;
END $fn$;

SELECT public._seed_model('Honda','trail','CRF 230F',230,'hours');
SELECT public._seed_model('Honda','trail','CRF 250F',250,'hours');
SELECT public._seed_model('Honda','motocross','CRF 250R',250,'hours');
SELECT public._seed_model('Honda','enduro','CRF 250RX',250,'hours');
SELECT public._seed_model('Honda','trail','CRF 300L',286,'both');
SELECT public._seed_model('Honda','rally','CRF 300L Rally',286,'both');
SELECT public._seed_model('Honda','motocross','CRF 450R',449,'hours');
SELECT public._seed_model('Honda','enduro','CRF 450RX',449,'hours');
SELECT public._seed_model('Honda','enduro','CRF 450X',449,'hours');
SELECT public._seed_model('Honda','trail','XR 150L',149,'both');
SELECT public._seed_model('Honda','trail','XR 250 Tornado',249,'both');
SELECT public._seed_model('Honda','big_trail','XRE 300',291,'both');
SELECT public._seed_model('Honda','big_trail','NX 500',471,'both');

SELECT public._seed_model('Yamaha','motocross','YZ 125',125,'hours');
SELECT public._seed_model('Yamaha','motocross','YZ 250',249,'hours');
SELECT public._seed_model('Yamaha','motocross','YZ 250F',250,'hours');
SELECT public._seed_model('Yamaha','motocross','YZ 450F',450,'hours');
SELECT public._seed_model('Yamaha','enduro','WR 250F',250,'hours');
SELECT public._seed_model('Yamaha','enduro','WR 450F',450,'hours');
SELECT public._seed_model('Yamaha','trail','TT-R 230',223,'both');
SELECT public._seed_model('Yamaha','adventure','Ténéré 700',689,'both');
SELECT public._seed_model('Yamaha','big_trail','Lander 250',249,'both');

SELECT public._seed_model('KTM','enduro','150 EXC',144,'hours');
SELECT public._seed_model('KTM','enduro','250 EXC',249,'hours');
SELECT public._seed_model('KTM','enduro','300 EXC',293,'hours');
SELECT public._seed_model('KTM','enduro','250 EXC-F',250,'hours');
SELECT public._seed_model('KTM','enduro','350 EXC-F',350,'hours');
SELECT public._seed_model('KTM','enduro','450 EXC-F',450,'hours');
SELECT public._seed_model('KTM','enduro','500 EXC-F',510,'hours');
SELECT public._seed_model('KTM','motocross','250 SX',249,'hours');
SELECT public._seed_model('KTM','motocross','350 SX-F',350,'hours');
SELECT public._seed_model('KTM','motocross','450 SX-F',450,'hours');
SELECT public._seed_model('KTM','adventure','390 Adventure',373,'both');
SELECT public._seed_model('KTM','adventure','890 Adventure R',889,'both');

SELECT public._seed_model('Husqvarna','enduro','TE 150',144,'hours');
SELECT public._seed_model('Husqvarna','enduro','TE 250',249,'hours');
SELECT public._seed_model('Husqvarna','enduro','TE 300',293,'hours');
SELECT public._seed_model('Husqvarna','enduro','FE 250',250,'hours');
SELECT public._seed_model('Husqvarna','enduro','FE 350',350,'hours');
SELECT public._seed_model('Husqvarna','enduro','FE 450',450,'hours');
SELECT public._seed_model('Husqvarna','enduro','FE 501',510,'hours');

SELECT public._seed_model('GasGas','enduro','EC 250',249,'hours');
SELECT public._seed_model('GasGas','enduro','EC 300',293,'hours');
SELECT public._seed_model('GasGas','enduro','EC 250F',250,'hours');
SELECT public._seed_model('GasGas','enduro','EC 350F',350,'hours');

SELECT public._seed_model('Sherco','enduro','SE 250',249,'hours');
SELECT public._seed_model('Sherco','enduro','SE 300',293,'hours');
SELECT public._seed_model('Sherco','enduro','SEF 250',250,'hours');
SELECT public._seed_model('Sherco','enduro','SEF 300',300,'hours');
SELECT public._seed_model('Sherco','enduro','SEF 450',450,'hours');

SELECT public._seed_model('Kawasaki','trail','KLX 230',233,'both');
SELECT public._seed_model('Kawasaki','trail','KLX 300',292,'both');
SELECT public._seed_model('Kawasaki','motocross','KX 250',249,'hours');
SELECT public._seed_model('Kawasaki','motocross','KX 450',449,'hours');

SELECT public._seed_model('Suzuki','trail','DR 200',199,'both');
SELECT public._seed_model('Suzuki','enduro','DR-Z 400',398,'both');

DROP FUNCTION public._seed_model(TEXT,TEXT,TEXT,INT,public.control_type);
