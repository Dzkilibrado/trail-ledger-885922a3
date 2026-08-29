-- Correção: "column reference event_id is ambiguous"
-- Qualifica todos os acessos a maintenance_items com alias "mi"
-- para não conflitar com o parâmetro de saída "event_id" do RETURNS TABLE.

CREATE OR REPLACE FUNCTION public.update_maintenance_and_recompose(
  _event_id uuid, _moto_id uuid,
  _type public.event_type DEFAULT 'maintenance',
  _title text DEFAULT NULL, _occurred_at timestamptz DEFAULT now(),
  _hours_delta numeric DEFAULT NULL, _km_delta numeric DEFAULT NULL,
  _cost_adjustment numeric DEFAULT NULL, _workshop_id uuid DEFAULT NULL,
  _location text DEFAULT NULL, _description text DEFAULT NULL,
  _items_upsert jsonb DEFAULT '[]'::jsonb, _items_delete uuid[] DEFAULT '{}'::uuid[]
)
RETURNS TABLE(event_id uuid, hours_total numeric, km_total numeric, cost_total numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid(); v_event_id uuid := _event_id;
  v_cost_items numeric := 0; v_cost_total numeric;
  v_totals RECORD; v_item jsonb; v_item_id uuid;
  v_item_kind public.item_kind; v_sched_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _moto_id IS NULL THEN RAISE EXCEPTION 'moto_id é obrigatório'; END IF;
  IF NOT public.is_moto_owner(_moto_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_moto_id::text, 42));

  IF v_event_id IS NULL THEN
    INSERT INTO public.events (motorcycle_id, created_by, type, title, occurred_at, hours_delta, km_delta, cost, workshop_id, location, description, cost_adjustment)
    VALUES (_moto_id, v_uid, _type, _title, _occurred_at, _hours_delta, _km_delta, 0, _workshop_id, _location, _description, _cost_adjustment)
    RETURNING id INTO v_event_id;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = v_event_id AND motorcycle_id = _moto_id) THEN
      RAISE EXCEPTION 'Evento não encontrado ou não pertence a esta moto';
    END IF;
    UPDATE public.events SET type=COALESCE(_type,type), title=COALESCE(_title,title), occurred_at=COALESCE(_occurred_at,occurred_at), hours_delta=_hours_delta, km_delta=_km_delta, workshop_id=_workshop_id, location=NULLIF(_location,''), description=NULLIF(_description,''), cost_adjustment=_cost_adjustment, updated_at=now() WHERE id=v_event_id;
  END IF;

  IF array_length(_items_delete,1)>0 THEN
    DELETE FROM public.maintenance_items mi WHERE mi.id=ANY(_items_delete) AND mi.event_id=v_event_id;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items_upsert) LOOP
    v_item_kind := COALESCE((v_item->>'item_kind')::public.item_kind,'technical');
    v_sched_id  := (v_item->>'schedule_id')::uuid;
    IF v_item_kind IN ('labor','expense') AND v_sched_id IS NOT NULL THEN
      RAISE EXCEPTION 'Itens do tipo % não podem vincular schedule', v_item_kind;
    END IF;
    v_item_id := (v_item->>'id')::uuid;
    IF v_item_id IS NULL THEN
      INSERT INTO public.maintenance_items (event_id,category,service,item_kind,product,brand,qty,unit_value,schedule_id,template_item_id,warranty_months)
      VALUES (v_event_id,(v_item->>'category')::public.maintenance_category,v_item->>'service',v_item_kind,NULLIF(v_item->>'product',''),NULLIF(v_item->>'brand',''),(v_item->>'qty')::numeric,(v_item->>'unit_value')::numeric,v_sched_id,(v_item->>'template_item_id')::uuid,(v_item->>'warranty_months')::int);
    ELSE
      UPDATE public.maintenance_items mi SET category=COALESCE((v_item->>'category')::public.maintenance_category,mi.category), service=COALESCE(NULLIF(v_item->>'service',''),mi.service), item_kind=v_item_kind, product=NULLIF(v_item->>'product',''), brand=NULLIF(v_item->>'brand',''), qty=(v_item->>'qty')::numeric, unit_value=(v_item->>'unit_value')::numeric, schedule_id=v_sched_id, template_item_id=COALESCE((v_item->>'template_item_id')::uuid,mi.template_item_id), warranty_months=(v_item->>'warranty_months')::int WHERE mi.id=v_item_id AND mi.event_id=v_event_id;
    END IF;
  END LOOP;

  -- alias "mi" evita ambiguidade com o parâmetro de saída "event_id"
  SELECT COALESCE(SUM(COALESCE(mi.qty,1)*COALESCE(mi.unit_value,0)),0) INTO v_cost_items FROM public.maintenance_items mi WHERE mi.event_id=v_event_id;
  v_cost_total := v_cost_items + COALESCE(_cost_adjustment,0);
  UPDATE public.events SET cost=v_cost_total WHERE id=v_event_id;
  SELECT * INTO v_totals FROM public.recompose_timeline_server(_moto_id);
  event_id:=v_event_id; hours_total:=v_totals.hours_total; km_total:=v_totals.km_total; cost_total:=v_cost_total;
  RETURN NEXT;
END $$;

GRANT EXECUTE ON FUNCTION public.update_maintenance_and_recompose(uuid,uuid,public.event_type,text,timestamptz,numeric,numeric,numeric,uuid,text,text,jsonb,uuid[]) TO authenticated;
NOTIFY pgrst, 'reload schema';
