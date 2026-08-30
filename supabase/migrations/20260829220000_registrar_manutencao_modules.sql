-- Módulos para controle granular do fluxo de Registrar Manutenção
INSERT INTO public.platform_modules (key, label, description, status, sort_order) VALUES
  ('manut_busca', 'Manutenção: Buscar item', 'Opção de busca livre por item/serviço ao registrar manutenção', 'active', 51),
  ('manut_catalogo', 'Manutenção: Catálogo', 'Opção de selecionar componentes por categoria ao registrar manutenção', 'active', 52),
  ('manut_mapa', 'Manutenção: Mapa da moto', 'Seleção visual por região da moto ao registrar manutenção', 'active', 53),
  ('manut_ocr', 'Manutenção: Ler documento', 'Leitura automática de Nota Fiscal, OS ou Cupom', 'active', 54),
  ('manut_ocr_foto', 'Manutenção: OCR — Tirar foto', 'Botão de câmera dentro de Ler documento (sujeito a falhas)', 'disabled', 55),
  ('manut_ocr_arquivo', 'Manutenção: OCR — Selecionar arquivo', 'Upload de arquivo dentro de Ler documento', 'active', 56)
ON CONFLICT (key) DO NOTHING;
NOTIFY pgrst, 'reload schema';
