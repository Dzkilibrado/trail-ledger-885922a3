-- ============================================================
-- PROPOSTA — NÃO APLICAR DIRETAMENTE
-- Aplicar via Lovable com autorização explícita de DZK.
-- ============================================================
--
-- Tabela: motorcycle_document_shares
-- Propósito: tokens de acesso público temporário ao cofre de
-- documentos de uma motocicleta, gerados na emissão de laudos
-- comerciais com QR Code habilitado.
--
-- Fluxo:
--   1. Usuário emite laudo Comercial com "Incluir QR Code de docs"
--   2. Server function insere uma linha nesta tabela
--   3. URL pública /d/<token> é embutida no QR Code do laudo
--   4. Visitante acessa /d/<token> sem login e vê os documentos
--   5. Token expira em expires_at (ou nunca, se NULL)
--   6. Proprietário pode revogar manualmente (revoked_at)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.motorcycle_document_shares (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Moto cujos documentos serão exibidos
  motorcycle_id  UUID NOT NULL
                   REFERENCES public.motorcycles(id) ON DELETE CASCADE,

  -- Laudo que originou este compartilhamento (opcional; para rastreabilidade)
  report_id      UUID
                   REFERENCES public.health_reports(id) ON DELETE SET NULL,

  -- Token aleatório que vai na URL pública
  token          TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),

  -- Criado por
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Expiração (NULL = sem expiração)
  expires_at     TIMESTAMPTZ,

  -- Revogação manual
  revoked_at     TIMESTAMPTZ,
  revoked_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Auditoria de acesso
  last_accessed_at TIMESTAMPTZ,
  access_count     INTEGER NOT NULL DEFAULT 0
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_mds_motorcycle ON public.motorcycle_document_shares(motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_mds_token      ON public.motorcycle_document_shares(token);
CREATE INDEX IF NOT EXISTS idx_mds_report     ON public.motorcycle_document_shares(report_id);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.motorcycle_document_shares ENABLE ROW LEVEL SECURITY;

-- Dono da moto pode ler seus próprios shares
CREATE POLICY "owner_select" ON public.motorcycle_document_shares
  FOR SELECT
  USING (
    motorcycle_id IN (
      SELECT id FROM public.motorcycles WHERE owner_id = auth.uid()
    )
  );

-- Dono da moto pode inserir shares para suas motos
CREATE POLICY "owner_insert" ON public.motorcycle_document_shares
  FOR INSERT
  WITH CHECK (
    motorcycle_id IN (
      SELECT id FROM public.motorcycles WHERE owner_id = auth.uid()
    )
  );

-- Dono da moto pode revogar (UPDATE apenas revoked_at / revoked_by)
CREATE POLICY "owner_revoke" ON public.motorcycle_document_shares
  FOR UPDATE
  USING (
    motorcycle_id IN (
      SELECT id FROM public.motorcycles WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    motorcycle_id IN (
      SELECT id FROM public.motorcycles WHERE owner_id = auth.uid()
    )
  );

-- ── Função pública de validação (sem auth) ───────────────────
-- Retorna os dados mínimos para a rota /d/:token sem expor storage paths.
-- A rota obtém signed URLs individualmente via service role no servidor.
CREATE OR REPLACE FUNCTION public.resolve_document_share(p_token TEXT)
RETURNS TABLE (
  share_id      UUID,
  motorcycle_id UUID,
  motorcycle_label TEXT,
  is_valid      BOOLEAN,
  invalid_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share  public.motorcycle_document_shares%ROWTYPE;
  v_moto   public.motorcycles%ROWTYPE;
BEGIN
  SELECT * INTO v_share
  FROM public.motorcycle_document_shares
  WHERE token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::UUID, NULL::UUID, NULL::TEXT,
      FALSE, 'Token não encontrado';
    RETURN;
  END IF;

  IF v_share.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT
      v_share.id, v_share.motorcycle_id, NULL::TEXT,
      FALSE, 'Acesso revogado pelo proprietário';
    RETURN;
  END IF;

  IF v_share.expires_at IS NOT NULL AND v_share.expires_at < now() THEN
    RETURN QUERY SELECT
      v_share.id, v_share.motorcycle_id, NULL::TEXT,
      FALSE, 'Acesso expirado';
    RETURN;
  END IF;

  SELECT * INTO v_moto FROM public.motorcycles WHERE id = v_share.motorcycle_id;

  -- Registra acesso
  UPDATE public.motorcycle_document_shares
  SET last_accessed_at = now(),
      access_count = access_count + 1
  WHERE id = v_share.id;

  RETURN QUERY SELECT
    v_share.id,
    v_share.motorcycle_id,
    COALESCE(v_moto.nickname, v_moto.brand || ' ' || v_moto.model),
    TRUE,
    NULL::TEXT;
END;
$$;

-- Acesso público à função (sem login)
GRANT EXECUTE ON FUNCTION public.resolve_document_share(TEXT) TO anon, authenticated;
