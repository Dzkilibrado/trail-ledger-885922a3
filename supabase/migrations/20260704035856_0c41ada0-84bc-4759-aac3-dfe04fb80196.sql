
-- 1) Colunas de arquivamento
ALTER TABLE public.motorcycles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'motorcycles_status_check') THEN
    ALTER TABLE public.motorcycles
      ADD CONSTRAINT motorcycles_status_check CHECK (status IN ('active','archived','deleted'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS motorcycles_status_idx ON public.motorcycles(status);

-- 2) Função de arquivamento seguro
CREATE OR REPLACE FUNCTION public.archive_motorcycle(_moto_id UUID, _reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.motorcycles%ROWTYPE;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO m FROM public.motorcycles WHERE id = _moto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Motocicleta não encontrada'; END IF;
  IF m.owner_id <> uid THEN RAISE EXCEPTION 'Apenas o proprietário pode arquivar esta moto'; END IF;
  IF m.status = 'archived' THEN RETURN jsonb_build_object('ok', true, 'already', true); END IF;

  IF EXISTS (
    SELECT 1 FROM public.ownership_transfers
    WHERE motorcycle_id = _moto_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Existe transferência pendente. Cancele ou conclua antes de arquivar.';
  END IF;

  UPDATE public.motorcycles
    SET status = 'archived',
        archived_at = now(),
        archived_by = uid,
        archive_reason = _reason
    WHERE id = _moto_id;

  UPDATE public.certificates
    SET status = 'revoked'
    WHERE motorcycle_id = _moto_id AND status = 'active';

  INSERT INTO public.audit_log(table_name, record_id, motorcycle_id, actor_id, action, old_values, new_values)
  VALUES ('motorcycles', _moto_id, _moto_id, uid, 'archive',
          jsonb_build_object('status', m.status),
          jsonb_build_object('status', 'archived', 'reason', _reason));

  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.archive_motorcycle(UUID, TEXT) TO authenticated;

-- 3) Reativar (desarquivar) — mesmo dono
CREATE OR REPLACE FUNCTION public.unarchive_motorcycle(_moto_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE m public.motorcycles%ROWTYPE; uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO m FROM public.motorcycles WHERE id = _moto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Motocicleta não encontrada'; END IF;
  IF m.owner_id <> uid THEN RAISE EXCEPTION 'Apenas o proprietário pode reativar esta moto'; END IF;

  UPDATE public.motorcycles
    SET status='active', archived_at=NULL, archived_by=NULL, archive_reason=NULL
    WHERE id=_moto_id;

  INSERT INTO public.audit_log(table_name, record_id, motorcycle_id, actor_id, action, old_values, new_values)
  VALUES ('motorcycles', _moto_id, _moto_id, uid, 'unarchive',
          jsonb_build_object('status', m.status),
          jsonb_build_object('status', 'active'));

  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.unarchive_motorcycle(UUID) TO authenticated;

-- 4) Dashboard admin ampliado
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r JSONB;
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT jsonb_build_object(
    'users_total',       (SELECT count(*) FROM public.profiles),
    'users_active',      (SELECT count(*) FROM public.profiles WHERE status='active'),
    'users_pending',     (SELECT count(*) FROM public.profiles WHERE status='pending'),
    'users_blocked',     (SELECT count(*) FROM public.profiles WHERE status='blocked'),
    'motorcycles_total', (SELECT count(*) FROM public.motorcycles),
    'motorcycles_active',(SELECT count(*) FROM public.motorcycles WHERE status='active'),
    'motorcycles_archived',(SELECT count(*) FROM public.motorcycles WHERE status='archived'),
    'documents_total',   (SELECT count(*) FROM public.motorcycle_documents WHERE deleted_at IS NULL),
    'certificates_total',(SELECT count(*) FROM public.certificates WHERE status='active'),
    'tickets_open',      (SELECT count(*) FROM public.tickets WHERE status IN ('open','in_analysis','in_progress')),
    'tickets_critical',  (SELECT count(*) FROM public.tickets WHERE priority='critical' AND status NOT IN ('closed','cancelled','resolved')),
    'tickets_waiting',   (SELECT count(*) FROM public.tickets WHERE status='awaiting_user'),
    'modules_maintenance',(SELECT count(*) FROM public.platform_modules WHERE status='maintenance'),
    'messages_recent',   (SELECT count(*) FROM public.messages WHERE created_at > now() - interval '7 days')
  ) INTO r;
  RETURN r;
END $$;
