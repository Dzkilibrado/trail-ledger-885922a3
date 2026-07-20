
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS user_last_read_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_last_read_at timestamptz;

-- Count tickets that require the current user's attention:
-- open (not resolved/closed/cancelled) AND either awaiting_user
-- OR there is a non-internal message from someone else (support/admin)
-- posted after the user's last read (or never read).
CREATE OR REPLACE FUNCTION public.user_attention_tickets_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.tickets t
  WHERE t.user_id = auth.uid()
    AND t.status IN ('open','in_analysis','in_progress','awaiting_user')
    AND EXISTS (
      SELECT 1 FROM public.ticket_messages m
      WHERE m.ticket_id = t.id
        AND m.is_internal = false
        AND m.author_id <> t.user_id
        AND m.created_at > COALESCE(t.user_last_read_at, 'epoch'::timestamptz)
    );
$$;

-- Count tickets that require admin attention:
-- new / awaiting support work, i.e. status in (open, in_analysis, in_progress)
-- AND (never read by admin OR the last non-internal activity is newer
--       than admin_last_read_at from a non-admin author).
CREATE OR REPLACE FUNCTION public.admin_attention_tickets_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN public.has_role(auth.uid(), 'admin'::app_role) THEN (
    SELECT COUNT(*)::int
    FROM public.tickets t
    WHERE t.status IN ('open','in_analysis','in_progress')
      AND (
        t.admin_last_read_at IS NULL
        OR t.last_activity_at > t.admin_last_read_at
      )
  ) ELSE 0 END;
$$;

GRANT EXECUTE ON FUNCTION public.user_attention_tickets_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_attention_tickets_count() TO authenticated;
