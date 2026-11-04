-- ============================================================
-- PROPOSTA — NÃO APLICAR DIRETAMENTE
-- Aplicar via Lovable com autorização explícita de DZK.
--
-- Ajuste da migration 20261104_motorcycle_document_shares.sql:
-- Remove o DEFAULT do token (que dependia de encode/gen_random_bytes
-- e pode falhar se pgcrypto não estiver ativo). O token agora é
-- gerado na aplicação (Node crypto.randomBytes) e passado no INSERT.
-- ============================================================

-- Remove o DEFAULT da coluna token (mantém NOT NULL UNIQUE)
ALTER TABLE public.motorcycle_document_shares
  ALTER COLUMN token DROP DEFAULT;

-- Garante que a extensão pgcrypto NÃO é pré-requisito para inserts.
-- (Se algum insert antigo usou o default e teve erro, nenhum dado a corrigir
--  pois a tabela era nova e nenhum insert teve sucesso antes desta correção.)
