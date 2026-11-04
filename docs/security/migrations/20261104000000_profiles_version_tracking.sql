-- Migration: rastreamento de versão por usuário + force logout
-- Data: 2026-11-04
-- Proposta: NÃO aplicar diretamente. Executar via Lovable após aprovação de DZK.
--
-- Objetivo:
--   - Registrar a versão do frontend que cada usuário está usando
--   - Permitir que o admin force logout de um usuário específico
--     (o cliente verifica force_logout_at na inicialização)
--
-- IMPORTANTE: Esta proposta não deve ser colocada em diretório gerenciado
-- de migrations automáticas. Requer aprovação explícita antes de aplicar.

-- 1. Colunas de rastreamento de versão
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS app_version      text,
  ADD COLUMN IF NOT EXISTS app_build_id     text,
  ADD COLUMN IF NOT EXISTS app_last_seen_at timestamptz;

-- 2. Coluna para forçar logout de um usuário
--    O cliente verifica: se session.created_at < force_logout_at → sign out silencioso
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS force_logout_at timestamptz;

-- 3. Índice para o filtro de versão no admin (opcional, mas recomendado)
CREATE INDEX IF NOT EXISTS idx_profiles_app_version
  ON profiles (app_version)
  WHERE app_version IS NOT NULL;

-- 4. Permitir que o próprio usuário atualize apenas as colunas de versão
--    (RLS: o usuário já pode UPDATE na própria linha; garantir que app_version
--     e app_build_id e app_last_seen_at façam parte do policy de update)
--    Se já existir policy permissiva de self-update, nada a fazer aqui.
--    Caso contrário, ajustar a policy existente para incluir essas colunas.
--
--    Exemplo (adaptar ao nome real da policy no projeto):
--    ALTER POLICY "Users can update own profile" ON profiles
--      USING (auth.uid() = id);
--    -- (já inclui todas as colunas por padrão se for um policy de row-level)

-- 5. Permitir que admin atualize force_logout_at de outros usuários
--    Se já existir policy de admin, incluir a coluna force_logout_at.
--    Caso contrário, criar uma policy de serviço que permite UPDATE via service role.
--    (O client-side usa supabase com anon key; a atualização do admin deve ser
--     feita via RPC server-side ou usando a service_role key no backend.)
--
-- Alternativa mais simples: criar uma função RPC com SECURITY DEFINER que
-- só pode ser chamada por admin:

CREATE OR REPLACE FUNCTION admin_force_logout(_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Apenas admins podem chamar esta função
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE profiles
  SET force_logout_at = now()
  WHERE id = _user;
END;
$$;

-- Revogar acesso direto e permitir apenas via RPC autenticado
REVOKE ALL ON FUNCTION admin_force_logout(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_force_logout(uuid) TO authenticated;
