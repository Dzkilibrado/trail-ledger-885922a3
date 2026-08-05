-- =========================================================================
-- Correção: itens de ação "replace" (troca) tiveram seus intervalos
-- gravados nas colunas interval_hours/interval_km/interval_days em vez de
-- replace_hours/replace_km/replace_days. O motor de propostas
-- (proposeSchedules, em src/lib/plan-templates.ts) só lê replace_* para
-- ações de troca — então itens como "Óleo do motor", "Vela", "Óleo do
-- garfo dianteiro", "Óleo do amortecedor traseiro", "Fluido de freio",
-- "Líquido de arrefecimento", "Filtro de óleo" e os pneus nunca tinham
-- intervalo de fato, mesmo aparecendo "Saudável · Em dia" na tela —
-- por isso nunca mostravam "X h restantes" e nunca ficavam vencidos.
-- =========================================================================

-- 1) Corrige o catálogo (template padrão): move o valor para a coluna certa.
UPDATE public.maintenance_plan_items
   SET replace_hours = interval_hours, interval_hours = NULL
 WHERE action = 'replace' AND replace_hours IS NULL AND interval_hours IS NOT NULL;

UPDATE public.maintenance_plan_items
   SET replace_km = interval_km, interval_km = NULL
 WHERE action = 'replace' AND replace_km IS NULL AND interval_km IS NOT NULL;

UPDATE public.maintenance_plan_items
   SET replace_days = interval_days, interval_days = NULL
 WHERE action = 'replace' AND replace_days IS NULL AND interval_days IS NOT NULL;

-- 2) Conserta retroativamente as motos já cadastradas: todo schedule
--    vinculado (template_item_id) que ficou totalmente sem intervalo
--    (o sintoma exato do bug) recebe agora o valor correto do catálogo,
--    já com o multiplicador do perfil de uso da moto aplicado — mesma
--    regra usada na criação de uma moto nova (USE_PROFILE_MULTIPLIER em
--    src/lib/plan-templates.ts).
WITH profile_multiplier AS (
  SELECT id AS motorcycle_id,
         CASE use_profile
           WHEN 'light'      THEN 1.5
           WHEN 'normal'     THEN 1.0
           WHEN 'severe'     THEN 0.7
           WHEN 'motocross'  THEN 0.6
           WHEN 'competition' THEN 0.5
           WHEN 'sand_mud'   THEN 0.6
           WHEN 'other'      THEN 1.0
           ELSE 1.0
         END AS mul
    FROM public.motorcycles
)
UPDATE public.maintenance_schedules s
   SET interval_hours = CASE WHEN pi.replace_hours IS NOT NULL THEN GREATEST(1, ROUND(pi.replace_hours * pm.mul)) END,
       interval_km    = CASE WHEN pi.replace_km    IS NOT NULL THEN GREATEST(1, ROUND(pi.replace_km * pm.mul)) END,
       interval_days  = CASE WHEN pi.replace_days   IS NOT NULL THEN GREATEST(1, ROUND(pi.replace_days * pm.mul)) END
  FROM public.maintenance_plan_items pi, profile_multiplier pm
 WHERE s.template_item_id = pi.id
   AND s.motorcycle_id = pm.motorcycle_id
   AND pi.action = 'replace'
   AND s.interval_hours IS NULL AND s.interval_km IS NULL AND s.interval_days IS NULL
   AND (pi.replace_hours IS NOT NULL OR pi.replace_km IS NOT NULL OR pi.replace_days IS NOT NULL);

-- Observação: usamos CASE explícito (não GREATEST direto) porque no
-- Postgres GREATEST(1, NULL) retorna 1 em vez de NULL — isso inventaria
-- um intervalo de 1 km/h/dia para eixos que o catálogo nem define.
