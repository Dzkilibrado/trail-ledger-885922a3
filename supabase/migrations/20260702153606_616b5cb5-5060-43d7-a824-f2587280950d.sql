-- Wave 2: expande catálogo de manutenção usando o template padrão como SSOT.
-- Adiciona itens comuns em motos off-road ausentes no seed original. Idempotente.

DO $expand$
DECLARE v_tid UUID;
BEGIN
  SELECT id INTO v_tid FROM public.maintenance_plan_templates WHERE is_default LIMIT 1;
  IF v_tid IS NULL THEN
    INSERT INTO public.maintenance_plan_templates (name, description, is_default, active)
    VALUES ('Plano padrão off-road', 'Plano genérico para motos de trilha/enduro.', true, true)
    RETURNING id INTO v_tid;
  END IF;

  -- Helper: inserir apenas se (template, item_name, action) ainda não existir.
  INSERT INTO public.maintenance_plan_items (template_id, category, item_name, action, interval_hours, interval_km, interval_days, replace_hours, replace_km, replace_days, severity, notes, sort_order)
  SELECT v_tid, x.category::public.maintenance_category, x.item_name, x.action::public.plan_item_action,
         x.ih, x.ikm, x.id_days, x.rh, x.rkm, x.rd, x.sev::public.plan_severity, x.notes, x.sort_order
    FROM (VALUES
      ('engine','Filtro de óleo','replace',30::int,NULL::int,180::int,NULL::int,NULL::int,NULL::int,'high','Trocar junto com o óleo do motor, a cada 2 trocas.',55),
      ('engine','Reguladores de válvula','inspect',60::int,NULL::int,365::int,NULL::int,NULL::int,NULL::int,'high','Medição de folga conforme manual do fabricante.',75),
      ('brakes','Pastilhas traseiras','inspect',10::int,NULL::int,60::int,NULL::int,NULL::int,NULL::int,'high',NULL,95),
      ('brakes','Disco de freio dianteiro','inspect',NULL::int,NULL::int,180::int,NULL::int,NULL::int,NULL::int,'medium','Verificar espessura mínima.',96),
      ('suspension','Óleo do amortecedor traseiro','replace',50::int,NULL::int,540::int,NULL::int,NULL::int,NULL::int,'high','Revisão completa de mola e retentores.',105),
      ('suspension','Retentores do garfo','inspect',20::int,NULL::int,180::int,NULL::int,NULL::int,NULL::int,'medium','Verificar vazamentos após uso severo.',108),
      ('wheels','Pneu dianteiro','replace',NULL::int,2000::int,NULL::int,NULL::int,NULL::int,NULL::int,'medium','Referência: depende do composto e do uso.',125),
      ('wheels','Pneu traseiro','replace',NULL::int,1500::int,NULL::int,NULL::int,NULL::int,NULL::int,'medium','Off-road desgasta mais o traseiro.',126),
      ('wheels','Rolamentos das rodas','inspect',NULL::int,NULL::int,365::int,NULL::int,NULL::int,NULL::int,'medium',NULL,128),
      ('transmission','Óleo da transmissão','replace',30::int,NULL::int,180::int,NULL::int,NULL::int,NULL::int,'high',NULL,35),
      ('transmission','Discos de embreagem','inspect',40::int,NULL::int,NULL::int,NULL::int,NULL::int,NULL::int,'medium','Verificar em manutenções periódicas de motor.',45),
      ('electrical','Bateria','inspect',NULL::int,NULL::int,90::int,NULL::int,NULL::int,NULL::int,'low','Testar carga e terminais.',150),
      ('electrical','Fusíveis','inspect',NULL::int,NULL::int,180::int,NULL::int,NULL::int,NULL::int,'low',NULL,155),
      ('other','Lavagem e lubrificação geral','clean',5::int,NULL::int,15::int,NULL::int,NULL::int,NULL::int,'low','Após trilhas com lama ou água.',200),
      ('other','Aperto geral de parafusos','inspect',20::int,NULL::int,60::int,NULL::int,NULL::int,NULL::int,'medium','Verificar torque de itens críticos.',210)
    ) AS x(category, item_name, action, ih, ikm, id_days, rh, rkm, rd, sev, notes, sort_order)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.maintenance_plan_items pi
      WHERE pi.template_id = v_tid AND pi.item_name = x.item_name AND pi.action::text = x.action
   );
END $expand$;

-- Wear signs adicionais (idempotente por label).
INSERT INTO public.maintenance_wear_signs (category, item_name, label, sort_order)
SELECT x.category::public.maintenance_category, x.item_name, x.label, x.sort_order
  FROM (VALUES
    ('suspension','Óleo do garfo dianteiro','Garfo com vazamento visível na haste', 60),
    ('suspension','Retentores do garfo','Óleo acumulado nos retentores', 62),
    ('wheels','Pneu dianteiro','Cravos com menos de 1/3 da altura original', 65),
    ('wheels','Pneu traseiro','Blocos arredondados ou arrancados', 66),
    ('electrical','Bateria','Partida fraca ou luzes falhando', 70),
    ('cooling','Líquido de arrefecimento','Nível baixo no reservatório', 72),
    ('other','Aperto geral de parafusos','Parafusos frouxos identificados na inspeção', 220)
  ) AS x(category, item_name, label, sort_order)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.maintenance_wear_signs w
    WHERE w.item_name = x.item_name AND w.label = x.label
 );