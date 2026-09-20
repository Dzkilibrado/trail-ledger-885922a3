-- ============================================================
-- Fiscalizacao: dados do proprietario e documento de origem
-- na resposta publica do share fiscal
--
-- Mudancas:
--   1. get_public_health_report: quando preset='fiscal', inclui
--      owner_name, owner_cpf (COMPLETO formatado 000.000.000-00),
--      e referencia ao documento de origem (invoice ou bill_of_sale)
--   2. get_fiscal_document_url: RPC para metadados do documento de origem
--      vinculada a validade do share fiscal (server function gera signed URL)
--
-- Seguranca:
--   - SECURITY DEFINER em ambas as RPCs
--   - CPF COMPLETO formatado: apenas no preset fiscal, token valido,
--     share nao expirado/revogado, laudo valido
--   - CPF NAO esta no snapshot imutavel do Laudo
--   - CPF NAO e exposto em buyer/workshop/custom
--   - Documento: metadados retornados para server function gerar signed URL
--     com TTL = min(300s, tempo restante do share)
--   - Signed URL tem TTL proprio: se revogado, URLs ja emitidas continuam
--     validas ate seu TTL (max 300s / 5 minutos apos emissao)
--   - Mitigar janela residual: TTL curto (min(300s, tempo_restante))
-- ============================================================

-- ── 1. Atualizar get_public_health_report ────────────────────
CREATE OR REPLACE FUNCTION public.get_public_health_report(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  r record;
  snap jsonb;
  p record;
  origin_doc record;
  cpf_formatted text;
  fiscal_extra jsonb;
BEGIN
  SELECT * INTO s FROM public.health_report_shares WHERE public_token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF s.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'revoked');
  END IF;
  IF s.expires_at IS NOT NULL AND s.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  SELECT * INTO r FROM public.health_reports WHERE id = s.report_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF r.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'report_revoked',
      'code', r.code, 'revoked_at', r.revoked_at);
  END IF;

  SELECT payload INTO snap FROM public.health_report_snapshots WHERE report_id = r.id;

  -- Para preset fiscal: dados adicionais do proprietario e documento de origem
  fiscal_extra := NULL;
  IF s.preset = 'fiscal' THEN
    -- Proprietario: nome e CPF completo formatado (000.000.000-00)
    SELECT full_name, cpf INTO p
    FROM public.profiles
    WHERE id = r.issued_by
    LIMIT 1;

    -- CPF armazenado como digitos puros — formatar para exibicao
    cpf_formatted := NULL;
    IF p.cpf IS NOT NULL THEN
      DECLARE digits text := regexp_replace(p.cpf, '[^0-9]', '', 'g');
      BEGIN
        IF length(digits) = 11 THEN
          cpf_formatted := substring(digits, 1, 3) || '.' ||
                           substring(digits, 4, 3) || '.' ||
                           substring(digits, 7, 3) || '-' ||
                           substring(digits, 10, 2);
        END IF;
      END;
    END IF;

    -- Documento de origem: invoice ou bill_of_sale mais recente da moto
    -- Retorna apenas metadados (sem URL — URL e gerada por RPC separada)
    SELECT id, doc_type, file_name, mime_type, doc_number, doc_date
    INTO origin_doc
    FROM public.motorcycle_documents
    WHERE motorcycle_id = r.motorcycle_id
      AND doc_type IN ('invoice', 'bill_of_sale')
    ORDER BY doc_date DESC NULLS LAST, created_at DESC
    LIMIT 1;

    fiscal_extra := jsonb_build_object(
      'owner_name',        p.full_name,
      'owner_cpf',         cpf_formatted,
      'origin_doc_id',     origin_doc.id,
      'origin_doc_type',   origin_doc.doc_type,
      'origin_doc_name',   origin_doc.file_name,
      'origin_doc_mime',   origin_doc.mime_type,
      'origin_doc_number', origin_doc.doc_number
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'code', r.code,
    'status', r.status,
    'issued_at', r.issued_at,
    'valid_until', r.valid_until,
    'valid_hours_limit', r.valid_hours_limit,
    'valid_km_limit', r.valid_km_limit,
    'outdated_at', r.outdated_at,
    'outdated_reason', r.outdated_reason,
    'sha256', r.snapshot_sha256,
    'format_version', r.format_version,
    'allowed_sections', s.allowed_sections,
    'preset', s.preset,
    'share_id', s.id,
    'share_expires_at', s.expires_at,
    'fiscal', fiscal_extra,
    'snapshot', snap
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_public_health_report(text) TO anon, authenticated;

-- ── 2. Nova RPC: get_fiscal_document_url ─────────────────────
-- Valida share fiscal e retorna metadados para que a server function
-- TypeScript gere a signed URL com TTL limitado.
-- TTL = minimo entre 300s e tempo restante do share.
-- Nao retorna URL diretamente: URL assinada e gerada pelo servidor TypeScript.
-- AVISO DE SEGURANÇA: signed URLs ja emitidas continuam validas ate seu
-- proprio TTL mesmo apos revogacao do share. O TTL curto (max 5 min)
-- limita a janela residual de acesso apos revogacao.
CREATE OR REPLACE FUNCTION public.get_fiscal_document_url(
  _token text,
  _doc_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  r record;
  d record;
  seconds_remaining int;
  ttl int;
BEGIN
  -- Validar share: deve existir, nao expirado, nao revogado, preset=fiscal
  SELECT * INTO s FROM public.health_report_shares WHERE public_token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF s.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'revoked');
  END IF;
  IF s.expires_at IS NOT NULL AND s.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF s.preset <> 'fiscal' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_fiscal');
  END IF;

  -- Validar laudo associado ao share
  SELECT * INTO r FROM public.health_reports WHERE id = s.report_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'report_not_found');
  END IF;
  IF r.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'report_revoked');
  END IF;

  -- Validar documento: deve pertencer a moto do laudo e ser tipo de origem
  SELECT * INTO d FROM public.motorcycle_documents
  WHERE id = _doc_id
    AND motorcycle_id = r.motorcycle_id
    AND doc_type IN ('invoice', 'bill_of_sale');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'document_not_found');
  END IF;

  -- Calcular TTL: minimo entre 300s e tempo restante do share
  IF s.expires_at IS NOT NULL THEN
    seconds_remaining := GREATEST(0, EXTRACT(EPOCH FROM (s.expires_at - now()))::int);
    ttl := LEAST(300, seconds_remaining);
  ELSE
    ttl := 300;
  END IF;

  IF ttl <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  -- Retornar metadados para o servidor TypeScript gerar signed URL
  RETURN jsonb_build_object(
    'ok', true,
    'bucket', d.bucket,
    'storage_path', d.storage_path,
    'file_name', d.file_name,
    'mime_type', d.mime_type,
    'ttl_seconds', ttl
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_fiscal_document_url(text, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
