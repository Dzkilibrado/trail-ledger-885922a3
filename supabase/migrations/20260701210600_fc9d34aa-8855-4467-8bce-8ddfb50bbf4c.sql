
-- Central de Documentos: versionamento, lixeira 30d, hash, tamanho
ALTER TABLE public.motorcycle_documents
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.motorcycle_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID,
  ADD COLUMN IF NOT EXISTS sha256 TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT;

CREATE INDEX IF NOT EXISTS idx_mdocs_moto_current ON public.motorcycle_documents(motorcycle_id) WHERE is_current AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mdocs_parent ON public.motorcycle_documents(parent_id);
CREATE INDEX IF NOT EXISTS idx_mdocs_deleted ON public.motorcycle_documents(deleted_at) WHERE deleted_at IS NOT NULL;

-- Admin pode ler todos os documentos (para painel administrativo)
DROP POLICY IF EXISTS docs_select_admin ON public.motorcycle_documents;
CREATE POLICY docs_select_admin ON public.motorcycle_documents
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
