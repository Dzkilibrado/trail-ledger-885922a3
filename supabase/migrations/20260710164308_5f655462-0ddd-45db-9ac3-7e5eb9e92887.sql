
-- Recibo Inteligente ↔ Histórico de Propriedade
-- Ao emitir um Recibo (status='issued'):
--   1) registra evento de transferência na timeline
--   2) marca o PDF do recibo como Documento de Origem em motorcycle_documents
--   3) fecha ownership_history do vendedor e abre para o comprador (quando comprador for usuário TrailBook)
--   4) registra audit_log

CREATE OR REPLACE FUNCTION public.on_smart_receipt_issued()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_name text;
  v_doc_id uuid;
BEGIN
  IF NEW.status <> 'issued' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'issued' THEN RETURN NEW; END IF;

  v_buyer_name := COALESCE(NEW.buyer_snapshot->>'full_name', 'Comprador');

  -- 1) Evento na timeline
  INSERT INTO public.events (
    motorcycle_id, created_by, type, occurred_at, title, description, metadata
  ) VALUES (
    NEW.motorcycle_id,
    NEW.seller_id,
    'ownership_transfer',
    COALESCE(NEW.issued_at, now()),
    'Transferência de propriedade',
    'Recibo ' || NEW.code || ' emitido para ' || v_buyer_name,
    jsonb_build_object(
      'receipt_id', NEW.id,
      'receipt_code', NEW.code,
      'receipt_version', NEW.version,
      'buyer_user_id', NEW.buyer_id,
      'buyer_name', v_buyer_name
    )
  );

  -- 2) Documento de Origem — remove flag anterior e insere referência ao PDF do recibo
  UPDATE public.motorcycle_documents
    SET is_origin_document = false, updated_at = now()
    WHERE motorcycle_id = NEW.motorcycle_id
      AND is_origin_document = true
      AND is_current = true
      AND deleted_at IS NULL;

  INSERT INTO public.motorcycle_documents (
    motorcycle_id, doc_type, bucket, storage_path, file_name,
    mime_type, doc_number, doc_date, amount, notes,
    created_by, sha256, is_origin_document, is_current
  ) VALUES (
    NEW.motorcycle_id,
    'bill_of_sale',
    'smart-receipts',
    NEW.pdf_path,
    NEW.code || '-v' || NEW.version || '.pdf',
    'application/pdf',
    NEW.code,
    COALESCE((NEW.negotiation->>'date')::date, (NEW.issued_at)::date),
    NULLIF(NEW.negotiation->>'amount','')::numeric,
    'Recibo Inteligente TrailBook — validação em /r/' || NEW.code,
    NEW.seller_id,
    NEW.sha256,
    true,
    true
  )
  RETURNING id INTO v_doc_id;

  -- 3) Ownership history — só transfere quando comprador é usuário TrailBook
  IF NEW.buyer_id IS NOT NULL THEN
    UPDATE public.ownership_history
      SET ended_at = COALESCE(NEW.issued_at, now())
      WHERE motorcycle_id = NEW.motorcycle_id
        AND ended_at IS NULL;

    INSERT INTO public.ownership_history (
      motorcycle_id, owner_id, started_at, method, notes
    ) VALUES (
      NEW.motorcycle_id,
      NEW.buyer_id,
      COALESCE(NEW.issued_at, now()),
      'transfer',
      'Transferido via Recibo ' || NEW.code
    );

    -- Reflete a mudança na moto (owner_id atual)
    UPDATE public.motorcycles
      SET owner_id = NEW.buyer_id, updated_at = now()
      WHERE id = NEW.motorcycle_id;
  END IF;

  -- 4) Auditoria
  INSERT INTO public.audit_log (
    motorcycle_id, actor_id, action, entity_type, entity_id, details
  ) VALUES (
    NEW.motorcycle_id,
    NEW.seller_id,
    'receipt.issued',
    'smart_receipt',
    NEW.id,
    jsonb_build_object(
      'code', NEW.code,
      'version', NEW.version,
      'buyer_user_id', NEW.buyer_id,
      'buyer_name', v_buyer_name,
      'origin_document_id', v_doc_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_smart_receipt_issued ON public.smart_receipts;
CREATE TRIGGER trg_on_smart_receipt_issued
  AFTER INSERT OR UPDATE OF status ON public.smart_receipts
  FOR EACH ROW
  WHEN (NEW.status = 'issued')
  EXECUTE FUNCTION public.on_smart_receipt_issued();

-- View de documento de origem vigente por moto
CREATE OR REPLACE VIEW public.motorcycle_origin_document_view
WITH (security_invoker = true) AS
SELECT
  m.id AS motorcycle_id,
  d.id AS document_id,
  d.doc_type,
  d.doc_number,
  d.doc_date,
  d.storage_path,
  d.bucket,
  d.file_name,
  CASE
    WHEN d.doc_type = 'invoice' THEN 'invoice'
    WHEN d.doc_type = 'bill_of_sale' THEN 'receipt'
    ELSE 'other'
  END AS source_kind,
  CASE WHEN d.doc_type = 'bill_of_sale' THEN d.doc_number ELSE NULL END AS receipt_code
FROM public.motorcycles m
LEFT JOIN public.motorcycle_documents d
  ON d.motorcycle_id = m.id
 AND d.is_origin_document = true
 AND d.is_current = true
 AND d.deleted_at IS NULL;

GRANT SELECT ON public.motorcycle_origin_document_view TO authenticated;

-- RPC: negociação em andamento (recibo em rascunho mais recente)
CREATE OR REPLACE FUNCTION public.get_active_negotiation(_moto_id uuid)
RETURNS TABLE (
  id uuid,
  code text,
  status text,
  version integer,
  buyer_name text,
  amount numeric,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    sr.id,
    sr.code,
    sr.status::text,
    sr.version,
    sr.buyer_snapshot->>'full_name' AS buyer_name,
    NULLIF(sr.negotiation->>'amount','')::numeric AS amount,
    sr.created_at
  FROM public.smart_receipts sr
  WHERE sr.motorcycle_id = _moto_id
    AND sr.status = 'draft'
  ORDER BY sr.created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_negotiation(uuid) TO authenticated;
