-- Ativa o Realtime na tabela de módulos, para que uma mudança de
-- status feita pelo admin (ativo/manutenção/desabilitado) apareça
-- na hora para usuários já logados, sem precisar sair e entrar de
-- novo na conta.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'platform_modules'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_modules;
  END IF;
END $$;

-- Garante que o payload de UPDATE traga a linha completa (necessário
-- para o Realtime funcionar de forma consistente nessa tabela).
ALTER TABLE public.platform_modules REPLICA IDENTITY FULL;
