-- Menu inferior personalizável (mobile) — mesma lógica dos atalhos da
-- tela inicial (profiles.home_shortcuts): NULL = usa a ordem padrão.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bottom_nav_items text[];
