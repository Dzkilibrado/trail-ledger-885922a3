
-- Restrict catalog/reference SELECT policies to authenticated users only.
-- These tables are only read from within authenticated routes (motorcycle
-- registration flow, modules gating). No anon access is required.

DROP POLICY IF EXISTS brands_read_all ON public.motorcycle_brands;
CREATE POLICY brands_read_all ON public.motorcycle_brands FOR SELECT TO authenticated USING (active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS models_read_all ON public.motorcycle_models;
CREATE POLICY models_read_all ON public.motorcycle_models FOR SELECT TO authenticated USING (active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS years_read_all ON public.motorcycle_model_years;
CREATE POLICY years_read_all ON public.motorcycle_model_years FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS engines_read_all ON public.motorcycle_model_engines;
CREATE POLICY engines_read_all ON public.motorcycle_model_engines FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS defaults_read_all ON public.motorcycle_model_defaults;
CREATE POLICY defaults_read_all ON public.motorcycle_model_defaults FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS types_read_all ON public.motorcycle_types_ref;
CREATE POLICY types_read_all ON public.motorcycle_types_ref FOR SELECT TO authenticated USING (active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "modules readable by anyone" ON public.platform_modules;
CREATE POLICY "modules readable by authenticated" ON public.platform_modules FOR SELECT TO authenticated USING (true);

-- Revoke anon grants on catalog tables (authenticated retains SELECT via policies).
REVOKE SELECT ON public.motorcycle_brands FROM anon;
REVOKE SELECT ON public.motorcycle_models FROM anon;
REVOKE SELECT ON public.motorcycle_model_years FROM anon;
REVOKE SELECT ON public.motorcycle_model_engines FROM anon;
REVOKE SELECT ON public.motorcycle_model_defaults FROM anon;
REVOKE SELECT ON public.motorcycle_types_ref FROM anon;
REVOKE SELECT ON public.platform_modules FROM anon;
