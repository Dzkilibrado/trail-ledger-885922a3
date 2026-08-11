-- =========================================================================
-- Exclusão de conta e Redefinição de conta.
--
-- REDEFINIÇÃO ("reset_own_account"): apaga todas as motos do usuário (e,
-- em cascata, tudo que depende delas — eventos, documentos, manutenções,
-- certificados, etc.), suas oficinas de confiança e as personalizações de
-- tela (atalhos/menu inferior). O login, e-mail e cadastro básico
-- continuam intactos — fica como se o usuário tivesse acabado de se
-- cadastrar.
--
-- EXCLUSÃO ("delete_own_account"): remove a conta por completo, incluindo
-- o login (auth.users). Como profiles.id e motorcycles.owner_id já
-- referenciam auth.users(id) ON DELETE CASCADE (e tudo que depende de
-- moto referencia motorcycles(id) ON DELETE CASCADE), apagar a linha em
-- auth.users é suficiente para apagar todo o restante automaticamente.
-- O e-mail fica livre para um cadastro novo depois.
--
-- As duas ações respeitam uma trava do admin, usando o MESMO sistema já
-- existente de módulos (platform_modules) — Ativo / Manutenção / 
-- Desabilitado, sem precisar de nenhuma tabela ou lógica nova para isso.
-- =========================================================================

INSERT INTO public.platform_modules (key, label, description, status, sort_order) VALUES
  ('account_reset', 'Redefinição de Conta', 'Usuário apaga motos, registros e documentos, mantendo o cadastro (Perfil > Segurança)', 'active', 90),
  ('account_deletion', 'Exclusão de Conta', 'Usuário exclui a conta por completo, incluindo o login (Perfil > Segurança)', 'active', 91)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_feature_enabled(_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT status = 'active' FROM public.platform_modules WHERE key = _key),
    false
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_feature_enabled(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;
  IF NOT public.is_feature_enabled('account_reset') THEN
    RAISE EXCEPTION 'Esta função está temporariamente indisponível. Fale com o suporte.';
  END IF;

  -- Apaga todas as motos do usuário — a cascata do banco cuida de tudo
  -- que depende delas (eventos, documentos, manutenções, certificados,
  -- transferências, recibos, etc.).
  DELETE FROM public.motorcycles WHERE owner_id = uid;

  -- Preferências pessoais não ligadas a nenhuma moto específica.
  DELETE FROM public.workshop_favorites WHERE user_id = uid;

  -- Volta a tela inicial e o menu ao padrão de fábrica.
  UPDATE public.profiles
     SET home_shortcuts = NULL,
         bottom_nav_items = NULL
   WHERE id = uid;
END;
$$;
GRANT EXECUTE ON FUNCTION public.reset_own_account() TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;
  IF NOT public.is_feature_enabled('account_deletion') THEN
    RAISE EXCEPTION 'Esta função está temporariamente indisponível. Fale com o suporte.';
  END IF;

  -- Apaga o login por completo. profiles, motorcycles e tudo que depende
  -- deles já está configurado com ON DELETE CASCADE a partir daqui.
  DELETE FROM auth.users WHERE id = uid;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
