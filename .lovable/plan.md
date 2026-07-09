# Proposta — Documento de Origem & Recibo de Compra e Venda

> Proposta para homologação. **Nada será implementado** antes do "De Acordo".
> Filosofia aplicada: nenhum menu novo na navegação principal; tudo entra em fluxos já existentes (Cadastro da Moto, Central da Moto, Documentos, Pendências).

---

## 1. Desenho do fluxo completo

Três fluxos coexistem, todos ancorados no mesmo conceito: **Documento de Origem da moto**.

### Fluxo A — Cadastro da moto (novo passo "Documento de Origem")
Adicionar um passo ao final do wizard atual de `motorcycles.new`:

```text
[Dados básicos] → [Motor/Uso] → [Documento de Origem] → [Concluir]
                                        │
                     ┌──────────────────┼──────────────────┐
                     ▼                  ▼                  ▼
              Nota Fiscal        Recibo C/V         Enviar depois
                (upload)           (upload)         (cria pendência)
```

### Fluxo B — Moto comprada fora do TrailBook (retroativo)
Mesmo componente do Fluxo A, acessível via:
- alerta do Cockpit → "Anexar agora"
- `Central da Moto → Documentos → Documento de Origem`
- card de Pendências

### Fluxo C — Compra e venda entre usuários TrailBook
Wizard de 7 passos, ancorado em **Central da Moto → Transferência / Compra e Venda** (estende o `TransferOwnershipDialog` já existente):

```text
1. Dados da negociação (valor, forma pgto, data, local)
2. Identificar comprador (e-mail | CPF | telefone) — busca em profiles
   └─ não encontrado: convidar por link (fluxo pendente)
3. Confirmar dados da moto (pré-preenchido, editável)
4. Revisão (resumo compacto)
5. Gerar PDF do Recibo (download + envio ao comprador in-app)
6. Anexar recibo assinado (foto/scan) — vendedor OU comprador
7. Confirmação bilateral → conclui e dispara transferência de titularidade
```

Status do fluxo (máquina de estados):
```text
draft → awaiting_signature → awaiting_signed_upload
      → under_review (contra-parte confere)
      → completed | cancelled
```

---

## 2. Melhor local no sistema

| Superfície | Papel |
|---|---|
| **Cockpit da Moto** | Só exibe **alerta** quando há pendência de documento de origem ou fluxo C/V em aberto. Uma linha, um botão. |
| **Central da Moto → Documentos** | Nova seção "Documento de Origem" acima da lista atual (NF / Recibo / Pendente). |
| **Central da Moto → Transferência / Compra e Venda** | Entrada do Fluxo C (estende `TransferOwnershipDialog`). |
| **Cadastro da Moto** | Novo passo opcional no wizard. |
| Navegação principal | **Nada muda.** Sem novo item de menu. |

---

## 3. Prévia textual do Recibo (PDF, 1 página A4)

```text
┌──────────────────────────────────────────────────────────┐
│  TrailBook                              [logo]  │
│  RECIBO DE COMPRA E VENDA DE MOTOCICLETA                │
│  Modelo operacional — não substitui orientação jurídica │
└──────────────────────────────────────────────────────────┘

VENDEDOR
Nome: _________________________  CPF: ______________
RG: __________  Tel/WhatsApp: ______________
E-mail: _______________________________________
Endereço: ____________________________________
Cidade/UF: ___________________________________

COMPRADOR
[mesmos campos]

MOTOCICLETA
Marca: _______________  Modelo: __________________
Ano fab./modelo: _______ / _______  Cor: __________
Chassi: _______________________  Motor: ___________
Horímetro atual: ______ h    KM atual: ______ km
Apelido (se houver): _______________________________

NEGOCIAÇÃO
Valor: R$ _______________  (por extenso: _______________)
Forma de pagamento: _______________________________
Data: __/__/____   Local: ________________________
Observações: _____________________________________

DECLARAÇÕES
1. As partes declaram que as informações acima são
   verdadeiras e que a motocicleta é entregue no estado
   em que se encontra, previamente inspecionada pelo
   comprador.
2. As partes declaram ciência de que a motocicleta
   destina-se ao uso off-road / trilha / motocross,
   podendo NÃO possuir garantia legal ou contratual
   aplicável à negociação particular, salvo acordo
   escrito em contrário. *(sujeito a validação jurídica)*
3. A transferência de titularidade junto ao órgão de
   trânsito, quando aplicável, é responsabilidade das
   partes conforme prazo legal.

ASSINATURAS
_______________________     _______________________
Vendedor                    Comprador
Data: __/__/____            Data: __/__/____

Testemunha 1 (opcional): __________________________
Testemunha 2 (opcional): __________________________

──────────────────────────────────────────────────────────
Documento gerado por TrailBook em __/__/____ às __:__
ID do recibo: TB-RCV-XXXXXXXX  •  trailbook.com.br
Modelo de apoio. Recomenda-se validação jurídica.
```

---

## 4. Campos necessários (resumo)

Vendedor / Comprador: nome, CPF, RG (opc.), tel, e-mail, endereço, cidade/UF.
Moto: marca, modelo, ano fab./modelo, chassi, motor (opc.), cor (opc.), horímetro, KM (opc.), apelido (opc.).
Negociação: valor, forma pgto, data, local, observações.
Assinaturas: vendedor, comprador, data, local, 2 testemunhas (opc.).

Grande parte é **pré-preenchida** a partir de `profiles` e `motorcycles` — o usuário só confirma.

---

## 5. Status do fluxo

| Status | Quem age | Próximo passo |
|---|---|---|
| `draft` | vendedor | completar dados |
| `awaiting_signature` | ambos | imprimir + assinar |
| `awaiting_signed_upload` | qualquer parte | anexar foto/scan |
| `under_review` | contra-parte | confirmar |
| `completed` | — | dispara transferência |
| `cancelled` | qualquer parte | motivo obrigatório |

Fluxo A/B (só documento de origem) usa estados simplificados: `pending` → `attached`.

---

## 6. Regras de pendência

- Moto sem NF nem Recibo → pendência **permanente** até anexo.
- Aparece: Cockpit (alerta amarelo, 1 linha), Central da Moto (chip), Documentos (banner topo).
- Nunca bloqueia uso da moto. Nunca aparece como erro. Sempre com botão único "Anexar agora".
- Fluxo C em aberto → chip de status na Central + card em Pendências, com "Continuar" e "Cancelar".

---

## 7. UX Mobile (Native First)

- Wizard/stepper vertical, 1 pergunta por tela.
- Campos de seleção (Combobox de comprador por email/CPF/tel) em vez de digitação livre.
- Máscaras BR (CPF, telefone, moeda) — reusar `src/lib/br-validators.ts`.
- `TBBottomSheet` para revisão antes de gerar PDF.
- Botão primário fixo no rodapé (área de toque ≥44px).
- Após gerar: 3 ações grandes — **Baixar PDF** / **Enviar ao comprador** / **Já assinei, anexar agora**.
- Estado de "aguardando assinatura" com instrução visual em 3 passos ilustrados.

---

## 8. Impacto em Documentos da Moto

- `motorcycle_documents` já tem `doc_type` — adicionar valores `invoice_purchase` (já existe como `invoice`) e `bill_of_sale` (novo) ao catálogo em `src/lib/motorcycle-documents.ts`.
- Marcar 1 documento como **"Documento de Origem"** (flag `is_origin_document boolean`).
- Regra: exatamente **um** origin doc por moto; anexar novo substitui o anterior (versionado no histórico).

---

## 9. Impacto em Central da Moto

- Nova entrada "Transferência / Compra e Venda" (já existe `TransferOwnershipDialog` — estender, não duplicar).
- Chip de pendência de documento de origem no topo da Central.
- Nenhuma nova rota principal.

---

## 10. Pontos jurídicos — **exigem validação antes da implementação**

1. **Cláusula de garantia off-road** — CDC e Código Civil se aplicam mesmo em venda entre particulares? Redação atual precisa de revisão por advogado.
2. **Modelo vs. documento oficial** — o aviso "não substitui orientação jurídica" é suficiente para limitar responsabilidade do TrailBook?
3. **Transferência DETRAN** — o recibo do TrailBook substitui ATPV-e / CRV? **Não.** Precisa ficar explícito no PDF.
4. **Assinatura eletrônica** — v1 é impressão + assinatura física + upload da imagem. Assinatura digital (ICP-Brasil / clique) fica para v2.
5. **LGPD** — compartilhar CPF/endereço entre comprador e vendedor exige consentimento explícito de ambos antes de gerar o PDF.
6. **Retenção do PDF** — por quanto tempo o TrailBook guarda? Quem pode baixar depois? (proposta: ambas as partes, para sempre, com auditoria de download).
7. **Menor de idade / representação** — bloquear se CPF do comprador for menor, ou permitir com responsável?
8. **Chassi remarcado / sinistro** — declaração explícita das partes? Proposta: campo "Observações sobre o estado" obrigatório quando aplicável.

---

## 11. Recomendação técnica (para depois do "De Acordo")

### Modelo de dados
- **Nova tabela** `bill_of_sale_flows` — id, motorcycle_id, seller_id, buyer_id (nullable), buyer_lookup (email/cpf/tel), negotiation (jsonb), status, pdf_path, signed_pdf_path, cancel_reason, timestamps. RLS: só as duas partes leem/escrevem; audit obrigatório.
- **Extensão** `motorcycle_documents`: coluna `is_origin_document boolean` + índice único parcial.
- **Enum extension**: `doc_type` ganha `bill_of_sale`.
- **audit_log** já cobre; adicionar eventos `bill_of_sale.created|pdf_generated|pdf_downloaded|signed_uploaded|status_changed|completed|cancelled`.

### Geração do PDF
- Server function (`createServerFn`) usando **pdf-lib** (Worker-compatível — ver `server-runtime`), template A4 renderizado no servidor a partir dos dados do fluxo.
- Salva em Storage (bucket privado), signed URL para download.
- Marca d'água discreta "MODELO" no fundo até status = `completed`.

### Frontend
- Reuso máximo: `TBBottomSheet`, `TBFormGrid`, `TBFormField`, `TransferOwnershipDialog`, `MotorcycleDocuments`.
- Nenhum novo componente de baixo nível — apenas 1 novo componente de wizard `BillOfSaleWizard.tsx`.

### Segurança em camadas
Frontend (Zod) + server fn (Zod + `requireSupabaseAuth` + verificação de titularidade via `is_moto_owner`) + DB (RLS por partes envolvidas + CHECK de status).

### Roadmap sugerido
- **Fase 1**: Documento de Origem (Fluxos A e B) — baixo risco, alto valor imediato.
- **Fase 2**: Recibo C/V entre usuários (Fluxo C) — depende de validação jurídica dos pontos 1-8.
- **Fase 3** (futuro): assinatura eletrônica, integração ATPV-e, avaliação FIPE embutida.

---

## Filtro de Evolução Controlada (5 perguntas)

1. **Resolve problema real?** Sim — hoje o TrailBook não registra origem da moto, ponto fraco de confiança do histórico.
2. **Uso frequente?** Documento de Origem: 1x por moto (essencial). Recibo C/V: eventual mas alto impacto quando acontece.
3. **Cabe em fluxo existente?** Sim — Cadastro, Central da Moto, Documentos, Transferência. **Zero menus novos.**
4. **Aumenta complexidade?** Não na navegação. Cresce no backend (1 tabela nova, 1 coluna, 1 PDF), mas invisível ao usuário.
5. **Existe mais simples?** Para Fluxo A/B, não — é só upload. Para Fluxo C, alternativa mais simples seria só gerar PDF sem gestão de status; proposta atual mantém status porque a pendência do assinado é o que dá valor real.

**Conclusão:** aderente à filosofia. Aguardando "De Acordo" para detalhar migração e começar pela Fase 1.
