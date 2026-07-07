-- Fase 2 preamble: adicionar valor "not_informed" ao enum control_type.
-- Compatível com motos existentes (nenhuma linha é modificada).
ALTER TYPE public.control_type ADD VALUE IF NOT EXISTS 'not_informed';