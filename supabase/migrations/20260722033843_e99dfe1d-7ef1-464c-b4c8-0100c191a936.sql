-- 1. Baseline columns
ALTER TABLE public.motorcycles
  ADD COLUMN IF NOT EXISTS hours_initial NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS km_initial    NUMERIC NOT NULL DEFAULT 0;

-- 2. Backfill: baseline = total atual - soma dos deltas históricos (nunca negativo)
WITH sums AS (
  SELECT m.id,
         GREATEST(0, m.hours_total - COALESCE((SELECT SUM(e.hours_delta) FROM public.events e WHERE e.motorcycle_id = m.id), 0)) AS h0,
         GREATEST(0, m.km_total    - COALESCE((SELECT SUM(e.km_delta)    FROM public.events e WHERE e.motorcycle_id = m.id), 0)) AS k0
    FROM public.motorcycles m
)
UPDATE public.motorcycles m
   SET hours_initial = s.h0,
       km_initial    = s.k0
  FROM sums s
 WHERE s.id = m.id;

-- 3. Trigger de proteção: bloqueia redução silenciosa de hours_total/km_total.
--    Só permite quando o chamador seta explicitamente a GUC de sessão.
CREATE OR REPLACE FUNCTION public.motorcycles_block_totals_regression()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.hours_total < OLD.hours_total OR NEW.km_total < OLD.km_total)
     AND COALESCE(current_setting('trailbook.allow_totals_reduction', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'Regressão de horímetro/KM bloqueada (moto=%). Anterior h=%, km=%; novo h=%, km=%. Use fluxo autorizado.',
      NEW.id, OLD.hours_total, OLD.km_total, NEW.hours_total, NEW.km_total;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS motorcycles_block_totals_regression ON public.motorcycles;
CREATE TRIGGER motorcycles_block_totals_regression
  BEFORE UPDATE OF hours_total, km_total ON public.motorcycles
  FOR EACH ROW EXECUTE FUNCTION public.motorcycles_block_totals_regression();

-- 4. RPC autorizada para aplicar totais recompostos (owner ou admin).
--    Nunca escreve valor menor que o baseline preservado.
CREATE OR REPLACE FUNCTION public.apply_recomposed_totals(_moto uuid, _hours numeric, _km numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.is_moto_owner(_moto) OR public.is_user_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  PERFORM set_config('trailbook.allow_totals_reduction', 'on', true);
  UPDATE public.motorcycles
     SET hours_total = GREATEST(COALESCE(_hours, 0), hours_initial),
         km_total    = GREATEST(COALESCE(_km, 0),    km_initial)
   WHERE id = _moto;
END $$;

GRANT EXECUTE ON FUNCTION public.apply_recomposed_totals(uuid, numeric, numeric) TO authenticated;