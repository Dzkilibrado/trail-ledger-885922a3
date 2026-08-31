-- Adiciona tipos de documento de manutenção ao enum
DO $$ BEGIN
  ALTER TYPE public.motorcycle_document_type ADD VALUE IF NOT EXISTS 'workshop_receipt';
  ALTER TYPE public.motorcycle_document_type ADD VALUE IF NOT EXISTS 'inspection_report';
  ALTER TYPE public.motorcycle_document_type ADD VALUE IF NOT EXISTS 'photo';
  ALTER TYPE public.motorcycle_document_type ADD VALUE IF NOT EXISTS 'certificate';
EXCEPTION WHEN others THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
