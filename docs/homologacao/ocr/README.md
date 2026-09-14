# Casos de Regressão — OCR / Importador de Documentos

Cada documento real homologado é um caso permanente de regressão.
Ao alterar qualquer parte do OCR Engine, executar todos os casos abaixo.
Uma melhoria só é considerada homologada quando NOVO PASSA E ANTERIORES PASSAM.

Ver ADR 0019 para a política completa.

---

## Como executar a regressão

Cada caso tem um fixture sintético (sem PII) e um script de validação.
O documento real original é referenciado mas não armazenado no repositório.

---

## Casos registrados

### CASO 001 — MOTOFIRE RACING Nº 1366

**Tipo:** Orçamento de oficina
**Formato:** Imagem PNG (fotografia do documento impresso)
**Layout:** A — QTD / DESCRIÇÃO / TOTAL
**Data de homologação:** 2026-09-14
**Fixture sintético:** `ocr/fixtures/001-motofire-sintetico.txt`

**Estrutura do documento:**
- Cabeçalho: nome da oficina + número do orçamento + cliente
- Linha de cabeçalho de coluna: QTD (fundo preto)
- 21 linhas de itens: qty / descrição / R$ / valor
- Rodapé: VALOR TOTAL R$ 5.649,00

**Resultado esperado:**
- Itens identificados: 21
- Falsos positivos ativos: 0
- Soma dos totalValue: R$ 5.649,00
- unitValue = totalValue / qty (Layout A confirmado)

**21 itens e valores esperados:**

| # | Descrição | QTY | totalValue | unitValue |
|---|---|---|---|---|
| 1 | RETENTOR GARFO COM GUARDA PO | 2 | 750,00 | 375,00 |
| 2 | OLEO SUSPENSÃO MOTOREX | 2 | 450,00 | 225,00 |
| 3 | REPARO PINÇA FREIO BORRACHAS | 1 | 139,00 | 139,00 |
| 4 | LATA SUPORTE PASTILHA FREIO | 1 | 120,00 | 120,00 |
| 5 | CONTRA PINO | 1 | 3,00 | 3,00 |
| 6 | KIT TRANSMISSÃO | 1 | 695,00 | 695,00 |
| 7 | COXIM SUPORTE ESCAPE BETA 2T | 2 | 360,00 | 180,00 |
| 8 | DESCARBONIZANTE CAR80 | 1 | 45,00 | 45,00 |
| 9 | TAMPA DO RADIADOR TWINAIR 2.0 | 1 | 299,00 | 299,00 |
| 10 | ABRAÇADEIRAS | 15 | 15,00 | 1,00 |
| 11 | ADITIVO RADIADOR | 1 | 95,00 | 95,00 |
| 12 | FLUIDO FREIO E EMBREAGEM | 1 | 100,00 | 100,00 |
| 13 | PROTETORES DE BENGALA (PAR) | 1 | 350,00 | 350,00 |
| 14 | ANEL VEDAÇÃO ESCAPE BETA 2T | 2 | 120,00 | 60,00 |
| 15 | PAR ANEL VEDAÇÃO CABEÇOTE BETA 2T | 1 | 170,00 | 170,00 |
| 16 | MEMBRANA DE EMBREAGEM | 1 | 100,00 | 100,00 |
| 17 | BATERIA DO PAINEL | 1 | 40,00 | 40,00 |
| 18 | ABRAÇADEIRAS AÇO | 4 | 48,00 | 12,00 |
| 19 | MDO TROCA OLEO SUSPENSÃO DIANTEIRA | 1 | 400,00 | 400,00 |
| 20 | MDO TROCA OLEO SUSPENSÃO TRASEIRA | 1 | 350,00 | 350,00 |
| 21 | MDO REVISÃO GERAL | 1 | 1.000,00 | 1.000,00 |

**Peculiaridades conhecidas:**
- OCR lê KITTRANSMISSAO (sem espaço) → segunda passada recupera KIT TRANSMISSAO
- OCR lê CONTRAPINO (sem espaço) → segunda passada recupera CONTRA PINO
- OCR lê DESCARBONIZANTECARSO → segunda passada recupera DESCARBONIZANTE CAR80
- OCR lê ARBAÇADEIRAS (erro letra B→R) → join léxico corrige para ABRAÇADEIRAS
- OCR lê ANELVEDACAO → join léxico corrige para ANEL VEDAÇÃO
- OCR lê RS em vez de R$ em alguns valores → normalizado para R$
- Linhas 14 e 18 têm "ACO" separado → ABRAÇADEIRAS ACO é um item diferente de ABRAÇADEIRAS

**Não são itens:**
- MOTOFIRE RACING (cabeçalho)
- Orçamento Nº 1366 (cabeçalho)
- FABRICIO DE ALMEIDA (cliente)
- QTD (coluna)
- VALOR TOTAL R$ 5.649,00 (rodapé)

---

## Política de adição de novo caso

1. Fornecer descrição do tipo de documento
2. Fornecer fixture sintético anonimizado (sem nome, CPF, placa, dados pessoais)
3. Registrar layout detectado (A, B, C... ou novo)
4. Listar itens esperados com qty, totalValue, unitValue
5. Listar o que NÃO deve ser importado
6. Executar CASO 001 e confirmar que ainda passa
7. Executar o novo caso
8. Registrar aqui com número sequencial

---

## Ver também

- `docs/adr/0019-smart-receipt-interpretacao-incremental.md`
- `src/lib/ocr-engine.ts`
