-- Correção 01 / Fase A: proposta NÃO APLICADA ao banco compartilhado.
-- Só funções/permissões; nenhuma mutação de laudos, snapshots, hashes ou shares.
BEGIN;
-- Redact only the public copy; fiscal identity is deliberately returned separately.
CREATE OR REPLACE FUNCTION public.health_public_redact(value jsonb, identities text[])
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public AS $$
DECLARE result jsonb; k text; v jsonb; txt text; remaining text; cleaned text; identity text; position int;
BEGIN
  IF jsonb_typeof(value) = 'object' THEN
    result := '{}'::jsonb;
    FOR k,v IN SELECT * FROM jsonb_each(value) LOOP
      result := result || jsonb_build_object(k, public.health_public_redact(v, identities));
    END LOOP;
    RETURN result;
  ELSIF jsonb_typeof(value) = 'array' THEN
    result := '[]'::jsonb;
    FOR v IN SELECT * FROM jsonb_array_elements(value) LOOP
      result := result || jsonb_build_array(public.health_public_redact(v, identities));
    END LOOP;
    RETURN result;
  ELSIF jsonb_typeof(value) <> 'string' THEN RETURN value;
  END IF;
  txt := value #>> '{}';
  FOREACH identity IN ARRAY coalesce(identities, ARRAY[]::text[]) LOOP
    identity := btrim(identity);
    IF identity IS NULL OR length(identity) < 3 THEN CONTINUE; END IF;
    remaining := txt; cleaned := '';
    LOOP
      position := strpos(lower(remaining),lower(identity));
      EXIT WHEN position = 0;
      cleaned := cleaned || substr(remaining,1,position-1) || '[identificação protegida]';
      remaining := substr(remaining,position+length(identity));
    END LOOP;
    txt := cleaned || remaining;
  END LOOP;
  txt := regexp_replace(txt, '\m[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2}\M', '[CPF protegido]', 'g');
  txt := regexp_replace(txt, '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}', '[contato protegido]', 'gi');
  txt := regexp_replace(txt, '\(?[0-9]{2}\)?[ .-]+[0-9]{4,5}[ .-]+[0-9]{4}\M', '[contato protegido]', 'g');
  RETURN to_jsonb(txt);
END $$;
CREATE OR REPLACE FUNCTION public.health_public_project(value jsonb, policy jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public AS $$
DECLARE result jsonb; k text; v jsonb; projected jsonb;
BEGIN
  IF jsonb_typeof(policy) = 'object' THEN
    IF jsonb_typeof(value) <> 'object' THEN RETURN NULL; END IF;
    result := '{}'::jsonb;
    FOR k,v IN SELECT * FROM jsonb_each(policy) LOOP
      IF value ? k THEN
        projected := public.health_public_project(value->k, v);
        IF projected IS NOT NULL THEN result := result || jsonb_build_object(k, projected); END IF;
      END IF;
    END LOOP;
    RETURN result;
  ELSIF jsonb_typeof(policy) = 'array' THEN
    IF jsonb_typeof(value) <> 'array' THEN RETURN '[]'::jsonb; END IF;
    result := '[]'::jsonb;
    FOR v IN SELECT * FROM jsonb_array_elements(value) LOOP
      projected := public.health_public_project(v, policy->0);
      IF projected IS NOT NULL THEN result := result || jsonb_build_array(projected); END IF;
    END LOOP;
    RETURN result;
  END IF;
  IF value = 'null'::jsonb THEN RETURN value; END IF;
  IF jsonb_typeof(value) = policy #>> '{}' THEN RETURN value; END IF;
  RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.health_public_snapshot(payload jsonb, allowed text[])
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public AS $fn$
DECLARE policy jsonb := $policy${
  "issuedAt": "string",
  "timezone": "string",
  "formatVersion": "string",
  "disclaimer": "string",
  "validity": {
    "validUntil": "string",
    "hoursLimit": "number",
    "kmLimit": "number",
    "reason": "string",
    "label": "string"
  },
  "motorcycle": {
    "trailbookId": "string",
    "brand": "string",
    "model": "string",
    "plate": "string",
    "chassisMasked": "string",
    "controlType": "string",
    "condition": "string",
    "yearMake": "number",
    "yearModel": "number",
    "displacement": "number",
    "hoursTotal": "number",
    "kmTotal": "number"
  },
  "overall": {
    "status": "string",
    "statusLabel": "string",
    "headline": "string"
  },
  "rideAnswer": {
    "status": "string",
    "title": "string",
    "message": "string",
    "rationale": "string",
    "disclaimer": "string",
    "counts": {
      "critical": "number",
      "attention": "number",
      "ok": "number",
      "unknown": "number",
      "total": "number"
    }
  },
  "nextMaintenance": {
    "name": "string",
    "remainingLabel": "string",
    "status": "string"
  },
  "components": [
    {
      "name": "string",
      "category": "string",
      "categoryLabel": "string",
      "status": "string",
      "statusLabel": "string",
      "severity": "string",
      "conclusion": "string",
      "trend": "string",
      "trendLabel": "string",
      "lifeRemainingLabel": "string",
      "nextAction": "string",
      "dueEstimateLabel": "string",
      "confidenceLevel": "string",
      "confidenceLabel": "string",
      "remainingLabel": "string",
      "reasons": [
        "string"
      ],
      "missingData": [
        "string"
      ],
      "lifeRemainingPct": "number",
      "hasConflict": "boolean",
      "isSafetyItem": "boolean"
    }
  ],
  "recommendations": [
    {
      "group": "string",
      "groupLabel": "string",
      "title": "string",
      "recommendation": "string",
      "status": "string",
      "lifecycle": "string",
      "dueEstimateLabel": "string",
      "isSafetyItem": "boolean"
    }
  ],
  "history": {
    "lastMaintenances": [
      {
        "date": "string",
        "type": "string"
      }
    ],
    "lastInspections": [
      {
        "date": "string",
        "decision": "string"
      }
    ],
    "incidents": [
      {
        "date": "string"
      }
    ],
    "totalEvents": "number"
  },
  "indices": {
    "conservationExplanation": "string",
    "confidenceLevel": "string",
    "confidenceLabel": "string",
    "confidenceExplanation": "string",
    "conservation": "number"
  },
  "reservations": [
    "string"
  ],
  "conflicts": [
    "string"
  ],
  "missingData": [
    "string"
  ]
}
$policy$::jsonb;
  selected jsonb; section text; k text;
BEGIN
  selected := jsonb_build_object('issuedAt',policy->'issuedAt','timezone',policy->'timezone',
    'formatVersion',policy->'formatVersion','disclaimer',policy->'disclaimer','validity',policy->'validity');
  FOREACH section IN ARRAY coalesce(allowed, ARRAY[]::text[]) LOOP
    FOR k IN SELECT unnest(CASE section
      WHEN 'identification' THEN ARRAY['motorcycle'] WHEN 'summary' THEN ARRAY['overall','rideAnswer','nextMaintenance']
      WHEN 'components' THEN ARRAY['components'] WHEN 'action_plan' THEN ARRAY['recommendations']
      WHEN 'history' THEN ARRAY['history'] WHEN 'indices' THEN ARRAY['indices']
      WHEN 'reservations' THEN ARRAY['reservations','conflicts','missingData'] ELSE ARRAY[]::text[] END) LOOP
      selected := selected || jsonb_build_object(k,policy->k);
    END LOOP;
  END LOOP;
  RETURN public.health_public_redact(public.health_public_project(payload,selected),
    ARRAY[payload#>>'{owner,name}', payload#>>'{issuedBy,name}']);
END $fn$;
CREATE OR REPLACE FUNCTION public.get_public_health_report(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  s record;
  r record;
  snap jsonb;
  p record;
  origin_doc record;
  cpf_formatted text;
  fiscal_extra jsonb;
  effective_sections text[];
  identities text[];
BEGIN
  IF _token IS NULL OR btrim(_token) = '' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  SELECT * INTO s FROM public.health_report_shares WHERE public_token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF s.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'revoked');
  END IF;
  IF s.expires_at IS NOT NULL AND s.expires_at <= now() THEN
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

  IF snap IS NULL OR jsonb_typeof(snap) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'snapshot_missing');
  END IF;
  SELECT coalesce(array_agg(x ORDER BY x), ARRAY[]::text[]) INTO effective_sections
  FROM (SELECT DISTINCT unnest(s.allowed_sections) x) a
  WHERE x = ANY(ARRAY['identification','summary','components','action_plan','history','indices','reservations'])
    AND (s.preset <> 'fiscal' OR x = ANY(ARRAY['identification','summary']));
  SELECT array_agg(full_name) INTO identities FROM public.profiles WHERE id IN (r.owner_id, r.issued_by);
  snap := public.health_public_redact(public.health_public_snapshot(snap, effective_sections), identities);

  -- Para preset fiscal: dados adicionais do proprietario e documento de origem
  fiscal_extra := NULL;
  IF s.preset = 'fiscal' AND 'identification' = ANY(effective_sections) THEN
    -- Proprietario: nome e CPF completo formatado (000.000.000-00)
    SELECT full_name, cpf INTO p
    FROM public.profiles
    WHERE id = r.owner_id
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
    ORDER BY doc_date DESC NULLS LAST, created_at DESC, id DESC
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
    'sha256', r.snapshot_sha256,
    'format_version', r.format_version,
    'allowed_sections', effective_sections,
    'preset', s.preset,
    'share_expires_at', s.expires_at,
    'fiscal', fiscal_extra,
    'snapshot', snap
  );
END $$;

CREATE OR REPLACE FUNCTION public.get_fiscal_document_url(
  _token text,
  _doc_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
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
  IF s.expires_at IS NOT NULL AND s.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF s.preset <> 'fiscal' OR NOT coalesce('identification' = ANY(s.allowed_sections), false) THEN
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
  -- Exactly the origin document displayed by get_public_health_report, not any sibling invoice.
  SELECT * INTO d FROM public.motorcycle_documents
  WHERE motorcycle_id = r.motorcycle_id
    AND doc_type IN ('invoice', 'bill_of_sale')
  ORDER BY doc_date DESC NULLS LAST, created_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND OR d.id IS DISTINCT FROM _doc_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'document_not_found');
  END IF;

  -- Calcular TTL: minimo entre 300s e tempo restante do share
  IF s.expires_at IS NOT NULL THEN
    seconds_remaining := GREATEST(0, floor(EXTRACT(EPOCH FROM (s.expires_at - now())))::int);
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


-- Alternate public validation exposes only metadata, not free-text reasons.
CREATE OR REPLACE FUNCTION public.validate_health_report(_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE r record;
BEGIN
  SELECT code,status,issued_at,valid_until,snapshot_sha256,format_version,outdated_at,revoked_at
  INTO r FROM public.health_reports WHERE code = _code;
  IF NOT FOUND THEN RETURN jsonb_build_object('exists',false); END IF;
  RETURN jsonb_build_object('exists',true,'code',r.code,'status',r.status,'issued_at',r.issued_at,
    'valid_until',r.valid_until,'sha256',r.snapshot_sha256,'format_version',r.format_version,
    'outdated_at',r.outdated_at,'revoked',r.revoked_at IS NOT NULL);
END $$;

REVOKE ALL ON FUNCTION public.health_public_project(jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.health_public_redact(jsonb,text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.health_public_snapshot(jsonb,text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_health_report(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_health_report(text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_fiscal_document_url(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_fiscal_document_url(text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.validate_health_report(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_health_report(text) TO anon, authenticated, service_role;
COMMIT;
