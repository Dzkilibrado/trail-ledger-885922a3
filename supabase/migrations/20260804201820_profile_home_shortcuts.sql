-- =========================================================
-- Atalhos personalizáveis da tela inicial
-- =========================================================
-- NULL = usuário ainda não personalizou → app usa o conjunto padrão.
-- Um array vazio é uma escolha válida (usuário removeu todos os atalhos).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS home_shortcuts text[] DEFAULT NULL;

COMMENT ON COLUMN public.profiles.home_shortcuts IS
  'Chaves dos atalhos escolhidos pelo usuário para a tela inicial (ver src/lib/home-shortcuts.ts), na ordem de exibição. NULL = usar o conjunto padrão.';
