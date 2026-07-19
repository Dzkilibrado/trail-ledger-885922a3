-- Fase 1: corrigir permission denied for function validate_cpf
-- A tabela profiles possui CHECK constraint profiles_cpf_valid que chama
-- public.validate_cpf(cpf). Como EXECUTE foi revogado de authenticated,
-- qualquer UPDATE em profiles (mesmo em campos não relacionados ao CPF)
-- reavalia o CHECK e falha com permission denied.
-- validate_cpf é uma função IMMUTABLE pura (apenas cálculo de dígitos
-- verificadores) — não acessa tabelas nem dados sensíveis. Restaurar o
-- GRANT EXECUTE para authenticated é seguro.

GRANT EXECUTE ON FUNCTION public.validate_cpf(text) TO authenticated;