/** Local correction shared by FAQ and Assistant; no mutation of hosted articles. */
export const FISCAL_GUIDANCE = {
  summary: 'Acesso fiscal temporário com nome completo, CPF completo e documento de origem autorizado. Não libera histórico detalhado.',
  body_md: `## Fiscalização Digital e privacidade

O compartilhamento comum do laudo mostra somente as seções autorizadas. Não mostra proprietário, emissor, CPF, documentos de origem, identificadores internos ou regras técnicas privadas.

### Exceção fiscal autorizada
No acesso criado para Fiscalização Digital, a identificação autorizada pode mostrar nome completo e CPF completo do proprietário do laudo, além da referência ao documento de origem da mesma moto (Nota Fiscal ou Recibo de Compra e Venda). Esses dados ficam fora do snapshot histórico.

O acesso fiscal não libera componentes, histórico detalhado, índices ou plano de ação, mesmo que essas seções sejam selecionadas indevidamente. Sem autorização da identificação, os dados pessoais e o documento não são apresentados.

### Validade, documentos e PDF
O link segue sua expiração e pode ser revogado pelo proprietário. O documento é aberto por um endereço temporário de até 5 minutos, limitado também ao tempo restante do acesso. Um endereço já emitido pode continuar funcionando até esse prazo após a revogação.

O PDF fiscal contém apenas as informações fiscais autorizadas disponíveis no momento da geração. Um PDF já baixado não é apagado remotamente por expiração ou revogação; compartilhe-o com cuidado.

O TrailBook não substitui documentos oficiais obrigatórios por lei. O compartilhamento não altera laudos, snapshots nem hashes históricos.`,
};

export function withReportSharingGuidance<T extends { slug?: string; summary: string | null; body_md: string | null }>(articles: T[]): T[] {
  return articles.map(article => article.slug === 'fiscalizacao-laudo' ? { ...article, ...FISCAL_GUIDANCE } : article);
}