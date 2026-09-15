-- ============================================================
-- user_item_library — Biblioteca pessoal de itens do usuário
-- Meus Itens: peças, produtos e serviços reutilizáveis
--
-- Decisões de design:
--   - Soft delete via deleted_at (exclusão física não exposta ao usuário)
--   - RLS por auth.uid() — isolamento absoluto entre usuários
--   - updated_at gerenciado por touch_updated_at() existente
--   - Snapshot em maintenance_items é independente (sem FK para cá)
--   - Sem UNIQUE por description: usuário pode ter itens semelhantes legítimos
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_item_library (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT        NOT NULL CHECK (char_length(trim(description)) >= 1),
  category    public.maintenance_category NOT NULL DEFAULT 'other',
  item_kind   public.item_kind            NOT NULL DEFAULT 'technical',
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_item_library IS
  'Biblioteca pessoal e privada de itens de manutenção por usuário.
   Cada registro pertence a um único usuário (user_id = auth.uid()).
   deleted_at != NULL = soft-deleted: invisível na UI, preservado para auditoria.
   Ao usar um item em uma manutenção, os dados são copiados para maintenance_items
   (snapshot independente). Editar/excluir da biblioteca não altera histórico.';

-- Trigger updated_at (reutiliza função existente)
CREATE TRIGGER uil_touch
  BEFORE UPDATE ON public.user_item_library
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Índice principal: listagem rápida por usuário, itens ativos
CREATE INDEX idx_uil_user_active
  ON public.user_item_library(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Índice de busca por descrição (case-insensitive)
CREATE INDEX idx_uil_description
  ON public.user_item_library USING gin(to_tsvector('portuguese', description));

-- Permissões
GRANT SELECT, INSERT, UPDATE ON public.user_item_library TO authenticated;
GRANT ALL ON public.user_item_library TO service_role;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_item_library ENABLE ROW LEVEL SECURITY;

-- SELECT: apenas registros ativos do próprio usuário
CREATE POLICY "uil_select" ON public.user_item_library
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- INSERT: user_id deve ser o próprio usuário autenticado
CREATE POLICY "uil_insert" ON public.user_item_library
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: somente registros ativos do próprio usuário,
--         e não permite trocar user_id (WITH CHECK garante isso)
CREATE POLICY "uil_update" ON public.user_item_library
  FOR UPDATE TO authenticated
  USING  (user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid());

-- DELETE físico: bloqueado para usuário normal (soft delete via UPDATE deleted_at)
-- Sem CREATE POLICY de DELETE — logo, DELETE retorna RLS violation para authenticated.

-- ── Módulos de plataforma ─────────────────────────────────────────────────────

-- Novo módulo: Meus Itens
INSERT INTO public.platform_modules (key, label, description, status, sort_order)
VALUES (
  'manut_meus_itens',
  'Meus Itens',
  'Biblioteca pessoal de peças, produtos e serviços cadastrados pelo usuário para reutilização em manutenções futuras.',
  'active',
  58
)
ON CONFLICT (key) DO NOTHING;

-- Pausar "Ler Documento" — código preservado, apenas inacessível via módulo
UPDATE public.platform_modules
  SET status = 'disabled', updated_at = now()
  WHERE key = 'manut_ocr';

NOTIFY pgrst, 'reload schema';
