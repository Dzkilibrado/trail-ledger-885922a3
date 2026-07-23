
-- Add WITH CHECK to UPDATE policies to prevent reassigning ownership fields.

DROP POLICY IF EXISTS events_update_owner ON public.events;
CREATE POLICY events_update_owner ON public.events
  FOR UPDATE TO authenticated
  USING (public.is_moto_owner(motorcycle_id))
  WITH CHECK (public.is_moto_owner(motorcycle_id));

DROP POLICY IF EXISTS ot_update_party ON public.ownership_transfers;
CREATE POLICY ot_update_party ON public.ownership_transfers
  FOR UPDATE TO authenticated
  USING ((from_user_id = auth.uid()) OR (to_user_id = auth.uid()))
  WITH CHECK ((from_user_id = auth.uid()) OR (to_user_id = auth.uid()));

DROP POLICY IF EXISTS mi_update ON public.maintenance_items;
CREATE POLICY mi_update ON public.maintenance_items
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = maintenance_items.event_id AND public.is_moto_owner(e.motorcycle_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = maintenance_items.event_id AND public.is_moto_owner(e.motorcycle_id)));

DROP POLICY IF EXISTS ms_update ON public.maintenance_schedules;
CREATE POLICY ms_update ON public.maintenance_schedules
  FOR UPDATE TO authenticated
  USING (public.is_moto_owner(motorcycle_id))
  WITH CHECK (public.is_moto_owner(motorcycle_id));

-- motorcycle_documents already has a WITH CHECK, but rewrite for consistency
DROP POLICY IF EXISTS docs_update_own ON public.motorcycle_documents;
CREATE POLICY docs_update_own ON public.motorcycle_documents
  FOR UPDATE TO authenticated
  USING (public.is_moto_owner(motorcycle_id))
  WITH CHECK (public.is_moto_owner(motorcycle_id));

-- workshops: hide phone/cnpj from non-owners via column-level privileges.
-- Owners retrieve their private data via the my_workshop_private RPC.
REVOKE SELECT ON public.workshops FROM authenticated;
GRANT SELECT (id, name, city, state, owner_user_id, verified, verified_at, verified_label, created_at, updated_at) ON public.workshops TO authenticated;
