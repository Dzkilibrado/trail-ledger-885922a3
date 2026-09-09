-- =============================================================
-- Fix: health_report_snapshots — permitir DELETE em cascade
-- =============================================================
-- PROBLEMA: o trigger health_snapshots_no_update bloqueava
-- QUALQUER DELETE na tabela, inclusive os originados por cascade
-- da exclusão total da motocicleta (DELETE FROM motorcycles).
--
-- CORREÇÃO: a função distingue o contexto de execução usando
-- pg_trigger_depth(). Depth > 0 significa que o trigger está
-- sendo executado dentro de outro trigger/cascade — ou seja,
-- é uma exclusão total legítima, não uma tentativa isolada de
-- apagar uma evidência.
--
-- COMPORTAMENTO APÓS:
--   DELETE direto em health_report_snapshots → BLOQUEADO (imutável)
--   DELETE por cascade de health_reports     → BLOQUEADO (imutável)
--   DELETE por cascade de motorcycles        → PERMITIDO (exclusão total)
--
-- A proteção contra alteração/exclusão isolada permanece intacta.
-- Laudos emitidos continuam sendo evidências imutáveis.
-- =============================================================

CREATE OR REPLACE FUNCTION public.health_snapshots_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- pg_trigger_depth() = 0: trigger disparado diretamente (DELETE isolado)
  -- pg_trigger_depth() > 0: trigger disparado dentro de outro trigger/cascade
  --
  -- A exclusão total da moto (DELETE FROM motorcycles) gera:
  --   depth=0 no trigger de motorcycles (se houver)
  --   depth=1 no trigger de health_reports (cascade de motorcycles)
  --   depth=2 aqui, como cascade de health_reports
  --
  -- Um DELETE direto em health_report_snapshots geraria depth=0.
  -- Um DELETE em health_reports geraria depth=1 aqui.
  --
  -- Permitimos apenas quando depth >= 2 (cascade de dois níveis),
  -- que é a única forma legítima de chegar aqui sem intenção de
  -- falsificar a evidência.

  IF TG_OP = 'DELETE' AND pg_trigger_depth() >= 2 THEN
    -- Cascade de motorcycles → health_reports → health_report_snapshots
    -- Exclusão total e explícita da motocicleta — permitido
    RETURN OLD;
  END IF;

  -- Qualquer outro contexto: UPDATE, DELETE direto, DELETE de health_reports
  -- Proteção de evidência — mantida
  RAISE EXCEPTION 'A fotografia do laudo é imutável';
END $$;

-- O trigger existente (health_snapshots_no_update) continua ativo.
-- Apenas a função que ele chama foi atualizada — sem recriar o trigger.
