# Centro de Transferência TrailBook — Plano

Escopo apenas de UX/apresentação e unificação. Sem mudar regras de negócio, banco, permissões ou fluxo jurídico.

## 1. Visualizador único de PDF

Criar componente oficial `TBPdfViewer` em `src/components/pdf/TBPdfViewer.tsx` (fullscreen, cabeçalho fixo, Voltar / Código / Status / Baixar / Compartilhar / Imprimir / Fechar, safe-area, loading e erro amigáveis, renderização por `blob:` mesma origem, sem URL do backend).

A rota `/_authenticated/recibos/$code/visualizar` passa a ser um wrapper fino que carrega os bytes via `getReceiptPdfBytes` e delega ao `TBPdfViewer`. Adicionar botão **Imprimir** (`iframe.contentWindow.print()`).

## 2. Eliminar caminhos legados de PDF de recibo

Auditar e reescrever todos os pontos que abrem PDF de recibo para navegar para `/recibos/$code/visualizar`:

- `EmitReceiptDialog.tsx` — remover botões duplicados "Visualizar PDF / Baixar / Compartilhar / Imprimir" do bloco verde; deixar somente "Abrir Centro de Transferência".
- `MotoControlCenter.tsx` — botões "Ver / Documento Original" devem navegar para o visualizador interno (não abrir Signed URL).
- `ReceiptsHistorySheet.tsx` — idem.
- `r.$code.tsx` — botão "Visualizar PDF (partes)" já navega; validar.
- Remover/isolar `getReceiptSignedUrl` para uso admin/debug apenas (não referenciado por UI de usuário).

Busca global final por `window.open`, `createSignedUrl`, `signedUrl`, `pdf_url` para garantir que nenhum caminho de recibo escape.

## 3. Centro de Transferência

Nova rota `_authenticated/transferencias.$code.tsx` (Centro de Transferência) reutilizando dados existentes do `smart_receipts`. Layout mobile-first por etapas:

```text
┌ Cabeçalho: Código · Status · Data · Moto · Comprador · Valor
├ [Resumo executivo verde] Próxima ação
├ Timeline vertical (criado → gerado → aguardando assinatura →
│   assinado anexado → aceite vendedor → aceite comprador → concluído)
├ Documento Original — Visualizar / Baixar / Compartilhar / Imprimir
├ Documento Assinado — anexar ou estado "nenhum anexado"
├ Aceites — vendedor / comprador
├ Transferência — status + próxima etapa
├ Auditoria (colapsável) — quem criou / visualizou / baixou / anexou / aceitou
└ Ações: Cancelar Processo · Fechar
```

Etapas derivadas do `status` já persistido; sem alterar schema. Auditoria mostrada a partir dos campos existentes (`created_at`, `signed_at`, `viewed_by_*`, se disponíveis) — quando um campo não existir, mostrar "—" (nunca inventar dado).

Todos os pontos que hoje abrem "Emitir Recibo" ou apontam para PDF passam a linkar para o Centro de Transferência; o visualizador de PDF é acessado a partir dele.

## 4. Bloco verde de sucesso

Reduzir para: ícone ✔, código, status, moto, comprador, valor, uma frase de próxima ação, um CTA único **"Abrir Centro de Transferência"**. Sem duplicar Baixar / Compartilhar / Imprimir.

## 5. Padronização

`TBPdfViewer` passa a ser o componente oficial de qualquer PDF do TrailBook (recibo agora; certificados/anexos futuros). Mesmos ícones (`Eye`, `Download`, `Share2`, `Printer`, `X`, `ArrowLeft`) e ordem padrão.

## 6. Fora de escopo

- Sem mudanças de RLS, RPCs, migrações ou lógica de negócio.
- Sem alterar o PDF em si (cláusulas mantidas como estão).
- Certificados e outros documentos permanecem no fluxo atual; adoção do `TBPdfViewer` fora de recibos fica para próxima fase (registrada como follow-up).

## 7. Testes / evidências

- `tsgo` (typecheck).
- Playwright: emitir recibo → abrir pelo Centro da Moto → abrir pelo Histórico → abrir pela página pública. Screenshots do visualizador e do Centro de Transferência em mobile (390×844) e desktop.
- Grep final: nenhum `createSignedUrl`/`window.open` restante em fluxos de UI de recibo.

## 8. Retorno ao final

Lista de arquivos alterados, antes/depois resumido, screenshots dos testes, confirmação dos itens do check-list (visualizador único, sem Signed URL exposta, sem duplicidade, timeline funcional, Centro de Transferência ativo).
