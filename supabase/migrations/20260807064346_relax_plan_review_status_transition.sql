-- =========================================================================
-- Segunda correção: a regra anterior exigia a transição EXATA
-- 'pending' -> 'reviewed'. Se o valor atual da moto não for
-- literalmente 'pending' (nulo, outro valor legado, etc.), a trava
-- continuava recusando. Como 'reviewed' é uma autodeclaração do dono
-- ("eu revisei"), não uma verificação administrativa, é seguro permitir
-- que o dono grave esse valor específico independente do estado atual —
-- qualquer outro valor (voltar para pending, pular etapa, etc.) continua
-- travado só para admin.
-- =========================================================================

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
    -- O dono pode autodeclarar que revisou (-> 'reviewed'), venha de
    -- qual for o valor anterior. Qualquer outro destino continua
    -- travado para admin.
    IF (to_jsonb(NEW)->>'plan_review_status') IS DISTINCT FROM 'reviewed' THEN
      RAISE EXCEPTION 'plan_review_status é controlado pelo administrador';
    END IF;
  END IF;
  RETURN NEW;
END $$;
