-- Adicionar share_expires_at ao payload de get_public_health_report
-- Permite exibir expiracao correta do share fiscal na tela publica
-- NAO altera schema -- apenas atualiza corpo da funcao existente
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
    'snapshot', snap
  );
END $$;

NOTIFY pgrst, 'reload schema';
