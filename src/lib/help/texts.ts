/**
 * Registry oficial de textos de ajuda contextual (Help Tooltips).
 * Fonte única — todo o TrailBook consome daqui.
 *
 * Regras (ADR 0009):
 *  - Linguagem simples, curta e amigável.
 *  - Nunca jargão técnico.
 *  - Uma frase que explica "o que é" + uma que dá contexto/exemplo.
 *  - Sem emojis dentro dos textos (o ícone já indica ajuda).
 */
export const HELP = {
  // ============ Passaporte ============
  passport:
    "Página pública que reúne, em um só lugar, tudo o que comprova o valor da sua moto: histórico, documentos, selos e saúde. Você escolhe com quem compartilhar.",
  passportShare:
    "Gere um link (com QR Code) para mostrar o Passaporte a comprador, oficina, seguradora ou familiar. Você define validade e pode revogar quando quiser.",
  qrCode:
    "QR Code que abre o Passaporte da sua moto em qualquer celular. Ideal para colar no manual ou apresentar em uma negociação.",

  // ============ Histórico & Timeline ============
  historyFull:
    "Linha do tempo de tudo que já aconteceu com a moto: manutenções, revisões, uso, documentos e mudanças de dono. Nada é apagado — o histórico é preservado.",
  timeline:
    "Ordem cronológica de cada atividade registrada. Cada item traz data, oficina (quando houver), horímetro/km e valor investido.",

  // ============ Documentos ============
  originDoc:
    "Documento que comprova como a moto entrou no seu nome: Nota Fiscal (moto nova) ou Recibo de Compra e Venda (moto usada).",
  invoice:
    "Nota Fiscal emitida pela concessionária. Usada para provar a origem oficial de motos novas.",
  receiptDoc:
    "Recibo de Compra e Venda: documento que formaliza a transferência de uma moto usada entre dois donos.",
  documentsCurrent:
    "Documento atual em vigor. Versões antigas ficam guardadas para consulta futura, sem apagar nada.",
  documentsHistory:
    "Todas as versões já anexadas de cada documento. Você pode restaurar, comparar e auditar quando quiser.",
  documentsVault:
    "Cofre digital privado da sua moto. Só você enxerga. Armazenamento seguro, com checagem de integridade de cada arquivo.",

  // ============ Selos ============
  badges:
    "Selos automáticos que traduzem o cuidado com a moto em confiança visual. Aparecem sozinhos quando o sistema encontra as evidências reais.",
  badgeVerified:
    "Selo reservado para validações feitas por curadoria oficial do TrailBook. Ainda não está disponível — chegará em uma próxima fase.",

  // ============ Pendências / Índices ============
  pending:
    "Coisas que ainda faltam para deixar a moto 100% documentada e cuidada. Nada bloqueia o uso — é apenas um lembrete amigável.",
  originPending:
    "Sua moto ainda não tem Nota Fiscal ou Recibo de Compra e Venda anexado. Sem isso, alguns selos e certificados não podem ser emitidos.",
  conservationIndex:
    "Nota de 0 a 100 que resume o estado geral da moto, considerando manutenção em dia, documentos e histórico registrado.",
  reliabilityIndex:
    "Índice em construção que vai medir a confiança do histórico (regularidade dos registros, oficinas envolvidas e evidências).",

  // ============ Saúde ============
  healthMoto:
    "Painel que mostra como está a manutenção da moto por categoria: motor, freios, suspensão, transmissão, documentos e histórico.",

  // ============ Certificados ============
  certificates:
    "Versões públicas do Passaporte com data de validade opcional. Cada abertura fica registrada — você sabe quem viu.",

  // ============ Compartilhamento ============
  sharing:
    "Toda vez que você compartilha algo do TrailBook, é por link controlado por você. Pode revogar, definir validade e ver os acessos.",

  // ============ Recibos / Negociação ============
  buyerTrailBook:
    "Comprador que já usa o TrailBook. A moto é transferida automaticamente para a garagem dele quando o recibo for assinado pelos dois.",
  buyerExternal:
    "Comprador sem conta no TrailBook. Só o vendedor assina dentro do sistema; ao concluir, a moto sai da sua garagem e é arquivada.",
  signedDocument:
    "PDF do recibo assinado (à mão ou digitalmente). Precisa ser anexado para a negociação ser concluída.",
  negotiationFlow:
    "Etapas do recibo: dados do comprador, moto, valor, revisão, assinatura, anexo do PDF e aceites. Só termina quando tudo estiver assinado.",
  receiptStatus:
    "Onde está a negociação agora: em preparo, aguardando assinatura, aguardando aceite do comprador ou concluída.",

  // ============ Cadastro (perfil) ============
  cpf:
    "Seu CPF é usado para gerar documentos oficiais (como o Recibo de Compra e Venda) e garantir que cada conta e cada moto sejam únicas. Depois de validado, só pode ser alterado via suporte.",
  stateField:
    "Estado (UF) onde você mora. Reaproveitamos essa informação em documentos, recibos e certificados — você não precisa digitar de novo.",
  cityField:
    "Cidade onde você mora. Aparece nos documentos gerados pelo sistema e ajuda na localização em anúncios e certificados.",
  phone:
    "Celular de contato. Usado para reaver o acesso e para os documentos oficiais que exigem telefone do titular.",
  whatsapp:
    "WhatsApp para contato durante negociações e certificados. Se for igual ao celular, marque a opção acima e a gente cuida do resto.",

  // ============ Central / atalhos ============
  centralMoto:
    "Painel principal da sua moto: estado atual, pendências, próxima ação e atalhos para tudo o que existe sobre ela.",
  quickShortcuts:
    "Atalhos rápidos para as áreas mais usadas. Toque para abrir direto — sem precisar navegar por menus.",
} as const;

export type HelpKey = keyof typeof HELP;