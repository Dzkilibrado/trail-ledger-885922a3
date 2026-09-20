-- ============================================================
-- KB Revision Etapa 3: Atualizar fiscalizacao-laudo
-- Reflte a implementacao real da Fiscalizacao com dados do
-- proprietario, moto, laudo e documento de origem.
-- NAO altera schema.
-- ============================================================

UPDATE public.help_articles SET
  summary = 'Compartilhe temporariamente o Laudo com dados essenciais da moto — identificacao do proprietario, documento de origem, situacao do laudo e QR Code com validade definida.',
  body_md = E'## Como apresentar minha moto em uma fiscalizacao?\n\nO TrailBook permite criar um acesso temporario ao Laudo da sua moto com informacoes organizadas para uma fiscalizacao de transito.\n\n### O que e exibido no acesso fiscal\n\nO acesso de fiscalizacao mostra:\n- Nome completo e CPF do proprietario\n- Identificacao da moto (marca, modelo, ano, placa e chassi)\n- Situacao e codigo do Laudo\n- Documento de origem da moto, quando cadastrado (Nota Fiscal ou Recibo)\n\n### O que NAO e exibido\n\nHistorico completo de manutencoes, dados financeiros, documentos privados e outros dados pessoais nao sao exibidos.\n\n### Como gerar o acesso\n\n1. Abra um Laudo valido em **Check-ups**.\n2. Toque em **Fiscalizacao**.\n3. Selecione a duracao: 30 minutos, 1 hora, 6 horas ou 24 horas.\n4. Toque em **Gerar acesso**.\n5. Apresente o QR Code ou copie o link.\n\nVoce tambem pode baixar um **PDF de Fiscalizacao** com todas as informacoes organizadas.\n\n### Sobre o acesso\n\n- Expira automaticamente no horario escolhido.\n- Pode ser revogado antes do vencimento.\n- O Laudo original nao e alterado pelo compartilhamento.\n- Nao substitui documentos oficiais obrigatorios por lei.',
  context_tags = ARRAY['fiscalizacao','laudo','qr','fiscal','apresentar','blitz','agente','proprietario','cpf','documento','nota fiscal'],
  updated_at = now()
WHERE slug = 'fiscalizacao-laudo';

NOTIFY pgrst, 'reload schema';
