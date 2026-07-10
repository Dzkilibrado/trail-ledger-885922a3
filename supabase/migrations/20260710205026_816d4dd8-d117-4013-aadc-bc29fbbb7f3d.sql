
CREATE OR REPLACE FUNCTION public.align_smart_receipt_code_seq()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_num bigint;
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: apenas admins podem alinhar smart_receipt_code_seq';
  END IF;

  SELECT COALESCE(MAX((regexp_match(code, 'TB-RCV-\d{4}-(\d+)$'))[1]::bigint), 0)
    INTO max_num
    FROM public.smart_receipts
    WHERE code ~ '^TB-RCV-\d{4}-\d+$';

  PERFORM setval('public.smart_receipt_code_seq', GREATEST(max_num, 1), max_num > 0);
  RETURN max_num;
END;
$$;

REVOKE ALL ON FUNCTION public.align_smart_receipt_code_seq() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.align_smart_receipt_code_seq() TO authenticated, service_role;
