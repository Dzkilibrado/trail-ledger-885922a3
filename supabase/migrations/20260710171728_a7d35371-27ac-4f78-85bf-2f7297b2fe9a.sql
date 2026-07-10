-- Fase 1.2 — Lifecycle oficial do Recibo Inteligente
ALTER TABLE public.smart_receipts DROP CONSTRAINT IF EXISTS smart_receipts_status_check;
ALTER TABLE public.smart_receipts
  ADD CONSTRAINT smart_receipts_status_check
  CHECK (status IN ('draft','issued','awaiting_acceptance','completed','cancelled','superseded','revoked'));

ALTER TABLE public.smart_receipts
  ADD COLUMN IF NOT EXISTS original_pdf_path text,
  ADD COLUMN IF NOT EXISTS signed_pdf_path text,
  ADD COLUMN IF NOT EXISTS seller_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyer_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_reason text,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_reason text,
  ADD COLUMN IF NOT EXISTS external_buyer boolean NOT NULL DEFAULT false;

UPDATE public.smart_receipts SET original_pdf_path = pdf_path
  WHERE original_pdf_path IS NULL AND pdf_path IS NOT NULL;

DROP TRIGGER IF EXISTS trg_on_smart_receipt_issued ON public.smart_receipts;
DROP FUNCTION IF EXISTS public.on_smart_receipt_issued();
DROP TRIGGER IF EXISTS trg_smart_receipts_supersede ON public.smart_receipts;

CREATE OR REPLACE FUNCTION public.smart_receipts_supersede_previous()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.previous_receipt_id IS NOT NULL AND NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE public.smart_receipts SET status = 'superseded', updated_at = now()
     WHERE id = NEW.previous_receipt_id AND status = 'completed';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_smart_receipts_supersede
AFTER INSERT OR UPDATE OF status ON public.smart_receipts
FOR EACH ROW EXECUTE FUNCTION public.smart_receipts_supersede_previous();

CREATE OR REPLACE FUNCTION public.on_smart_receipt_completed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_buyer_name text; v_doc_id uuid; v_signed_path text;
BEGIN
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN RETURN NEW; END IF;
  v_buyer_name := COALESCE(NEW.buyer_snapshot->>'full_name','Comprador');
  v_signed_path := COALESCE(NEW.signed_pdf_path, NEW.original_pdf_path, NEW.pdf_path);

  IF NOT EXISTS (
    SELECT 1 FROM public.events
     WHERE motorcycle_id = NEW.motorcycle_id AND type = 'ownership_transfer'
       AND (metadata->>'receipt_id') = NEW.id::text
  ) THEN
    INSERT INTO public.events (motorcycle_id, created_by, type, occurred_at, title, description, metadata)
    VALUES (NEW.motorcycle_id, NEW.seller_id, 'ownership_transfer',
      COALESCE(NEW.completed_at, now()),
      'Transferência de propriedade concluída',
      'Recibo ' || NEW.code || ' concluído — ' || v_buyer_name,
      jsonb_build_object('receipt_id',NEW.id,'receipt_code',NEW.code,'receipt_version',NEW.version,
        'buyer_user_id',NEW.buyer_id,'buyer_name',v_buyer_name,'external_buyer',NEW.external_buyer));
  END IF;

  UPDATE public.motorcycle_documents
    SET is_origin_document = false, updated_at = now()
    WHERE motorcycle_id = NEW.motorcycle_id
      AND is_origin_document = true AND is_current = true AND deleted_at IS NULL;

  IF NOT EXISTS (
    SELECT 1 FROM public.motorcycle_documents
    WHERE motorcycle_id = NEW.motorcycle_id AND doc_type='bill_of_sale'
      AND doc_number = NEW.code AND deleted_at IS NULL
  ) THEN
    INSERT INTO public.motorcycle_documents (
      motorcycle_id, doc_type, bucket, storage_path, file_name,
      mime_type, doc_number, doc_date, amount, notes,
      created_by, sha256, is_origin_document, is_current
    ) VALUES (
      NEW.motorcycle_id,'bill_of_sale','smart-receipts',v_signed_path,
      NEW.code || '-assinado.pdf','application/pdf',NEW.code,
      COALESCE((NEW.negotiation->>'date')::date,(NEW.completed_at)::date),
      NULLIF(NEW.negotiation->>'amount','')::numeric,
      'Recibo TrailBook assinado — validação em /r/' || NEW.code,
      NEW.seller_id, NEW.sha256, true, true
    ) RETURNING id INTO v_doc_id;
  ELSE
    UPDATE public.motorcycle_documents
      SET is_origin_document = true, storage_path = v_signed_path, updated_at = now()
      WHERE motorcycle_id = NEW.motorcycle_id AND doc_type='bill_of_sale'
        AND doc_number = NEW.code AND deleted_at IS NULL
      RETURNING id INTO v_doc_id;
  END IF;

  UPDATE public.ownership_history SET ended_at = COALESCE(NEW.completed_at, now())
    WHERE motorcycle_id = NEW.motorcycle_id AND ended_at IS NULL;

  IF NEW.buyer_id IS NOT NULL THEN
    INSERT INTO public.ownership_history (motorcycle_id, owner_id, started_at, method, notes)
    VALUES (NEW.motorcycle_id, NEW.buyer_id, COALESCE(NEW.completed_at, now()),
            'transfer', 'Transferido via Recibo ' || NEW.code);
    UPDATE public.motorcycles SET owner_id = NEW.buyer_id, updated_at = now()
      WHERE id = NEW.motorcycle_id;
  ELSIF NEW.external_buyer THEN
    UPDATE public.motorcycles
      SET status='archived', archived_at=now(), archived_by=NEW.seller_id,
          archive_reason='Vendida via Recibo ' || NEW.code || ' — comprador externo (' || v_buyer_name || ')',
          updated_at=now()
      WHERE id = NEW.motorcycle_id AND status <> 'archived';
  END IF;

  INSERT INTO public.audit_log (table_name, record_id, motorcycle_id, actor_id, action, old_values, new_values)
  VALUES ('smart_receipts', NEW.id, NEW.motorcycle_id, NEW.seller_id, 'update',
    jsonb_build_object('status', OLD.status),
    jsonb_build_object('status','completed','code',NEW.code,'version',NEW.version,
      'buyer_user_id',NEW.buyer_id,'buyer_name',v_buyer_name,
      'external_buyer',NEW.external_buyer,'origin_document_id',v_doc_id));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_on_smart_receipt_completed ON public.smart_receipts;
CREATE TRIGGER trg_on_smart_receipt_completed
  AFTER UPDATE OF status ON public.smart_receipts
  FOR EACH ROW WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.on_smart_receipt_completed();

CREATE UNIQUE INDEX IF NOT EXISTS uidx_events_ownership_receipt
  ON public.events ((metadata->>'receipt_id'))
  WHERE type = 'ownership_transfer' AND metadata ? 'receipt_id';

DROP FUNCTION IF EXISTS public.get_public_receipt(text) CASCADE;
DROP VIEW IF EXISTS public.public_receipt_validation CASCADE;

CREATE VIEW public.public_receipt_validation
WITH (security_invoker = true) AS
SELECT code, sha256, status, issued_at, signed_at, completed_at, version, previous_receipt_id,
  (motorcycle_snapshot ->> 'brand') AS moto_brand,
  (motorcycle_snapshot ->> 'model') AS moto_model,
  (motorcycle_snapshot ->> 'year_model') AS moto_year_model,
  (motorcycle_snapshot ->> 'chassis') AS moto_chassis,
  (seller_snapshot ->> 'full_name') AS seller_name,
  CASE WHEN (seller_snapshot ->> 'cpf') IS NULL THEN NULL
       ELSE '***.***.***-' || right(regexp_replace(seller_snapshot ->> 'cpf','\D','','g'),2) END AS seller_cpf_masked,
  (buyer_snapshot ->> 'full_name') AS buyer_name,
  CASE WHEN (buyer_snapshot ->> 'cpf') IS NULL THEN NULL
       ELSE '***.***.***-' || right(regexp_replace(buyer_snapshot ->> 'cpf','\D','','g'),2) END AS buyer_cpf_masked,
  (negotiation ->> 'amount') AS amount,
  (negotiation ->> 'payment_method') AS payment_method,
  (negotiation ->> 'date') AS negotiation_date,
  (negotiation ->> 'location') AS negotiation_location,
  external_buyer,
  (signed_pdf_path IS NOT NULL) AS has_signed_document
FROM public.smart_receipts
WHERE status IN ('issued','awaiting_acceptance','completed','superseded','revoked');

GRANT SELECT ON public.public_receipt_validation TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_receipt(_code text)
RETURNS SETOF public.public_receipt_validation
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.public_receipt_validation WHERE code = _code LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_receipt(text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_active_negotiation(uuid);
CREATE FUNCTION public.get_active_negotiation(_moto_id uuid)
RETURNS TABLE (
  id uuid, code text, status text, version integer,
  buyer_name text, amount numeric, created_at timestamptz,
  has_signed_document boolean, seller_accepted boolean, buyer_accepted boolean
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT sr.id, sr.code, sr.status::text, sr.version,
         sr.buyer_snapshot->>'full_name',
         NULLIF(sr.negotiation->>'amount','')::numeric,
         sr.created_at,
         (sr.signed_pdf_path IS NOT NULL),
         (sr.seller_accepted_at IS NOT NULL),
         (sr.buyer_accepted_at IS NOT NULL)
    FROM public.smart_receipts sr
   WHERE sr.motorcycle_id = _moto_id
     AND sr.status IN ('draft','issued','awaiting_acceptance')
   ORDER BY sr.created_at DESC LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_active_negotiation(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.get_receipt_pdf_path(text);
CREATE OR REPLACE FUNCTION public.get_receipt_pdf_path(_code text, _prefer_signed boolean DEFAULT true)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_orig text; v_signed text; v_seller uuid; v_buyer uuid;
BEGIN
  SELECT COALESCE(original_pdf_path, pdf_path), signed_pdf_path, seller_id, buyer_id
    INTO v_orig, v_signed, v_seller, v_buyer
    FROM public.smart_receipts WHERE code = _code LIMIT 1;
  IF v_orig IS NULL AND v_signed IS NULL THEN RETURN NULL; END IF;
  IF auth.uid() = v_seller OR auth.uid() = v_buyer OR public.has_role(auth.uid(),'admin') THEN
    RETURN CASE WHEN _prefer_signed AND v_signed IS NOT NULL THEN v_signed ELSE v_orig END;
  END IF;
  RETURN NULL;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_receipt_pdf_path(text, boolean) TO authenticated;

DROP POLICY IF EXISTS "smart_receipts_read_owner" ON storage.objects;
CREATE POLICY "smart_receipts_read_owner" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'smart-receipts' AND EXISTS (
    SELECT 1 FROM public.smart_receipts r
    WHERE (r.pdf_path = storage.objects.name
        OR r.original_pdf_path = storage.objects.name
        OR r.signed_pdf_path = storage.objects.name)
      AND (r.seller_id = auth.uid() OR r.buyer_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  )
);

DROP POLICY IF EXISTS "smart_receipts_upload_signed" ON storage.objects;
CREATE POLICY "smart_receipts_upload_signed" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'smart-receipts'
  AND name LIKE 'motorcycles/%/signed/%'
);