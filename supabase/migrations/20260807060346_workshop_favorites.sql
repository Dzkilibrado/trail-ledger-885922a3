-- "Oficina de confiança": marcação pessoal do usuário sobre uma oficina do
-- catálogo compartilhado (workshops). Não altera nada da oficina em si —
-- é só a relação "eu confio nesta" de cada usuário, privada por natureza.
CREATE TABLE IF NOT EXISTS public.workshop_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, workshop_id)
);

ALTER TABLE public.workshop_favorites ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.workshop_favorites TO authenticated;
GRANT ALL ON public.workshop_favorites TO service_role;

CREATE POLICY "workshop_favorites_select_own" ON public.workshop_favorites
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "workshop_favorites_insert_own" ON public.workshop_favorites
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "workshop_favorites_delete_own" ON public.workshop_favorites
  FOR DELETE TO authenticated USING (user_id = auth.uid());
