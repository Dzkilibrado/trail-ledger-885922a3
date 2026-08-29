-- =========================================================================
-- Entrega 1 — Evolução do Registro de Manutenção
--
-- Alterações no modelo de dados:
--   1. item_kind enum: classifica a natureza de cada item de manutenção
--      (técnico, mão de obra, despesa) sem alterar a lógica de ciclos,
--      que continua determinada exclusivamente por schedule_id NOT NULL.
--   2. cost_adjustment em events: permite registrar custos não itemizados
--      (desconto, acréscimo, taxa) sem criar um item fake.
--   3. RPC update_maintenance_and_recompose: operação atômica que cria
--      ou atualiza um evento de manutenção + seus itens + recompõe toda
--      a timeline + atualiza schedules + registra auditoria, com ROLLBACK
--      integral em caso de falha.
--
-- Nenhuma regra da TIL é alterada. recompose_timeline_server não é
-- modificado — o novo RPC o chama exatamente como hoje.
-- =========================================================================

-- ============ 1. ENUM item_kind ============
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_kind') THEN
    CREATE TYPE public.item_kind AS ENUM ('technical', 'labor', 'expense');
  END IF;
END $$;

COMMENT ON TYPE public.item_kind IS
  'Natureza de um item de manutenção.
   technical: peça/componente da moto (pneu, corrente, plástico, guidão…)
   labor:     mão de obra / serviço de terceiro (nunca vincula schedule)
   expense:   taxa, desconto, acréscimo ou outro custo avulso (nunca vincula schedule)
   Participação em ciclo de manutenção é determinada exclusivamente por
   schedule_id NOT NULL — item_kind classifica a natureza, não o ciclo.';

-- ============ 2. item_kind em maintenance_items ============
ALTER TABLE public.maintenance_items
  ADD COLUMN IF NOT EXISTS item_kind public.item_kind NOT NULL DEFAULT 'technical';

-- Inferência retroativa conservadora: itens existentes sem schedule e
-- com service contendo palavras-chave de serviço → labor.
-- Tudo mais permanece como technical (DEFAULT).
UPDATE public.maintenance_items
   SET item_kind = 'labor'
 WHERE schedule_id IS NULL
   AND item_kind = 'technical'
   AND (
     service ILIKE '%mão de obra%'
     OR service ILIKE '%mao de obra%'
     OR service ILIKE '%m.o.%'
     OR service ILIKE '%mao-de-obra%'
     OR service ILIKE '%instalac%'
     OR service ILIKE '%serviço%'
     OR service ILIKE '%servico%'
   );

-- ============ 3. cost_adjustment em events ============
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cost_adjustment NUMERIC(12,2);

COMMENT ON COLUMN public.events.cost_adjustment IS
  'Custo não itemizado: desconto (negativo), acréscimo ou taxa que não
   corresponde a nenhum item específico. Somado ao total dos itens pelo
   RPC para compor events.cost. NULL = sem ajuste.';

-- ============ 4. RPC atômico: update_maintenance_and_recompose ============
-- Substitui o acesso direto do front-end a maintenance_items.
-- Toda criação, edição ou exclusão de item DEVE passar por este RPC.
-- Garante: custo consistente, recomposição da timeline, atualização de
-- schedules, auditoria e ROLLBACK integral em caso de qualquer falha.

CREATE OR REPLACE FUNCTION public.update_maintenance_and_recompose(
  -- Identificadores
  _event_id         uuid,         -- NULL = criar novo evento
  _moto_id          uuid,         -- obrigatório sempre

  -- Campos do evento
  _type             public.event_type DEFAULT 'maintenance',
  _title            text          DEFAULT NULL,
  _occurred_at      timestamptz   DEFAULT now(),
  _hours_delta      numeric       DEFAULT NULL,
  _km_delta         numeric       DEFAULT NULL,
  _cost_adjustment  numeric       DEFAULT NULL,  -- custo não itemizado
  _workshop_id      uuid          DEFAULT NULL,
  _location         text          DEFAULT NULL,
  _description      text          DEFAULT NULL,

  -- Itens: upsert (criar ou atualizar) — array de objetos JSONB
  -- Cada objeto: { id?, service, item_kind?, category, product?, brand?,
  --               qty?, unit_value?, schedule_id?, template_item_id?,
  --               warranty_months? }
  _items_upsert     jsonb         DEFAULT '[]'::jsonb,

  -- Itens: IDs a excluir
  _items_delete     uuid[]        DEFAULT '{}'::uuid[]
)
RETURNS TABLE(
  event_id     uuid,
  hours_total  numeric,
  km_total     numeric,
  cost_total   numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_event_id   uuid := _event_id;
  v_cost_items numeric := 0;
  v_cost_total numeric;
  v_totals     RECORD;
  v_item       jsonb;
  v_item_id    uuid;
  v_item_kind  public.item_kind;
  v_sched_id   uuid;
BEGIN
  -- ---- autenticação e autorização ----
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF _moto_id IS NULL THEN
    RAISE EXCEPTION 'moto_id é obrigatório';
  END IF;
  IF NOT public.is_moto_owner(_moto_id) THEN
    RAISE EXCEPTION 'Acesso negado a esta motocicleta';
  END IF;

  -- ---- validações de entrada ----
  IF _hours_delta IS NOT NULL AND _hours_delta < 0 THEN
    RAISE EXCEPTION 'hours_delta não pode ser negativo';
  END IF;
  IF _km_delta IS NOT NULL AND _km_delta < 0 THEN
    RAISE EXCEPTION 'km_delta não pode ser negativo';
  END IF;

  -- ---- advisory lock por moto (serializa recomposições) ----
  PERFORM pg_advisory_xact_lock(hashtextextended(_moto_id::text, 42));

  -- ---- criar ou atualizar o evento ----
  IF v_event_id IS NULL THEN
    INSERT INTO public.events (
      motorcycle_id, created_by, type, title, occurred_at,
      hours_delta, km_delta, cost, workshop_id, location,
      description, cost_adjustment
    ) VALUES (
      _moto_id, v_uid, _type, _title, _occurred_at,
      _hours_delta, _km_delta, 0, _workshop_id, _location,
      _description, _cost_adjustment
    )
    RETURNING id INTO v_event_id;
  ELSE
    -- Confirma que o evento pertence a esta moto
    IF NOT EXISTS (
      SELECT 1 FROM public.events
       WHERE id = v_event_id AND motorcycle_id = _moto_id
    ) THEN
      RAISE EXCEPTION 'Evento não encontrado ou não pertence a esta moto';
    END IF;
    UPDATE public.events
       SET type             = COALESCE(_type, type),
           title            = COALESCE(_title, title),
           occurred_at      = COALESCE(_occurred_at, occurred_at),
           hours_delta      = _hours_delta,
           km_delta         = _km_delta,
           workshop_id      = _workshop_id,
           location         = NULLIF(_location, ''),
           description      = NULLIF(_description, ''),
           cost_adjustment  = _cost_adjustment,
           updated_at       = now()
     WHERE id = v_event_id;
  END IF;

  -- ---- excluir itens marcados para remoção ----
  IF array_length(_items_delete, 1) > 0 THEN
    DELETE FROM public.maintenance_items
     WHERE id = ANY(_items_delete)
       AND event_id = v_event_id;
  END IF;

  -- ---- upsert de itens ----
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items_upsert)
  LOOP
    v_item_kind := COALESCE(
      (v_item->>'item_kind')::public.item_kind,
      'technical'
    );
    v_sched_id  := (v_item->>'schedule_id')::uuid;

    -- Regra de integridade: labor/expense nunca vinculam schedule
    IF v_item_kind IN ('labor', 'expense') AND v_sched_id IS NOT NULL THEN
      RAISE EXCEPTION 'Itens do tipo % não podem vincular um schedule de manutenção', v_item_kind;
    END IF;

    v_item_id := (v_item->>'id')::uuid;

    IF v_item_id IS NULL THEN
      -- Novo item
      INSERT INTO public.maintenance_items (
        event_id, category, service, item_kind,
        product, brand, qty, unit_value,
        schedule_id, template_item_id, warranty_months
      ) VALUES (
        v_event_id,
        (v_item->>'category')::public.maintenance_category,
        v_item->>'service',
        v_item_kind,
        NULLIF(v_item->>'product', ''),
        NULLIF(v_item->>'brand', ''),
        (v_item->>'qty')::numeric,
        (v_item->>'unit_value')::numeric,
        v_sched_id,
        (v_item->>'template_item_id')::uuid,
        (v_item->>'warranty_months')::int
      );
    ELSE
      -- Atualizar item existente
      UPDATE public.maintenance_items
         SET category         = COALESCE((v_item->>'category')::public.maintenance_category, category),
             service          = COALESCE(NULLIF(v_item->>'service', ''), service),
             item_kind        = v_item_kind,
             product          = NULLIF(v_item->>'product', ''),
             brand            = NULLIF(v_item->>'brand', ''),
             qty              = (v_item->>'qty')::numeric,
             unit_value       = (v_item->>'unit_value')::numeric,
             schedule_id      = v_sched_id,
             template_item_id = COALESCE((v_item->>'template_item_id')::uuid, template_item_id),
             warranty_months  = (v_item->>'warranty_months')::int
       WHERE id = v_item_id AND event_id = v_event_id;
    END IF;
  END LOOP;

  -- ---- calcular events.cost (Single Source of Truth) ----
  SELECT COALESCE(SUM(COALESCE(qty, 1) * COALESCE(unit_value, 0)), 0)
    INTO v_cost_items
    FROM public.maintenance_items
   WHERE event_id = v_event_id;

  v_cost_total := v_cost_items + COALESCE(_cost_adjustment, 0);

  UPDATE public.events
     SET cost = v_cost_total
   WHERE id = v_event_id;

  -- ---- recomposição da timeline (sem alterar a função existente) ----
  SELECT * INTO v_totals
    FROM public.recompose_timeline_server(_moto_id);

  -- ---- retorno ----
  event_id    := v_event_id;
  hours_total := v_totals.hours_total;
  km_total    := v_totals.km_total;
  cost_total  := v_cost_total;
  RETURN NEXT;
END $$;

GRANT EXECUTE ON FUNCTION public.update_maintenance_and_recompose(
  uuid, uuid, public.event_type, text, timestamptz,
  numeric, numeric, numeric, uuid, text, text, jsonb, uuid[]
) TO authenticated;

-- Notifica o Supabase PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';
