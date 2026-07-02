-- Galeria de mídias da motocicleta (fotos hoje; preparado para vídeos)
CREATE TYPE public.media_kind AS ENUM ('photo', 'video');

CREATE TABLE public.motorcycle_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL DEFAULT 'motorcycle-photos',
  storage_path TEXT NOT NULL,
  kind public.media_kind NOT NULL DEFAULT 'photo',
  caption TEXT,
  position INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX motorcycle_photos_moto_idx ON public.motorcycle_photos(motorcycle_id, position);
CREATE UNIQUE INDEX motorcycle_photos_primary_unique
  ON public.motorcycle_photos(motorcycle_id)
  WHERE is_primary = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.motorcycle_photos TO authenticated;
GRANT ALL ON public.motorcycle_photos TO service_role;

ALTER TABLE public.motorcycle_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos: owner reads"
  ON public.motorcycle_photos FOR SELECT TO authenticated
  USING (public.is_moto_owner(motorcycle_id));
CREATE POLICY "photos: owner writes"
  ON public.motorcycle_photos FOR INSERT TO authenticated
  WITH CHECK (public.is_moto_owner(motorcycle_id));
CREATE POLICY "photos: owner updates"
  ON public.motorcycle_photos FOR UPDATE TO authenticated
  USING (public.is_moto_owner(motorcycle_id))
  WITH CHECK (public.is_moto_owner(motorcycle_id));
CREATE POLICY "photos: owner deletes"
  ON public.motorcycle_photos FOR DELETE TO authenticated
  USING (public.is_moto_owner(motorcycle_id));

CREATE TRIGGER touch_motorcycle_photos
  BEFORE UPDATE ON public.motorcycle_photos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Ao marcar uma foto como principal, desmarca as demais e sincroniza main_photo_url
CREATE OR REPLACE FUNCTION public.sync_primary_photo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE public.motorcycle_photos
       SET is_primary = false
     WHERE motorcycle_id = NEW.motorcycle_id AND id <> NEW.id AND is_primary = true;
    UPDATE public.motorcycles
       SET main_photo_url = NEW.storage_path
     WHERE id = NEW.motorcycle_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER motorcycle_photos_sync_primary
  AFTER INSERT OR UPDATE OF is_primary, storage_path ON public.motorcycle_photos
  FOR EACH ROW EXECUTE FUNCTION public.sync_primary_photo();

-- Backfill: se a moto já tem main_photo_url e nenhuma foto na galeria, cria entrada
INSERT INTO public.motorcycle_photos (motorcycle_id, storage_path, is_primary, position, created_by)
SELECT m.id, m.main_photo_url, true, 0, m.owner_id
  FROM public.motorcycles m
  LEFT JOIN public.motorcycle_photos p ON p.motorcycle_id = m.id
 WHERE m.main_photo_url IS NOT NULL AND p.id IS NULL;
