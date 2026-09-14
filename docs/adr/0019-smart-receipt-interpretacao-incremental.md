# ADR 0019 — Smart Receipt: Interpretação Incremental de Layouts e Política de Não Regressão

**Status:** Aceita
**Data:** 2026-09-14
**Versão:** v1.9.2

---

## 1. Objetivo

Estabelecer como diretriz permanente do importador de documentos (Smart Receipt / OCR Engine) que todo novo layout aprendido deve AMPLIAR a capacidade do sistema, nunca substituir o conhecimento anterior.

---

## 2. Problema anterior

O ciclo de desenvolvimento do OCR Engine demonstrou risco real de regressão: ao corrigir o comportamento para um novo documento (ex: MOTOFIRE RACING), heurísticas anteriores eram alteradas sem validação nos documentos previamente homologados. Uma correção que passa no documento atual não garante que layouts anteriores continuam funcionando.

---

## 3. Solução adotada

### Princípio central

```
Conhecimento atual + novo padrão = capacidade ampliada
```

Nunca:

```
Conhecimento atual → substituído pelo novo documento
```

### Política de alteração

Toda alteração no OCR Engine, parser, layout detection, normalização, segunda passada, classificação, valores ou descrição deve responder:

> "Esta mudança melhora o novo documento sem quebrar os anteriores?"

Se não houver evidência positiva para ambas as partes: não considerar homologado.

### Regressão obrigatória

Cada documento real homologado torna-se um caso de regressão permanente. Ao concluir qualquer melhoria, executar todos os casos anteriores. Uma melhoria só é homologada quando: **NOVO PASSA E ANTERIORES CONTINUAM PASSANDO**.

---

## 4. Layouts suportados (acumulativo)

| Layout | Estrutura | Documento de referência |
|---|---|---|
| A | QTD / DESCRICAO / TOTAL | MOTOFIRE RACING No 1366 |
| B | QTD / DESCRICAO / VL UNIT / TOTAL | (pendente de documento real) |
| C | ITEM / DESCRICAO / QTD / UNIT / TOTAL | (pendente) |
| D | CODIGO / DESCRICAO / QTD / VALOR | (pendente) |
| E | 01 / DESCRICAO / 2 / 50,00 / 100,00 | (pendente) |
| F | DESCRICAO / QTD / VALOR | (pendente) |
| G | blocos/linhas separados por item | (pendente) |
| H | sem cabecalho formal | (pendente) |
| I | texto simples sem tabela | fallback textual atual |

---

## 5. Regras permanentes

### Descricao e dado primario

- rawDescription = OCR1 original (nunca alterado)
- normalizedName = descricao limpa do documento (nunca substituida pelo DICT)
- classificationHint = interpretacao auxiliar do DICT (nao exibida como descricao)

### Quantidade

Identificar pela estrutura. Se nao houver confianca: qty = null. Nunca assumir 1.
Diferenciar item number (sequencial) de quantidade real (coluna QTD).

### Valores

- 1 coluna monetaria: totalValue
- 2 colunas monetarias: unitValue (primeira) + totalValue (segunda)
- unitValue = totalValue / qty somente quando layout for QTD + DESC + TOTAL com confianca confirmada
- Validar: qty x unitValue aprox. totalValue (2 casas decimais)

### Nao inventar

Codigo, part number, modelo, marca, quantidade, valor ou descricao nunca sao inventados.
Segunda passada OCR so substitui token com evidencia de confianca superior (delta > 5 pontos).

### Cabecalho nao e item

Nome da oficina, CNPJ, cliente, data, numero de OS/orcamento, coluna de cabecalho,
total geral, subtotal, desconto, forma de pagamento: nunca importados como item.

### Mao de obra

Vocabulario extensivel: MDO, M.O., MAO DE OBRA, SERVICO, TROCA, INSTALACAO,
REVISAO, REGULAGEM, AJUSTE, LIMPEZA, TAXA DE SERVICO e variacoes: itemKind = labor.

---

## 6. Arquitetura em camadas (permanente)

```
1. OCR principal (PSM 6, pagina inteira)
2. Interpretacao de layout (clusters X, lineKey por data.words)
3. Segunda passada direcionada (somente token suspeito, DPR corrigido)
4. Normalizacao conservadora (extractCleanDescription)
5. Classificacao (DICT -> category + classificationHint)
6. Validacao matematica/estrutural
7. Revisao obrigatoria pelo usuario
```

---

## 7. Privacidade de fixtures

Documentos reais podem conter nome, CPF, endereco, placa, dados financeiros.
Fixtures permanentes devem ser anonimizados ou sinteticos equivalentes.
Documentos reais fornecidos durante o desenvolvimento sao usados apenas para homologacao pontual.

---

## 8. Futuro fallback avancado (nao implementar agora)

```
OCR local -> confianca suficiente? -> revisao
                 nao
          Document AI / IA multimodal -> revisao
```

A arquitetura atual nao bloqueia essa evolucao.

---

## 9. Compatibilidade

- Sem alteracao de banco, schema, RLS, migrations
- OcrSuggestedItem mantem: rawDescription, normalizedName, classificationHint,
  qty, unitValue, totalValue, confidence
- OcrUploader.tsx inalterado

---

## 10. Proximas evolucoes previstas

- Correcao do DPR no crop de canvas (OCR2 no browser)
- Parser baseado em data.words com lineKey (elimina dependencia do \n do data.text)
- Deteccao de clusters X para layout tabular
- Calculo de unitValue quando layout for Layout A com confianca
- Suporte a Layout B (duas colunas monetarias)
- Biblioteca de fixtures anonimizados em docs/homologacao/ocr/

---

## 11. Ver tambem

- src/lib/ocr-engine.ts: implementacao atual
- docs/homologacao/ocr/: casos de regressao do importador
- ADR 0016: Constituicao do Produto TrailBook
