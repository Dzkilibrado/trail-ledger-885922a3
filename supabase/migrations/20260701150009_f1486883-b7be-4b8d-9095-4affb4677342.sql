-- Enum para tipos de documento permanente
DO $$ BEGIN
  CREATE TYPE public.motorcycle_document_type AS ENUM (
    'invoice', 'manual', 'warranty', 'import', 'contract', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela de documentos permanentes da motocicleta
CREATE TABLE IF NOT EXISTS public.motorcycle_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  doc_type public.motorcycle_document_type NOT NULL,
  bucket TEXT NOT NULL DEFAULT 'documents',
  storage_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  doc_number TEXT,
  doc_date DATE,
  issuer TEXT,
  amount NUMERIC(12,2),
  notes TEXT,
  custom_label TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS motorcycle_documents_moto_idx ON public.motorcycle_documents(motorcycle_id);
CREATE INDEX IF NOT EXISTS motorcycle_documents_type_idx ON public.motorcycle_documents(motorcycle_id, doc_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.motorcycle_documents TO authenticated;
GRANT ALL ON public.motorcycle_documents TO service_role;

ALTER TABLE public.motorcycle_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_select_own" ON public.motorcycle_documents FOR SELECT TO authenticated
  USING (public.is_moto_owner(motorcycle_id));
CREATE POLICY "docs_insert_own" ON public.motorcycle_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_moto_owner(motorcycle_id) AND created_by = auth.uid());
CREATE POLICY "docs_update_own" ON public.motorcycle_documents FOR UPDATE TO authenticated
  USING (public.is_moto_owner(motorcycle_id)) WITH CHECK (public.is_moto_owner(motorcycle_id));
CREATE POLICY "docs_delete_own" ON public.motorcycle_documents FOR DELETE TO authenticated
  USING (public.is_moto_owner(motorcycle_id));

-- updated_at
DROP TRIGGER IF EXISTS trg_motorcycle_documents_touch ON public.motorcycle_documents;
CREATE TRIGGER trg_motorcycle_documents_touch BEFORE UPDATE ON public.motorcycle_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auditoria: reutiliza write_audit já existente
DROP TRIGGER IF EXISTS trg_motorcycle_documents_audit ON public.motorcycle_documents;
CREATE TRIGGER trg_motorcycle_documents_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.motorcycle_documents
  FOR EACH ROW EXECUTE FUNCTION public.write_audit();

-- Storage RLS para bucket 'documents' (privado). Só o dono da moto acessa.
DROP POLICY IF EXISTS "docs_storage_select_own" ON storage.objects;
CREATE POLICY "docs_storage_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents' AND EXISTS (
      SELECT 1 FROM public.motorcycle_documents d
      WHERE d.storage_path = storage.objects.name
        AND public.is_moto_owner(d.motorcycle_id)
    )
  );
DROP POLICY IF EXISTS "docs_storage_insert_own" ON storage.objects;
CREATE POLICY "docs_storage_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND owner = auth.uid());
DROP POLICY IF EXISTS "docs_storage_delete_own" ON storage.objects;
CREATE POLICY "docs_storage_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND owner = auth.uid());

-- Atualiza get_public_certificate para expor apenas *presença* de documentos permanentes,
-- respeitando allowed_sections. Nunca retorna número, valor, arquivo, data ou emissor.
CREATE OR REPLACE FUNCTION public.get_public_certificate(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cert public.certificates%ROWTYPE;
  v_moto public.motorcycles%ROWTYPE;
  v_result JSONB;
  v_has_invoice BOOLEAN;
BEGIN
  SELECT * INTO v_cert FROM public.certificates WHERE public_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_cert.status <> 'active' THEN RETURN NULL; END IF;
  IF v_cert.expires_at IS NOT NULL AND v_cert.expires_at < now() THEN RETURN NULL; END IF;
  SELECT * INTO v_moto FROM public.motorcycles WHERE id = v_cert.motorcycle_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.motorcycle_documents
    WHERE motorcycle_id = v_moto.id AND doc_type = 'invoice'
  ) INTO v_has_invoice;

  v_result := jsonb_build_object(
    'certificate', jsonb_build_object(
      'public_token', v_cert.public_token,
      'created_at', v_cert.created_at,
      'expires_at', v_cert.expires_at,
      'status', v_cert.status,
      'allowed_sections', v_cert.allowed_sections
    ),
    'motorcycle', to_jsonb(v_moto),
    'owner', (SELECT jsonb_build_object('full_name', full_name, 'avatar_url', avatar_url)
              FROM public.profiles WHERE id = v_moto.owner_id),
    'events', COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.occurred_at DESC)
              FROM public.events e WHERE e.motorcycle_id = v_moto.id), '[]'::jsonb),
    'schedules', COALESCE((SELECT jsonb_agg(to_jsonb(s))
              FROM public.maintenance_schedules s WHERE s.motorcycle_id = v_moto.id AND s.active), '[]'::jsonb),
    'attachments', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', a.id, 'event_id', a.event_id, 'bucket', a.bucket,
                'storage_path', a.storage_path, 'kind', a.kind, 'caption', a.caption))
              FROM public.event_attachments a JOIN public.events e ON e.id = a.event_id
              WHERE e.motorcycle_id = v_moto.id), '[]'::jsonb),
    'workshops', COALESCE((SELECT jsonb_agg(DISTINCT jsonb_build_object(
                'id', w.id, 'name', w.name, 'city', w.city,
                'verified', w.verified, 'verified_label', w.verified_label))
              FROM public.workshops w JOIN public.events e ON e.workshop_id = w.id
              WHERE e.motorcycle_id = v_moto.id), '[]'::jsonb),
    'ownership', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', h.id, 'started_at', h.started_at, 'ended_at', h.ended_at,
                'method', h.method,
                'owner_name', (SELECT full_name FROM public.profiles WHERE id = h.owner_id)
              ) ORDER BY h.started_at)
              FROM public.ownership_history h WHERE h.motorcycle_id = v_moto.id), '[]'::jsonb),
    'documents_presence', jsonb_build_object(
      'invoice', v_has_invoice
    )
  );

  RETURN v_result;
END;
$function$;