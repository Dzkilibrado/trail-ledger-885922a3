CREATE OR REPLACE FUNCTION public.smart_receipts_restrict_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_buyer boolean := (auth.uid() IS NOT NULL AND auth.uid() = OLD.buyer_id);
  is_seller boolean := (auth.uid() IS NOT NULL AND auth.uid() = OLD.seller_id);
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- Campos imutáveis para qualquer parte (comprador/vendedor).
  -- Alterações legítimas em snapshots/documentos/encerramento só
  -- ocorrem via fluxos SECURITY DEFINER (current_user != 'authenticated').
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.motorcycle_id IS DISTINCT FROM OLD.motorcycle_id
     OR NEW.code IS DISTINCT FROM OLD.code
     OR NEW.sha256 IS DISTINCT FROM OLD.sha256
     OR NEW.bucket IS DISTINCT FROM OLD.bucket
     OR NEW.pdf_path IS DISTINCT FROM OLD.pdf_path
     OR NEW.qr_path IS DISTINCT FROM OLD.qr_path
     OR NEW.original_pdf_path IS DISTINCT FROM OLD.original_pdf_path
     OR NEW.signed_pdf_path IS DISTINCT FROM OLD.signed_pdf_path
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
     OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
     OR NEW.seller_snapshot IS DISTINCT FROM OLD.seller_snapshot
     OR NEW.buyer_snapshot IS DISTINCT FROM OLD.buyer_snapshot
     OR NEW.motorcycle_snapshot IS DISTINCT FROM OLD.motorcycle_snapshot
     OR NEW.negotiation IS DISTINCT FROM OLD.negotiation
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.previous_receipt_id IS DISTINCT FROM OLD.previous_receipt_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.external_buyer IS DISTINCT FROM OLD.external_buyer
     OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
     OR NEW.revoked_reason IS DISTINCT FROM OLD.revoked_reason
     -- Encerramento/cancelamento: apenas via RPC oficial `close_smart_receipt_process`.
     OR NEW.closure_type IS DISTINCT FROM OLD.closure_type
     OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
     OR NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by
     OR NEW.cancelled_by_role IS DISTINCT FROM OLD.cancelled_by_role
     OR NEW.cancellation_reason_code IS DISTINCT FROM OLD.cancellation_reason_code
     OR NEW.cancellation_notes IS DISTINCT FROM OLD.cancellation_notes
     OR NEW.cancellation_origin IS DISTINCT FROM OLD.cancellation_origin
     OR NEW.cancel_reason IS DISTINCT FROM OLD.cancel_reason
     OR NEW.cancelled_reason IS DISTINCT FROM OLD.cancelled_reason
     OR NEW.previous_status IS DISTINCT FROM OLD.previous_status
  THEN
    RAISE EXCEPTION 'Este campo do recibo só pode ser alterado por fluxo oficial ou administrador.'
      USING ERRCODE = '42501';
  END IF;

  -- Buyer: só pode registrar o próprio aceite
  IF is_buyer AND NOT is_seller THEN
    IF NEW.seller_accepted_at IS DISTINCT FROM OLD.seller_accepted_at
       OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
       OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
       OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
    THEN
      RAISE EXCEPTION 'Comprador só pode atualizar o próprio aceite.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Seller: não pode registrar aceite do comprador
  IF is_seller AND NOT is_buyer THEN
    IF NEW.buyer_accepted_at IS DISTINCT FROM OLD.buyer_accepted_at THEN
      RAISE EXCEPTION 'Vendedor não pode registrar o aceite do comprador.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;