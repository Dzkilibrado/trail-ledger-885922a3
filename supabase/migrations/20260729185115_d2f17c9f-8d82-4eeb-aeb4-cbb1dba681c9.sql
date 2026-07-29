CREATE UNIQUE INDEX IF NOT EXISTS health_reports_run_id_uniq
  ON public.health_reports (run_id) WHERE run_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.health_reports_after_issue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.health_reports r
     SET status = 'superseded',
         superseded_by = NEW.id
   WHERE r.motorcycle_id = NEW.motorcycle_id
     AND r.id <> NEW.id
     AND r.status IN ('valid','expiring','outdated');

  INSERT INTO public.health_report_events (report_id, motorcycle_id, kind, description, actor_id)
  SELECT r.id, r.motorcycle_id, 'superseded',
         'Substituído pelo laudo ' || coalesce(NEW.code,''), NEW.issued_by
    FROM public.health_reports r
   WHERE r.superseded_by = NEW.id;

  INSERT INTO public.health_report_events (report_id, motorcycle_id, kind, description, actor_id)
  VALUES (NEW.id, NEW.motorcycle_id, 'issued',
          'Laudo ' || coalesce(NEW.code,'') || ' emitido', NEW.issued_by);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_health_reports_after_issue ON public.health_reports;
CREATE TRIGGER trg_health_reports_after_issue
AFTER INSERT ON public.health_reports
FOR EACH ROW EXECUTE FUNCTION public.health_reports_after_issue();