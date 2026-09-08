-- Módulo admin para Manutenção Geral
-- Permite habilitar/desabilitar/colocar em manutenção sem deploy
INSERT INTO public.platform_modules (key, label, description, status, sort_order) VALUES
  (
    'manut_geral',
    'Manutenção: Manutenção Geral',
    'Opção de registrar múltiplos componentes de uma vez via checklist de schedules da moto',
    'active',
    57
  )
ON CONFLICT (key) DO NOTHING;
NOTIFY pgrst, 'reload schema';
