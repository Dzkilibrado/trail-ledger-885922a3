-- Additive only; existing activities and preferences are not migrated or reset.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS usage_shortcut_initialized boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.initialize_usage_shortcut()
RETURNS text[] LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE p public.profiles%ROWTYPE; keys text[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil indisponível'; END IF;
  IF NOT p.usage_shortcut_initialized THEN
    keys := ARRAY['registrar-uso'] || array_remove(COALESCE(p.home_shortcuts,
      ARRAY['passaporte','documentos','recibo','selos','saude','manutencoes','cockpit']), 'registrar-uso');
    UPDATE public.profiles SET home_shortcuts = keys, usage_shortcut_initialized = true WHERE id = auth.uid();
    RETURN keys;
  END IF;
  RETURN p.home_shortcuts;
END $$;
REVOKE ALL ON FUNCTION public.initialize_usage_shortcut() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.initialize_usage_shortcut() TO authenticated;

CREATE OR REPLACE FUNCTION public.commit_usage_reading(_moto uuid, _date date, _reading numeric, _location text DEFAULT '', _request_id uuid DEFAULT NULL)
RETURNS TABLE(event_id uuid, hours_total numeric, km_total numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.motorcycles%ROWTYPE; previous numeric; last_date date; prior uuid; result record;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_moto_owner(_moto) THEN RAISE EXCEPTION 'Motocicleta indisponível'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_moto::text, 42));
  SELECT * INTO m FROM public.motorcycles WHERE id = _moto FOR UPDATE;
  IF NOT FOUND OR m.status <> 'active' THEN RAISE EXCEPTION 'Motocicleta indisponível'; END IF;
  IF m.control_type NOT IN ('hours','km') THEN RAISE EXCEPTION 'Defina uma única unidade de medição no cadastro da moto'; END IF;
  IF _request_id IS NULL THEN RAISE EXCEPTION 'Identificação do registro obrigatória'; END IF;
  SELECT id INTO prior FROM public.events WHERE motorcycle_id = _moto AND created_by = auth.uid()
    AND metadata->>'usage_request_id' = _request_id::text;
  IF FOUND THEN
    RETURN QUERY SELECT prior, m.hours_total, m.km_total; RETURN;
  END IF;
  IF _date IS NULL OR _date > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'Data inválida ou futura'; END IF;
  IF _reading IS NULL OR _reading::text IN ('NaN','Infinity','-Infinity') OR _reading < 0 THEN RAISE EXCEPTION 'Leitura inválida'; END IF;
  IF m.control_type = 'hours' AND _reading <> round(_reading,2) THEN RAISE EXCEPTION 'Use até duas casas decimais'; END IF;
  IF m.control_type = 'km' AND _reading <> trunc(_reading) THEN RAISE EXCEPTION 'Informe quilômetros inteiros'; END IF;
  previous := CASE WHEN m.control_type = 'hours' THEN m.hours_total ELSE m.km_total END;
  IF _reading <= previous THEN RAISE EXCEPTION 'A leitura deve ser maior que a leitura atual'; END IF;
  SELECT max((occurred_at AT TIME ZONE 'America/Sao_Paulo')::date) INTO last_date FROM public.events
    WHERE motorcycle_id = _moto AND (COALESCE(hours_delta,0) <> 0 OR COALESCE(km_delta,0) <> 0);
  IF _date < COALESCE(last_date, (m.created_at AT TIME ZONE 'America/Sao_Paulo')::date) THEN
    RAISE EXCEPTION 'A data deve ser igual ou posterior à última leitura, para preservar o histórico';
  END IF;
  SELECT * INTO result FROM public.commit_event_and_recompose(
    _moto, 'usage', 'Registro de uso', '', COALESCE(_location,''),
    (_date + time '23:59:59') AT TIME ZONE 'America/Sao_Paulo',
    CASE WHEN m.control_type = 'hours' THEN _reading - previous ELSE NULL END,
    CASE WHEN m.control_type = 'km' THEN _reading - previous ELSE NULL END,
    NULL, NULL, jsonb_build_object('usage_request_id',_request_id,'accumulated_reading',_reading,'control_type',m.control_type));
  RETURN QUERY SELECT result.event_id::uuid, result.hours_total::numeric, result.km_total::numeric;
END $$;
REVOKE ALL ON FUNCTION public.commit_usage_reading(uuid,date,numeric,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_usage_reading(uuid,date,numeric,text,uuid) TO authenticated;