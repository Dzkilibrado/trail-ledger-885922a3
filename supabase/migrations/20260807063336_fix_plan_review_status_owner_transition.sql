-- =========================================================================
-- Correção: a trava de segurança em motorcycles_block_admin_fields
-- (2026-07-22) bloqueava QUALQUER mudança em plan_review_status por não
-- admin — inclusive impedindo, sem querer, dois fluxos legítimos e já
-- existentes do próprio dono da moto:
--   1) Confirmar a revisão inicial (InitialReviewSheet "Concluir revisão")
--   2) Confirmar que revisou o plano de manutenção (motorcycles/:id/plan)
-- Ambos tentam gravar plan_review_status: 'pending' -> 'reviewed' junto
-- com outro campo, e a trigger recusava a atualização INTEIRA (inclusive
-- o outro campo), sem nenhum aviso — o usuário via "sucesso" na tela
-- mesmo a gravação inteira tendo sido rejeitada pelo banco.
--
-- Esta migration permite especificamente essa transição (pending -> 
-- reviewed) para o próprio dono da moto — a única mudança que o
-- app realmente faz nesse fluxo — mantendo qualquer outra alteração
-- nesse campo (voltar para pending, pular etapa, valores arbitrários)
-- travada só para admin, como antes.
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
    -- Única transição que o próprio dono pode fazer: confirmar que revisou
    -- (pending -> reviewed). Qualquer outra mudança nesse campo continua
    -- travada para admin.
    IF NOT (
      (to_jsonb(OLD)->>'plan_review_status') = 'pending'
      AND (to_jsonb(NEW)->>'plan_review_status') = 'reviewed'
    ) THEN
      RAISE EXCEPTION 'plan_review_status é controlado pelo administrador';
    END IF;
  END IF;
  RETURN NEW;
END $$;
