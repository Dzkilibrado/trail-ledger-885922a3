ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'archive';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'unarchive';