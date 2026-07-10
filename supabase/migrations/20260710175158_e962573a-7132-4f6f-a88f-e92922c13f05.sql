-- Fase 1.2 Hotfix: RLS de smart_receipts precisa permitir todas as transições do lifecycle
-- (draft → issued → awaiting_acceptance → completed) e ações de vendedor+comprador (aceite/anexo/cancel/revogar).
-- Sem isto, apenas a criação do rascunho funciona; anexar assinado, aceitar, concluir, cancelar e revogar falhavam com "permission denied".

DROP POLICY IF EXISTS "Seller can update draft receipts" ON public.smart_receipts;

-- Vendedor: pode atualizar em qualquer estado aberto ou revogável (edição, cancelamento, anexo, aceite próprio, conclusão, revogação).
CREATE POLICY "Seller can manage lifecycle"
  ON public.smart_receipts
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = seller_id
    AND status IN ('draft','issued','awaiting_acceptance','completed')
  )
  WITH CHECK (auth.uid() = seller_id);

-- Comprador (usuário TrailBook): pode atualizar apenas quando aguardando aceite (anexo do assinado e registro do próprio aceite).
CREATE POLICY "Buyer can accept and attach"
  ON public.smart_receipts
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = buyer_id
    AND status IN ('issued','awaiting_acceptance')
  )
  WITH CHECK (auth.uid() = buyer_id);

-- Admin (fallback): pode atualizar (revogação administrativa).
CREATE POLICY "Admins can update receipts"
  ON public.smart_receipts
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
