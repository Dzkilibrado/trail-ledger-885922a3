
-- 1) Flag de homologação em motocicletas
ALTER TABLE public.motorcycles
  ADD COLUMN IF NOT EXISTS is_homologation boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS motorcycles_is_homologation_idx ON public.motorcycles(is_homologation) WHERE is_homologation;

-- 2) Tabela imutável de TrailBook IDs aposentados (não reutilizáveis)
CREATE TABLE IF NOT EXISTS public.retired_trailbook_ids (
  trailbook_id text PRIMARY KEY,
  moto_id uuid,
  retired_at timestamptz NOT NULL DEFAULT now(),
  retired_by uuid,
  reason text,
  snapshot jsonb NOT NULL
);
GRANT SELECT ON public.retired_trailbook_ids TO authenticated;
GRANT ALL ON public.retired_trailbook_ids TO service_role;
ALTER TABLE public.retired_trailbook_ids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin can read retired ids" ON public.retired_trailbook_ids;
CREATE POLICY "admin can read retired ids" ON public.retired_trailbook_ids
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Bloqueia reutilização do TrailBook ID
CREATE OR REPLACE FUNCTION public.block_reused_trailbook_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.trailbook_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.retired_trailbook_ids WHERE trailbook_id = NEW.trailbook_id) THEN
    RAISE EXCEPTION 'TrailBook ID % foi aposentado e não pode ser reutilizado', NEW.trailbook_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_block_reused_trailbook_id ON public.motorcycles;
CREATE TRIGGER trg_block_reused_trailbook_id
BEFORE INSERT OR UPDATE OF trailbook_id ON public.motorcycles
FOR EACH ROW EXECUTE FUNCTION public.block_reused_trailbook_id();

-- 3) Admin: alternar flag de homologação
CREATE OR REPLACE FUNCTION public.admin_set_motorcycle_homologation(_moto uuid, _flag boolean, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_owner uuid; v_old boolean;
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT owner_id, is_homologation INTO v_owner, v_old FROM public.motorcycles WHERE id = _moto;
  IF NOT FOUND THEN RAISE EXCEPTION 'Motocicleta não encontrada'; END IF;

  UPDATE public.motorcycles SET is_homologation = _flag, updated_at = now() WHERE id = _moto;

  PERFORM public.admin_log_event(
    v_owner, 'motorcycle_homologation_flag', _reason, NULL, 'is_homologation',
    to_jsonb(v_old), to_jsonb(_flag),
    jsonb_build_object('motorcycle_id', _moto), NULL
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_motorcycle_homologation(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_motorcycle_homologation(uuid,boolean,text) TO authenticated;

-- 4) Resumo de impacto (contagens) para pré-visualizar a exclusão
CREATE OR REPLACE FUNCTION public.admin_motorcycle_impact(_moto uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r jsonb; m public.motorcycles%ROWTYPE;
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO m FROM public.motorcycles WHERE id = _moto;
  IF NOT FOUND THEN RAISE EXCEPTION 'Motocicleta não encontrada'; END IF;

  r := jsonb_build_object(
    'motorcycle', jsonb_build_object(
      'id', m.id, 'trailbook_id', m.trailbook_id, 'brand', m.brand, 'model', m.model,
      'year_make', m.year_make, 'year_model', m.year_model,
      'is_homologation', m.is_homologation, 'status', m.status, 'owner_id', m.owner_id
    ),
    'owner', (
      SELECT jsonb_build_object('full_name', p.full_name, 'email', p.email,
        'cpf_masked', CASE WHEN p.cpf IS NULL THEN NULL ELSE '***'||right(p.cpf,4) END)
      FROM public.profiles p WHERE p.id = m.owner_id
    ),
    'counts', jsonb_build_object(
      'events',        (SELECT count(*) FROM public.events WHERE motorcycle_id = _moto),
      'event_attachments', (SELECT count(*) FROM public.event_attachments a JOIN public.events e ON e.id=a.event_id WHERE e.motorcycle_id = _moto),
      'documents',     (SELECT count(*) FROM public.motorcycle_documents WHERE motorcycle_id = _moto),
      'photos',        (SELECT count(*) FROM public.motorcycle_photos WHERE motorcycle_id = _moto),
      'certificates',  (SELECT count(*) FROM public.certificates WHERE motorcycle_id = _moto),
      'schedules',     (SELECT count(*) FROM public.maintenance_schedules WHERE motorcycle_id = _moto),
      'inspections',   (SELECT count(*) FROM public.maintenance_inspections WHERE motorcycle_id = _moto),
      'ownership',     (SELECT count(*) FROM public.ownership_history WHERE motorcycle_id = _moto),
      'transfers',     (SELECT count(*) FROM public.ownership_transfers WHERE motorcycle_id = _moto),
      'tickets',       (SELECT count(*) FROM public.tickets WHERE motorcycle_id = _moto)
    ),
    'storage_paths', jsonb_build_object(
      'documents', COALESCE((SELECT jsonb_agg(jsonb_build_object('bucket',bucket,'path',storage_path))
                              FROM public.motorcycle_documents WHERE motorcycle_id=_moto AND storage_path IS NOT NULL),'[]'::jsonb),
      'photos', COALESCE((SELECT jsonb_agg(jsonb_build_object('bucket',bucket,'path',storage_path))
                              FROM public.motorcycle_photos WHERE motorcycle_id=_moto AND storage_path IS NOT NULL),'[]'::jsonb),
      'event_attachments', COALESCE((SELECT jsonb_agg(jsonb_build_object('bucket',a.bucket,'path',a.storage_path))
                              FROM public.event_attachments a JOIN public.events e ON e.id=a.event_id
                              WHERE e.motorcycle_id=_moto AND a.storage_path IS NOT NULL),'[]'::jsonb)
    )
  );
  RETURN r;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_motorcycle_impact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_motorcycle_impact(uuid) TO authenticated;

-- 5) Preparar exclusão: valida regras, cria snapshot e aposenta o TrailBook ID
CREATE OR REPLACE FUNCTION public.admin_prepare_homolog_moto_deletion(
  _moto uuid, _reason text, _confirmation text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE m public.motorcycles%ROWTYPE; v_snapshot jsonb;
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF btrim(COALESCE(_confirmation,'')) <> 'EXCLUIR' THEN RAISE EXCEPTION 'Confirmação inválida'; END IF;
  IF _reason IS NULL OR length(btrim(_reason))<3 THEN RAISE EXCEPTION 'Motivo obrigatório'; END IF;

  SELECT * INTO m FROM public.motorcycles WHERE id = _moto;
  IF NOT FOUND THEN RAISE EXCEPTION 'Motocicleta não encontrada'; END IF;
  IF NOT m.is_homologation THEN
    RAISE EXCEPTION 'Apenas motos marcadas como Homologação podem ser excluídas fisicamente';
  END IF;

  v_snapshot := public.admin_motorcycle_impact(_moto)
                || jsonb_build_object(
                     'actor_id', auth.uid(),
                     'confirmation', _confirmation,
                     'reason', _reason,
                     'created_at', now()
                   );

  -- Registra o TrailBook ID aposentado (não pode ser reutilizado nem excluído)
  INSERT INTO public.retired_trailbook_ids(trailbook_id, moto_id, retired_by, reason, snapshot)
  VALUES (m.trailbook_id, m.id, auth.uid(), _reason, v_snapshot)
  ON CONFLICT (trailbook_id) DO NOTHING;

  -- Registro imutável em admin_user_events
  PERFORM public.admin_log_event(
    m.owner_id, 'homolog_motorcycle_delete_snapshot', _reason, NULL, NULL, NULL, NULL,
    jsonb_build_object('motorcycle_id', m.id, 'trailbook_id', m.trailbook_id, 'confirmation', _confirmation),
    v_snapshot
  );

  RETURN v_snapshot;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_prepare_homolog_moto_deletion(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_prepare_homolog_moto_deletion(uuid,text,text) TO authenticated;

-- 6) Executar exclusão física (cascata cuida das FKs). Deve ser chamada
--    depois de prepare + após a limpeza de arquivos no storage no server function.
CREATE OR REPLACE FUNCTION public.admin_execute_homolog_moto_deletion(
  _moto uuid, _reason text, _storage_report jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE m public.motorcycles%ROWTYPE;
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO m FROM public.motorcycles WHERE id = _moto;
  IF NOT FOUND THEN RAISE EXCEPTION 'Motocicleta não encontrada'; END IF;
  IF NOT m.is_homologation THEN RAISE EXCEPTION 'Moto não é de homologação'; END IF;

  -- Snapshot deve existir (garantia)
  IF NOT EXISTS (SELECT 1 FROM public.retired_trailbook_ids WHERE trailbook_id = m.trailbook_id) THEN
    RAISE EXCEPTION 'Snapshot ausente. Execute prepare antes.';
  END IF;

  DELETE FROM public.motorcycles WHERE id = _moto;

  PERFORM public.admin_log_event(
    m.owner_id, 'homolog_motorcycle_deleted', _reason, NULL, NULL,
    to_jsonb(m), NULL,
    jsonb_build_object('motorcycle_id', m.id, 'trailbook_id', m.trailbook_id, 'storage', COALESCE(_storage_report,'{}'::jsonb)),
    NULL
  );

  RETURN jsonb_build_object('ok', true, 'trailbook_id', m.trailbook_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_execute_homolog_moto_deletion(uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_execute_homolog_moto_deletion(uuid,text,jsonb) TO authenticated;
