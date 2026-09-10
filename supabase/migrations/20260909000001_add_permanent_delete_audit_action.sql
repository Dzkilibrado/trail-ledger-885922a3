-- Migration A — executar ANTES da Migration B.
-- ADD VALUE em enum é DDL autocommit; separado para garantir visibilidade
-- do novo valor na transação da Migration B.
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'permanent_delete';
