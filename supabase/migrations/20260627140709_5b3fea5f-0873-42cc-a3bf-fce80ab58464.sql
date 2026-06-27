
-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ USER ROLES ============
CREATE TYPE public.app_role AS ENUM ('owner', 'mechanic', 'admin');
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ WORKSHOPS ============
CREATE TABLE public.workshops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshops TO authenticated;
GRANT ALL ON public.workshops TO service_role;
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workshops_select_all_auth" ON public.workshops FOR SELECT TO authenticated USING (true);
CREATE POLICY "workshops_insert_auth" ON public.workshops FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id OR owner_user_id IS NULL);
CREATE POLICY "workshops_update_own" ON public.workshops FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "workshops_delete_own" ON public.workshops FOR DELETE TO authenticated USING (auth.uid() = owner_user_id);
CREATE TRIGGER workshops_touch BEFORE UPDATE ON public.workshops FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ MOTORCYCLES ============
CREATE TYPE public.control_type AS ENUM ('hours', 'km', 'both');

CREATE TABLE public.motorcycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year_make INT,
  year_model INT,
  displacement INT,
  control_type public.control_type NOT NULL DEFAULT 'hours',
  chassis TEXT,
  engine_number TEXT,
  plate TEXT,
  renavam TEXT,
  main_photo_url TEXT,
  hours_total NUMERIC(10,1) NOT NULL DEFAULT 0,
  km_total NUMERIC(10,1) NOT NULL DEFAULT 0,
  conservation_score INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.motorcycles TO authenticated;
GRANT ALL ON public.motorcycles TO service_role;
ALTER TABLE public.motorcycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "moto_select_own" ON public.motorcycles FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "moto_insert_own" ON public.motorcycles FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "moto_update_own" ON public.motorcycles FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "moto_delete_own" ON public.motorcycles FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER moto_touch BEFORE UPDATE ON public.motorcycles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX moto_owner_idx ON public.motorcycles(owner_id);

-- helper: is motorcycle owner
CREATE OR REPLACE FUNCTION public.is_moto_owner(_moto_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.motorcycles WHERE id = _moto_id AND owner_id = auth.uid())
$$;

-- ============ EVENTS (TIMELINE) ============
CREATE TYPE public.event_type AS ENUM (
  'usage','maintenance','revision','accessory','photo','video','document',
  'purchase','sale','ownership_transfer','recall','warranty','note'
);

CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.event_type NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  hours_at_event NUMERIC(10,1),
  km_at_event NUMERIC(10,1),
  hours_delta NUMERIC(10,1),
  km_delta NUMERIC(10,1),
  cost NUMERIC(12,2),
  workshop_id UUID REFERENCES public.workshops(id) ON DELETE SET NULL,
  signed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  signed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select_owner" ON public.events FOR SELECT TO authenticated USING (public.is_moto_owner(motorcycle_id));
CREATE POLICY "events_insert_owner" ON public.events FOR INSERT TO authenticated WITH CHECK (public.is_moto_owner(motorcycle_id) AND auth.uid() = created_by);
CREATE POLICY "events_update_owner" ON public.events FOR UPDATE TO authenticated USING (public.is_moto_owner(motorcycle_id));
CREATE POLICY "events_delete_owner" ON public.events FOR DELETE TO authenticated USING (public.is_moto_owner(motorcycle_id));
CREATE INDEX events_moto_time_idx ON public.events(motorcycle_id, occurred_at DESC);
CREATE TRIGGER events_touch BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ EVENT ATTACHMENTS ============
CREATE TYPE public.attachment_kind AS ENUM ('photo','video','document','invoice');
CREATE TABLE public.event_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  bucket TEXT NOT NULL,
  kind public.attachment_kind NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_attachments TO authenticated;
GRANT ALL ON public.event_attachments TO service_role;
ALTER TABLE public.event_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attach_select" ON public.event_attachments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND public.is_moto_owner(e.motorcycle_id)));
CREATE POLICY "attach_insert" ON public.event_attachments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND public.is_moto_owner(e.motorcycle_id)));
CREATE POLICY "attach_delete" ON public.event_attachments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND public.is_moto_owner(e.motorcycle_id)));

-- ============ MAINTENANCE ITEMS ============
CREATE TYPE public.maintenance_category AS ENUM ('engine','suspension','brakes','transmission','wheels','electrical','cooling','other');

CREATE TABLE public.maintenance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category public.maintenance_category NOT NULL,
  service TEXT NOT NULL,
  product TEXT,
  brand TEXT,
  qty NUMERIC(10,2),
  unit_value NUMERIC(12,2),
  warranty_months INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_items TO authenticated;
GRANT ALL ON public.maintenance_items TO service_role;
ALTER TABLE public.maintenance_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mi_select" ON public.maintenance_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND public.is_moto_owner(e.motorcycle_id)));
CREATE POLICY "mi_insert" ON public.maintenance_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND public.is_moto_owner(e.motorcycle_id)));
CREATE POLICY "mi_update" ON public.maintenance_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND public.is_moto_owner(e.motorcycle_id)));
CREATE POLICY "mi_delete" ON public.maintenance_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND public.is_moto_owner(e.motorcycle_id)));

-- ============ MAINTENANCE SCHEDULES ============
CREATE TABLE public.maintenance_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category public.maintenance_category NOT NULL,
  interval_hours NUMERIC(10,1),
  interval_km NUMERIC(10,1),
  interval_days INT,
  last_done_hours NUMERIC(10,1),
  last_done_km NUMERIC(10,1),
  last_done_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_schedules TO authenticated;
GRANT ALL ON public.maintenance_schedules TO service_role;
ALTER TABLE public.maintenance_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_select" ON public.maintenance_schedules FOR SELECT TO authenticated USING (public.is_moto_owner(motorcycle_id));
CREATE POLICY "ms_insert" ON public.maintenance_schedules FOR INSERT TO authenticated WITH CHECK (public.is_moto_owner(motorcycle_id));
CREATE POLICY "ms_update" ON public.maintenance_schedules FOR UPDATE TO authenticated USING (public.is_moto_owner(motorcycle_id));
CREATE POLICY "ms_delete" ON public.maintenance_schedules FOR DELETE TO authenticated USING (public.is_moto_owner(motorcycle_id));
CREATE TRIGGER ms_touch BEFORE UPDATE ON public.maintenance_schedules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ CERTIFICATES ============
CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  public_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  expires_at TIMESTAMPTZ,
  allowed_sections JSONB NOT NULL DEFAULT '["timeline","maintenance","photos"]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificates TO authenticated;
GRANT SELECT ON public.certificates TO anon;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cert_select_owner" ON public.certificates FOR SELECT TO authenticated USING (public.is_moto_owner(motorcycle_id));
CREATE POLICY "cert_insert_owner" ON public.certificates FOR INSERT TO authenticated WITH CHECK (public.is_moto_owner(motorcycle_id));
CREATE POLICY "cert_delete_owner" ON public.certificates FOR DELETE TO authenticated USING (public.is_moto_owner(motorcycle_id));
CREATE POLICY "cert_select_public" ON public.certificates FOR SELECT TO anon USING (expires_at IS NULL OR expires_at > now());

-- ============ STORAGE POLICIES ============
-- Users can manage files inside a folder named after their user id
CREATE POLICY "storage_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('motorcycle-photos','event-media','documents') AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "storage_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('motorcycle-photos','event-media','documents') AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "storage_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('motorcycle-photos','event-media','documents') AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "storage_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('motorcycle-photos','event-media','documents') AND (storage.foldername(name))[1] = auth.uid()::text);
