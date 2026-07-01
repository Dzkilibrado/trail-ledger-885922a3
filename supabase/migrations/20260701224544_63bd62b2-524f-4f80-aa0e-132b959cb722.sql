
-- Enum de status
DO $$ BEGIN
  CREATE TYPE public.module_status AS ENUM ('active','maintenance','disabled','beta');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.platform_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  status public.module_status NOT NULL DEFAULT 'active',
  maintenance_message TEXT,
  maintenance_until TIMESTAMPTZ,
  maintenance_reason TEXT,
  hide_when_disabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_modules TO authenticated, anon;
GRANT ALL ON public.platform_modules TO service_role;

ALTER TABLE public.platform_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modules readable by anyone"
  ON public.platform_modules FOR SELECT
  USING (true);

CREATE POLICY "modules admin manage"
  ON public.platform_modules FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_platform_modules_updated_at
  BEFORE UPDATE ON public.platform_modules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_platform_modules_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.platform_modules
  FOR EACH ROW EXECUTE FUNCTION public.write_admin_audit();

-- Seed
INSERT INTO public.platform_modules (key,label,description,status,sort_order) VALUES
  ('dashboard','Dashboard','Visão geral do usuário','active',10),
  ('motorcycles','Motos','Cadastro e gestão de motocicletas','active',20),
  ('documents','Documentos da Moto','Central de documentos e Nota Fiscal','active',30),
  ('agenda','Agenda','Agenda inteligente de manutenções','active',40),
  ('workshops','Oficinas','Cadastro de oficinas parceiras','active',50),
  ('financial','Financeiro','Controle financeiro de gastos','active',60),
  ('certificates','Certificados','Certificados públicos e QR Code','active',70),
  ('transfers','Transferências','Transferência de propriedade','active',80),
  ('tickets','Chamados','Central de suporte','active',90),
  ('plans','Planos','Planos e assinaturas','active',100),
  ('marketplace','Marketplace','Marketplace de motos usadas','disabled',110),
  ('ai','IA','Assistente inteligente TrailBook','beta',120)
ON CONFLICT (key) DO NOTHING;

-- RPC pública para consulta (ignora RLS de sessão anônima estranha)
CREATE OR REPLACE FUNCTION public.get_platform_modules()
RETURNS SETOF public.platform_modules
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM public.platform_modules ORDER BY sort_order, label $$;

GRANT EXECUTE ON FUNCTION public.get_platform_modules() TO anon, authenticated;

-- RPC administrativa para atualizar
CREATE OR REPLACE FUNCTION public.admin_update_module(
  _key TEXT,
  _status public.module_status,
  _maintenance_message TEXT DEFAULT NULL,
  _maintenance_until TIMESTAMPTZ DEFAULT NULL,
  _maintenance_reason TEXT DEFAULT NULL,
  _hide_when_disabled BOOLEAN DEFAULT NULL
) RETURNS public.platform_modules
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.platform_modules%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.platform_modules
     SET status = _status,
         maintenance_message = COALESCE(_maintenance_message, maintenance_message),
         maintenance_until   = _maintenance_until,
         maintenance_reason  = COALESCE(_maintenance_reason, maintenance_reason),
         hide_when_disabled  = COALESCE(_hide_when_disabled, hide_when_disabled),
         updated_by = auth.uid(),
         updated_at = now()
   WHERE key = _key
  RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Module % not found', _key; END IF;
  RETURN r;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_update_module(TEXT,public.module_status,TEXT,TIMESTAMPTZ,TEXT,BOOLEAN) TO authenticated;
