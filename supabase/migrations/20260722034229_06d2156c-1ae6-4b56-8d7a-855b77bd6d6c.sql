
CREATE OR REPLACE FUNCTION public.cpf_change_requests_block_owner_field_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins may change anything (approve/reject/notes/status)
  IF public.is_user_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Owner updates: only 'reason' and 'document_path' may change
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.ticket_id IS DISTINCT FROM OLD.ticket_id
     OR NEW.current_cpf_hash IS DISTINCT FROM OLD.current_cpf_hash
     OR NEW.new_cpf IS DISTINCT FROM OLD.new_cpf
     OR NEW.new_cpf_hash IS DISTINCT FROM OLD.new_cpf_hash
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.decided_by IS DISTINCT FROM OLD.decided_by
     OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
     OR NEW.decision_notes IS DISTINCT FROM OLD.decision_notes
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Only reason and document_path can be modified by the requester'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cpf_change_requests_block_owner_field_changes ON public.cpf_change_requests;
CREATE TRIGGER cpf_change_requests_block_owner_field_changes
  BEFORE UPDATE ON public.cpf_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.cpf_change_requests_block_owner_field_changes();
