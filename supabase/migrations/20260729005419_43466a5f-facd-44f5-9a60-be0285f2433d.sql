CREATE TABLE public.event_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.motorcycle_documents(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, document_id)
);

CREATE INDEX event_documents_event_id_idx ON public.event_documents(event_id);
CREATE INDEX event_documents_document_id_idx ON public.event_documents(document_id);

GRANT SELECT, INSERT, DELETE ON public.event_documents TO authenticated;
GRANT ALL ON public.event_documents TO service_role;

ALTER TABLE public.event_documents ENABLE ROW LEVEL SECURITY;

-- Owner (via events -> motorcycles) or admin can view links
CREATE POLICY "event_documents_select_owner_or_admin"
ON public.event_documents FOR SELECT
TO authenticated
USING (
  public.is_user_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_documents.event_id
      AND public.is_moto_owner(e.motorcycle_id)
  )
);

-- Owner can create link when they own both the event's moto AND the document's moto (must match)
CREATE POLICY "event_documents_insert_owner"
ON public.event_documents FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.motorcycle_documents d ON d.id = event_documents.document_id
    WHERE e.id = event_documents.event_id
      AND d.motorcycle_id = e.motorcycle_id
      AND public.is_moto_owner(e.motorcycle_id)
      AND d.deleted_at IS NULL
  )
);

-- Owner or admin can unlink
CREATE POLICY "event_documents_delete_owner_or_admin"
ON public.event_documents FOR DELETE
TO authenticated
USING (
  public.is_user_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_documents.event_id
      AND public.is_moto_owner(e.motorcycle_id)
  )
);