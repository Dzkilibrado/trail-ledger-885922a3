
-- Add WITH CHECK to profiles_update_own and admin update policies + trigger blocking protected fields for non-admins
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.profiles_block_protected_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := public.is_user_admin(v_uid);
BEGIN
  -- Admins and service_role bypass (service_role runs as postgres, auth.uid() is null → skip guard).
  IF v_uid IS NULL OR v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Only the row owner can reach here through profiles_update_own; still, block privileged columns.
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    RAISE EXCEPTION 'Alteração de plano não permitida';
  END IF;
  IF NEW.plan_since IS DISTINCT FROM OLD.plan_since THEN
    NEW.plan_since := OLD.plan_since;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Alteração de status não permitida';
  END IF;
  IF NEW.is_homologation IS DISTINCT FROM OLD.is_homologation THEN
    RAISE EXCEPTION 'Alteração de flag de homologação não permitida';
  END IF;
  IF NEW.blocked_reason IS DISTINCT FROM OLD.blocked_reason
     OR NEW.blocked_notes IS DISTINCT FROM OLD.blocked_notes
     OR NEW.blocked_at IS DISTINCT FROM OLD.blocked_at THEN
    RAISE EXCEPTION 'Alteração de dados de bloqueio não permitida';
  END IF;
  IF NEW.inactive_reason IS DISTINCT FROM OLD.inactive_reason
     OR NEW.inactive_notes IS DISTINCT FROM OLD.inactive_notes
     OR NEW.inactive_at IS DISTINCT FROM OLD.inactive_at THEN
    RAISE EXCEPTION 'Alteração de dados de inatividade não permitida';
  END IF;
  IF NEW.cpf_locked_at IS DISTINCT FROM OLD.cpf_locked_at THEN
    RAISE EXCEPTION 'Alteração do bloqueio de CPF não permitida';
  END IF;
  -- CPF: once locked, cannot be changed by the user; even before lock, changes only via admin flow.
  IF NEW.cpf IS DISTINCT FROM OLD.cpf THEN
    IF OLD.cpf_locked_at IS NOT NULL OR OLD.cpf IS NOT NULL THEN
      RAISE EXCEPTION 'Alteração de CPF deve ser solicitada via chamado';
    END IF;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Alteração de id não permitida';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    -- Email alterations should go through auth flow; block direct table PATCH.
    RAISE EXCEPTION 'Alteração de e-mail deve ser feita pelo fluxo de conta';
  END IF;
  IF NEW.profile_completed_at IS DISTINCT FROM OLD.profile_completed_at
     AND OLD.profile_completed_at IS NOT NULL THEN
    NEW.profile_completed_at := OLD.profile_completed_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_protected_fields ON public.profiles;
CREATE TRIGGER profiles_block_protected_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_block_protected_fields();
