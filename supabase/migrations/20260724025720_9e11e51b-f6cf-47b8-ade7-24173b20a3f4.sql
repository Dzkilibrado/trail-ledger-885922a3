CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_normalized_unique
ON public.profiles ((regexp_replace(cpf, '\D', '', 'g')))
WHERE cpf IS NOT NULL;