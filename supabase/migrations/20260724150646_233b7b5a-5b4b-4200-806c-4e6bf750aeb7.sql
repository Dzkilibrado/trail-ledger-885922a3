
-- BUG 1: Geração 100% atômica do código do Recibo Inteligente.
-- Motivo: a trigger anterior aceitava `code` vindo do cliente e a função
-- `align_smart_receipt_code_seq` podia RETROCEDER a sequência para o MAX
-- atual, gerando colisão com nextvals já consumidos por transações em curso
-- ou por códigos legados fora do padrão. Agora:
--   1) trigger IGNORA qualquer `code` enviado pelo cliente (sempre reescreve);
--   2) usa nextval (atômico e monotônico) para serializar concorrência;
--   3) verifica EXISTS como safety-net — se colidir com histórico, avança
--      nextval até achar livre, sem lançar 23505 na aplicação;
--   4) align_* só pode AVANÇAR a sequência, nunca retroceder.

CREATE OR REPLACE FUNCTION public.generate_smart_receipt_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    candidate := 'TB-RCV-' || to_char(now(),'YYYY') || '-'
                 || lpad(nextval('public.smart_receipt_code_seq')::text, 6, '0');
    -- nextval é atômico entre transações concorrentes; o EXISTS abaixo é
    -- apenas defesa contra códigos históricos fora da sequência.
    IF NOT EXISTS (SELECT 1 FROM public.smart_receipts WHERE code = candidate) THEN
      NEW.code := candidate;
      RETURN NEW;
    END IF;
    attempts := attempts + 1;
    IF attempts > 1000 THEN
      RAISE EXCEPTION 'Não foi possível gerar código único para smart_receipts após % tentativas', attempts;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.align_smart_receipt_code_seq()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_num bigint;
  cur_val bigint;
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: apenas admins podem alinhar smart_receipt_code_seq';
  END IF;

  SELECT COALESCE(MAX((regexp_match(code, 'TB-RCV-\d{4}-(\d+)$'))[1]::bigint), 0)
    INTO max_num
    FROM public.smart_receipts
    WHERE code ~ '^TB-RCV-\d{4}-\d+$';

  SELECT last_value INTO cur_val FROM public.smart_receipt_code_seq;

  -- Só avança. Nunca retrocede — retrocesso é a causa raiz da duplicidade.
  IF max_num > cur_val THEN
    PERFORM setval('public.smart_receipt_code_seq', max_num, true);
  END IF;

  RETURN GREATEST(max_num, cur_val);
END;
$$;

-- Garante alinhamento imediato para o estado atual.
SELECT setval(
  'public.smart_receipt_code_seq',
  GREATEST(
    (SELECT last_value FROM public.smart_receipt_code_seq),
    (SELECT COALESCE(MAX((regexp_match(code, 'TB-RCV-\d{4}-(\d+)$'))[1]::bigint), 0)
       FROM public.smart_receipts WHERE code ~ '^TB-RCV-\d{4}-\d+$')
  ),
  true
);
