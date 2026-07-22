
-- motorcycles: add WITH CHECK to prevent owner_id / admin-flag takeover
DROP POLICY IF EXISTS moto_update_own ON public.motorcycles;
CREATE POLICY moto_update_own ON public.motorcycles
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Trigger to lock admin-controlled columns for non-admin updates
CREATE OR REPLACE FUNCTION public.motorcycles_block_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_user_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'owner_id só pode ser alterado via transferência oficial';
  END IF;
  IF NEW.is_homologation IS DISTINCT FROM OLD.is_homologation THEN
    RAISE EXCEPTION 'is_homologation é controlado pelo administrador';
  END IF;
  IF to_jsonb(NEW) ? 'plan_review_status'
     AND (to_jsonb(NEW)->>'plan_review_status') IS DISTINCT FROM (to_jsonb(OLD)->>'plan_review_status') THEN
    RAISE EXCEPTION 'plan_review_status é controlado pelo administrador';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS motorcycles_block_admin_fields ON public.motorcycles;
CREATE TRIGGER motorcycles_block_admin_fields
  BEFORE UPDATE ON public.motorcycles
  FOR EACH ROW EXECUTE FUNCTION public.motorcycles_block_admin_fields();

-- workshops: add WITH CHECK preventing owner_user_id takeover
DROP POLICY IF EXISTS workshops_update_own ON public.workshops;
CREATE POLICY workshops_update_own ON public.workshops
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE OR REPLACE FUNCTION public.workshops_block_owner_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_user_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'owner_user_id não pode ser alterado';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS workshops_block_owner_change ON public.workshops;
CREATE TRIGGER workshops_block_owner_change
  BEFORE UPDATE ON public.workshops
  FOR EACH ROW EXECUTE FUNCTION public.workshops_block_owner_change();

-- cpf_change_requests: tighten policy + reinforce existing guard trigger
DROP POLICY IF EXISTS cpf_req_own_update ON public.cpf_change_requests;
CREATE POLICY cpf_req_own_update ON public.cpf_change_requests
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND status = ANY (ARRAY['open'::cpf_change_status, 'awaiting_info'::cpf_change_status])
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status = ANY (ARRAY['open'::cpf_change_status, 'awaiting_info'::cpf_change_status, 'cancelled'::cpf_change_status])
  );
