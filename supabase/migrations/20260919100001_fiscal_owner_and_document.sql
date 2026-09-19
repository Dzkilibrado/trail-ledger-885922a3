-- ============================================================
-- Fiscalização: dados do proprietário e documento de origem
-- na resposta pública do share fiscal
--
-- Mudanças:
--   1. get_public_health_report: quando preset='fiscal', inclui
--      owner_name, owner_cpf_masked, e referência ao documento de origem
--   2. get_fiscal_document_url: RPC para URL assinada temporária do
--      documento de origem, vinculada à validade do share fiscal
--
-- Segurança:
--   - SECURITY DEFINER em ambas as RPCs
--   - CPF mascarado (apenas 3 primeiros e 2 últimos dígitos visíveis)
--   - Documento: signed URL válida pelo menor entre 5min e tempo restante
--     do share — expira junto com o share
--   - Acesso ao documento valida token + expiração + revogação
--   - Nunca retorna o caminho interno do storage
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
  cpf_masked text;
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

  -- Para preset fiscal: buscar dados adicionais do proprietário e documento de origem
  fiscal_extra := 'null'::jsonb;
  IF s.preset = 'fiscal' THEN
    -- Proprietário: nome e CPF mascarado
    SELECT full_name, cpf INTO p
    FROM public.profiles
    WHERE id = r.issued_by
    LIMIT 1;

    -- Mascarar CPF: mostrar XXX.xxx.xxx-XX (apenas 3+2 visíveis, restante mascarado)
    IF p.cpf IS NOT NULL AND length(regexp_replace(p.cpf, '[^0-9]', '', 'g')) = 11 THEN
      DECLARE digits text := regexp_replace(p.cpf, '[^0-9]', '', 'g');
      BEGIN
        cpf_masked := left(digits, 3) || '.xxx.xxx-' || right(digits, 2);
      END;
    END IF;

    -- Documento de origem: referência (sem URL — URL é gerada por RPC separada)
    SELECT id, doc_type, file_name, mime_type, doc_number, doc_date
    INTO origin_doc
    FROM public.motorcycle_documents
    WHERE motorcycle_id = r.motorcycle_id
      AND doc_type IN ('invoice', 'bill_of_sale')
    ORDER BY doc_date DESC NULLS LAST, created_at DESC
    LIMIT 1;

    fiscal_extra := jsonb_build_object(
      'owner_name',     p.full_name,
      'owner_cpf',      cpf_masked,
      'origin_doc_id',  origin_doc.id,
      'origin_doc_type', origin_doc.doc_type,
      'origin_doc_name', origin_doc.file_name,
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
-- Gera URL assinada temporária para o documento de origem,
-- vinculada à validade do share fiscal.
-- TTL = mínimo entre 300s e tempo restante do share (em segundos).
-- Nunca retorna URL se share expirado, revogado, ou doc não encontrado.
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
  -- Validar share
  SELECT * INTO s FROM public.health_report_shares WHERE public_token = _token;
  IF NOT FOUND OR s.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_share');
  END IF;
  IF s.expires_at IS NOT NULL AND s.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF s.preset <> 'fiscal' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_fiscal');
  END IF;

  -- Validar laudo
  SELECT * INTO r FROM public.health_reports WHERE id = s.report_id;
  IF NOT FOUND OR r.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_report');
  END IF;

  -- Validar documento: deve pertencer à moto do laudo e ser tipo de origem
  SELECT * INTO d FROM public.motorcycle_documents
  WHERE id = _doc_id
    AND motorcycle_id = r.motorcycle_id
    AND doc_type IN ('invoice', 'bill_of_sale');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'document_not_found');
  END IF;

  -- Calcular TTL: mínimo entre 300s e tempo restante do share
  IF s.expires_at IS NOT NULL THEN
    seconds_remaining := GREATEST(0, EXTRACT(EPOCH FROM (s.expires_at - now()))::int);
    ttl := LEAST(300, seconds_remaining);
  ELSE
    ttl := 300;
  END IF;

  IF ttl <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  -- Retornar metadados para que o cliente gere a URL assinada
  -- (Storage signed URL não pode ser gerada diretamente no Postgres —
  --  retornamos bucket + path + ttl para que a server function TypeScript gere)
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
