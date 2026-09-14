/**
 * OCR Engine — extração completa de descrição, quantidade e valor
 *
 * REGRA CENTRAL:
 *   DESCRIÇÃO = obrigatória — nunca descartada por ausência de qty/valor/classificação
 *   QUANTIDADE = preenchida quando identificável; null caso contrário
 *   VALOR      = preenchido quando identificável; null caso contrário
 *
 * Pipeline:
 *   1. Extrair texto raw (PDF digital → todas as páginas; PDF escaneado → OCR por página)
 *   2. Segmentar linhas preservando estrutura
 *   3. Aplicar IGNORE_PATTERNS (cabeçalho/rodapé/fiscal)
 *   4. Tentar classificar via DICT/LABOR_PRIORITY → confidence high/medium
 *   5. Fallback: linha estruturalmente válida → confidence low (não descartada)
 *   6. Extrair qty e lineTotal de cada linha reconhecida
 */

import type { MaintenanceCategory } from "@/lib/trailbook";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface OcrQualityResult {
  ok: boolean;
  warnings: string[];
  confidence?: number;
}

export interface OcrSuggestedItem {
  /** Descrição completa preservada do documento (sem qty/valor/artefatos OCR).
   *  Este é o campo exibido ao usuário como texto editável principal. */
  rawDescription: string;
  /** Texto limpo do documento para exibição e edição — NUNCA substituído pelo DICT.
   *  Ex: "RETENTOR GARFO COM GUARDA PO" (não "Vedações do garfo") */
  normalizedName: string;
  /** Sugestão de classificação auxiliar do DICT — não exibida como descrição principal.
   *  Ex: "Vedação/retentor do garfo". Pode ser null quando não há match no DICT. */
  classificationHint?: string;
  category: MaintenanceCategory;
  itemKind: "technical" | "labor" | "expense";
  /** Quantidade extraída — null quando não identificada (NÃO assume 1) */
  qty?: number;
  /** Valor unitário — nunca calculado automaticamente (lineTotal / qty) */
  unitValue?: number;
  /** Valor total da linha — preenchido quando identificável */
  totalValue?: number;
  confidence: "high" | "medium" | "low";
  scheduleId?: string;
  templateItemId?: string;
}

export interface OcrResult {
  quality: OcrQualityResult;
  items: OcrSuggestedItem[];
  rawText: string;
  date?: string;
  documentTotal?: number;
}

/** Token individual retornado pelo Tesseract com coordenadas e confiança */
interface TesseractToken {
  word: string;
  left: number;
  top: number;
  width: number;
  height: number;
  conf: number;
  lineKey: string; // "block-par-line"
}

// ─── Padrões de exclusão (cabeçalho, fiscal, rodapé) ─────────────────────────
// Princípio: em dúvida, NÃO excluir. Preferir falso positivo a falso negativo.

const IGNORE_PATTERNS = [
  // Endereço
  /^\s*\b(rua|av\.|avenida|alameda|travessa|estrada|rod\.)\b/i,
  /\b(bairro|cidade|municipio|cep\s*:?\s*\d|uf\s*:)\b/i,
  // Dados fiscais
  /\b(cnpj|cpf|ie:|inscri[çc]|i\.e\.)\b/i,
  /\b(fone|telefone|tel\.|celular|whatsapp|e-mail|email|site\b|www\.)\b/i,
  /\b(nf-?e?|nfc-?e?|sat\b|cupom\s+fiscal|ecf|nota\s+fiscal\b|serie\b|chave\s+de\s+acesso)\b/i,
  // Totais e pagamentos — apenas quando isolados/majoritários
  /^\s*(valor\s+total|total\s+geral|total\s+da\s*os|total\s+dos|subtotal|desconto|acrescimo|troco)\b/i,
  /^\s*r\$\s*[\d.,]+\s*$/i,          // Linha que É apenas um valor monetário
  /\b(dinheiro|cartao|pix|pagamento|recebido|troco)\b/i,
  // Datas isoladas
  /^\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s*$/,
  // Textos de rodapé/mensagem
  /\b(obrigado|volte\s*sempre|nao\s*e\s*valido|nao\s*comprova|consumidor)\b/i,
  // Identificadores de documento (cabeçalho)
  // Identificadores de documento (orçamento, OS, data com label)
  /\b(orcamento|orçamento)\b/i,
  /\b(ordem\s*de\s*servi[çc]o|o\.?\s*s\.?\s*n[°º.])\s*\d/i,
  /^\s*(data|emiss[aã]o|validade|vencimento)\s*:/i,
  // Linhas de coluna de tabela (cabeçalho de tabela)
  /^(qtd\.?\s+desc|item\s+cod|descri[çc]ao\s+vr|qtd\s+un\s+|un\.\s+valor)/i,
  /^\s*(qtd\.?|un\.?|vr\.?\s*unit|vr\.?\s*total|item\s+cod|descricao|descri[çc]ao)\s*$/i,
  /^\s*[-=*_]{3,}\s*$/,
  // Dados de cliente/oficina sem contexto de item
  /^\s*(cliente|proprietario|proprietário|responsavel|responsável)\s*:/i,
  /^\s*(placa|veiculo|veículo|modelo)\s*:/i,
];

// ─── LABOR_PRIORITY — mão de obra com variações reais ─────────────────────────

const LABOR_PRIORITY: { pattern: RegExp; name: string }[] = [
  // MDO / M.O. — abreviações comuns em OS de oficina
  {
    pattern: /\b(mdo|m\.?o\.?)\s+/i,
    name: "Mão de obra",
  },
  // Variações de "mão de obra" escritas por extenso
  {
    pattern: /\b(ma[o0õd]\s*d[ae]\s*obra|mã[o0]?\s*de\s*obra|mão\s*de\s*obra|maode\s*obra)\b/i,
    name: "Mão de obra",
  },
  // Serviço explícito
  {
    pattern: /\b(servi[çc]o\s+de|execu[çc][aã]o\s+de)\b/i,
    name: "Serviço",
  },
  // Troca explícita
  {
    pattern: /\b(trocar?\s+(pneu|oleo|óleo|corrente|pastilha|vela|filtro|fluido|retent))\b/i,
    name: "Serviço de troca",
  },
  { pattern: /\bbalanceamento\b|\balinhar\b|\balinhamento\b/i, name: "Balanceamento / alinhamento" },
  { pattern: /\b(instalac|instalação|montagem|desmontagem)\b/i, name: "Serviço de instalação" },
  { pattern: /\bdiagnóstico\b|\bdiagnostico\b/i, name: "Diagnóstico" },
  { pattern: /\bregulagem\b/i, name: "Regulagem" },
  { pattern: /\brevisão\s+geral\b|\brevisao\s+geral\b/i, name: "Revisão geral" },
];

// ─── Dicionário de peças/componentes conhecidos ───────────────────────────────

type DictEntry = {
  pattern: RegExp;
  name: string;
  category: MaintenanceCategory;
  itemKind: "technical" | "labor" | "expense";
};

const DICT: DictEntry[] = [
  // Motor — óleo
  { pattern: /\b(oleo|óleo|oil)\b.*\b(motor|engine|4t|2t)\b/i, name: "Óleo do motor", category: "engine", itemKind: "technical" },
  { pattern: /\b(motor|engine)\b.*\b(oleo|óleo|oil)\b/i, name: "Óleo do motor", category: "engine", itemKind: "technical" },
  { pattern: /\boleo\s*(motor|4t|2t|sintetico|mineral)\b/i, name: "Óleo do motor", category: "engine", itemKind: "technical" },
  { pattern: /\b(oleo|óleo|oil)\b.*\b(motul|castrol|shell|mobil|ipiranga|repsol|yamalube|lubrax)\b/i, name: "Óleo do motor", category: "engine", itemKind: "technical" },
  { pattern: /\b(motul|castrol|shell\s*advance|mobil)\b.*\b(oleo|óleo|oil|10w|15w|20w|5w|10h|15h)\b/i, name: "Óleo do motor", category: "engine", itemKind: "technical" },
  { pattern: /\b(oleo|óleo|oil)\b.*\b\d+[wWhH]\d+\b/i, name: "Óleo do motor", category: "engine", itemKind: "technical" },
  { pattern: /\b\d+[wWhH]\d+\b.*\b(oleo|óleo|oil|litro)\b/i, name: "Óleo do motor", category: "engine", itemKind: "technical" },
  // Motor — filtros e componentes
  { pattern: /\b(filtro|filter)\b.*\b(ar|air)\b/i, name: "Filtro de ar", category: "engine", itemKind: "technical" },
  { pattern: /\b(filtro|filter)\b.*\b(oleo|óleo|oil)\b/i, name: "Filtro de óleo", category: "engine", itemKind: "technical" },
  { pattern: /\bvela\b/i, name: "Vela de ignição", category: "engine", itemKind: "technical" },
  { pattern: /\b(spark\s*plug|iridium|ngk|champion)\b/i, name: "Vela de ignição", category: "engine", itemKind: "technical" },
  { pattern: /\bcarburador\b/i, name: "Carburador", category: "engine", itemKind: "technical" },
  { pattern: /\bbomba\b.*\b(combustivel|combustível|gasolina|fuel)\b/i, name: "Bomba de combustível", category: "engine", itemKind: "technical" },
  { pattern: /\bdescarbonizante\b/i, name: "Descarbonizante", category: "engine", itemKind: "technical" },
  { pattern: /\bmembrana\b.*embreagem\b/i, name: "Membrana de embreagem", category: "engine", itemKind: "technical" },
  // Transmissão
  { pattern: /\bkit\s*(transmiss|relac|corrente)\b/i, name: "Kit transmissão", category: "transmission", itemKind: "technical" },
  { pattern: /\bcorrente\b/i, name: "Corrente de transmissão", category: "transmission", itemKind: "technical" },
  { pattern: /\bcoroa\b/i, name: "Coroa", category: "transmission", itemKind: "technical" },
  { pattern: /\b(pinhão|pinhao)\b/i, name: "Pinhão", category: "transmission", itemKind: "technical" },
  // Freios
  { pattern: /\bpastilha\b.*diant/i, name: "Pastilhas dianteiras", category: "brakes", itemKind: "technical" },
  { pattern: /\bpastilha\b.*tras/i, name: "Pastilhas traseiras", category: "brakes", itemKind: "technical" },
  { pattern: /\bpastilha\b/i, name: "Pastilhas de freio", category: "brakes", itemKind: "technical" },
  { pattern: /\b(fluido|fluid)\b.*freio/i, name: "Fluido de freio", category: "brakes", itemKind: "technical" },
  { pattern: /\b(fluido|fluid)\b.*embreagem/i, name: "Fluido de embreagem", category: "brakes", itemKind: "technical" },
  { pattern: /\b(fluido|fluid)\b.*(freio|embreagem)/i, name: "Fluido de freio/embreagem", category: "brakes", itemKind: "technical" },
  { pattern: /\bdisco\b.*freio/i, name: "Disco de freio", category: "brakes", itemKind: "technical" },
  { pattern: /\bpin[çc]a\b.*freio/i, name: "Pinça de freio", category: "brakes", itemKind: "technical" },
  { pattern: /\breparo\b.*pin[çc]a/i, name: "Reparo de pinça", category: "brakes", itemKind: "technical" },
  { pattern: /\blata\b.*suporte\b.*pastilha/i, name: "Suporte de pastilha", category: "brakes", itemKind: "technical" },
  // Suspensão
  { pattern: /\b(oleo|óleo)\b.*garfo/i, name: "Óleo do garfo", category: "suspension", itemKind: "technical" },
  { pattern: /\b(oleo|óleo)\b.*suspensão/i, name: "Óleo de suspensão", category: "suspension", itemKind: "technical" },
  { pattern: /\b(motorex)\b/i, name: "Óleo de suspensão Motorex", category: "suspension", itemKind: "technical" },
  { pattern: /\b(vedacao|vedação|seal|retentor)\b.*garfo/i, name: "Vedações do garfo", category: "suspension", itemKind: "technical" },
  { pattern: /\bretentor\b.*garfo/i, name: "Retentor do garfo", category: "suspension", itemKind: "technical" },
  { pattern: /\bretentor\b/i, name: "Retentor", category: "suspension", itemKind: "technical" },
  { pattern: /\bguarda[\s\-]?p[ôo]\b/i, name: "Guarda-pó", category: "suspension", itemKind: "technical" },
  { pattern: /\bamortecedor\b/i, name: "Amortecedor", category: "suspension", itemKind: "technical" },
  { pattern: /\bprotetores?\b.*bengala/i, name: "Protetor de bengala", category: "suspension", itemKind: "technical" },
  { pattern: /\bcoxim\b/i, name: "Coxim", category: "other", itemKind: "technical" },
  // Rodas / Pneus
  { pattern: /\bpneu\b.{0,30}(diant|front)\b/i, name: "Pneu dianteiro", category: "wheels", itemKind: "technical" },
  { pattern: /\bpneu\b.{0,30}(tras|rear)\b/i, name: "Pneu traseiro", category: "wheels", itemKind: "technical" },
  { pattern: /\bpneu\b/i, name: "Pneu", category: "wheels", itemKind: "technical" },
  { pattern: /\bcâmara\b|\bcamara\b/i, name: "Câmara de ar", category: "wheels", itemKind: "technical" },
  { pattern: /\braio\b/i, name: "Raios", category: "wheels", itemKind: "technical" },
  // Elétrica
  { pattern: /\bbateria\b/i, name: "Bateria", category: "electrical", itemKind: "technical" },
  { pattern: /\bcabo\b.*vela/i, name: "Cabo de vela", category: "electrical", itemKind: "technical" },
  // Arrefecimento
  { pattern: /\b(aditivo|liquido|líquido|coolant)\b.*radia/i, name: "Aditivo de radiador", category: "cooling", itemKind: "technical" },
  { pattern: /\btampa\b.*radia/i, name: "Tampa do radiador", category: "cooling", itemKind: "technical" },
  { pattern: /\bradiador\b/i, name: "Radiador", category: "cooling", itemKind: "technical" },
  // Outros
  { pattern: /\bkit\s*transm/i, name: "Kit transmissão", category: "transmission", itemKind: "technical" },
  { pattern: /\b(contra\s*pino|contrapino)\b/i, name: "Contra-pino", category: "other", itemKind: "technical" },
  { pattern: /\banel\b.*(veda[çc]|escape|cabeçote|cabecote)\b/i, name: "Anel de vedação", category: "other", itemKind: "technical" },
  { pattern: /\bveda[çc][aã]o\b.*escape/i, name: "Vedação do escape", category: "other", itemKind: "technical" },
  { pattern: /\bveda[çc][aã]o\b.*cabeçote/i, name: "Vedação do cabeçote", category: "other", itemKind: "technical" },
  { pattern: /\bescapa\b|\bescape\b/i, name: "Escape", category: "other", itemKind: "technical" },
  { pattern: /\babraçadeira|abraçadeiras\b/i, name: "Abraçadeiras", category: "other", itemKind: "technical" },
  { pattern: /\b(parafuso|porca|arruela|rebite|fixador)\b/i, name: "Fixadores / parafusos", category: "other", itemKind: "technical" },
  { pattern: /\bgraxa\b/i, name: "Graxa / lubrificante", category: "other", itemKind: "technical" },
  { pattern: /\b(wp|wd-40|lubrificante|lubri)\b/i, name: "Lubrificante", category: "other", itemKind: "technical" },
];

// ─── Utilidades de extração de quantidade e valor ─────────────────────────────

/**
 * Tenta extrair quantidade da linha.
 * Padrões: "2 RETENTOR...", "1 KIT...", "4 ABRAÇADEIRAS"
 * Retorna null quando não há confiança.
 */
function extractQty(line: string): number | null {
  // Quantidade no início da linha: "2 DESC..." ou "2. DESC..."
  const leadingQty = line.match(/^\s*(\d{1,3})\s*\.?\s+[A-Za-zÀ-ÿ]/);
  if (leadingQty) {
    const q = parseInt(leadingQty[1], 10);
    if (q >= 1 && q <= 999) return q;
  }
  // "QTD: 2" ou "QTD 2"
  const qtdLabel = line.match(/\bqtd\.?\s*:?\s*(\d{1,3})\b/i);
  if (qtdLabel) {
    const q = parseInt(qtdLabel[1], 10);
    if (q >= 1 && q <= 999) return q;
  }
  return null;
}

/**
 * Tenta extrair valor monetário da linha (formato pt-BR).
 * Retorna null quando não há confiança.
 * NÃO extrai o total do documento.
 */
function extractValue(line: string): number | null {
  // Padrões: "R$ 750,00", "R$1.000,00", "750,00", "R$ 3,00"
  // Evitar capturar números de código de produto (ex: "001234")
  const patterns = [
    /r\$\s*([\d.]+,\d{2})/gi,          // R$ 1.000,00
    /r\s*\$\s*([\d.]+,\d{2})/gi,        // R $ 1.000,00 (OCR com espaço)
  ];

  for (const pattern of patterns) {
    const matches = [...line.matchAll(pattern)];
    if (matches.length === 1) {
      // Apenas um valor na linha — alta confiança
      const raw = matches[0][1].replace(/\./g, "").replace(",", ".");
      const val = parseFloat(raw);
      if (!isNaN(val) && val > 0) return val;
    }
    if (matches.length > 1) {
      // Múltiplos valores — pode ser qtd × unit = total; pegar o último (mais provável = total da linha)
      const last = matches[matches.length - 1][1].replace(/\./g, "").replace(",", ".");
      const val = parseFloat(last);
      if (!isNaN(val) && val > 0) return val;
    }
  }

  // Fallback: valor no final da linha sem R$ explícito — menos confiável, só aceitar com ≥2 decimais
  const endValue = line.match(/\s([\d]{1,5}[.,]\d{2})\s*$/);
  if (endValue) {
    const raw = endValue[1].replace(".", "").replace(",", ".");
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0 && val < 99999) return val;
  }

  return null;
}

/**
 * Extrai o total do documento (VALOR TOTAL R$ X) para validação auxiliar.
 */
function extractDocumentTotal(text: string): number | null {
  const patterns = [
    /valor\s*total\s*r?\$?\s*([\d.]+,\d{2})/gi,
    /total\s*geral\s*r?\$?\s*([\d.]+,\d{2})/gi,
    /total\s*r\$\s*([\d.]+,\d{2})/gi,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const numMatch = m[0].match(/([\d.]+,\d{2})/);
      if (numMatch) {
        const val = parseFloat(numMatch[1].replace(/\./g, "").replace(",", "."));
        if (!isNaN(val) && val > 0) return val;
      }
    }
  }
  return null;
}

// ─── Classificação de uma linha ───────────────────────────────────────────────

/**
 * Determina se uma linha parece estruturalmente um item de tabela
 * (para decidir se o fallback será confidence=low mas selecionado).
 *
 * Linha "estruturalmente válida de tabela":
 *   - começa com número de quantidade OU texto descritivo
 *   - não é apenas um número puro ou valor monetário
 *   - tem pelo menos 3 letras consecutivas
 */
function isStructurallyTableLine(line: string): boolean {
  const stripped = line.replace(/[0-9\s.,\-\/R$]/g, "");
  if (stripped.length < 3) return false;
  // Não é apenas "VALOR TOTAL" ou similar já coberto pelo IGNORE
  // Tem palavra com pelo menos 3 letras
  return /[A-Za-zÀ-ÿ]{3,}/.test(line);
}

/**
 * Extrai a descrição limpa do documento a partir da linha OCR.
 * Remove apenas elementos estruturais: qty inicial, valor monetário,
 * "RS"/"R$" soltos, e corrige junções óbvias de palavras.
 * NUNCA substitui o conteúdo semântico pelo catálogo.
 */
function extractCleanDescription(line: string, qty: number | null): string {
  let desc = line.trim();

  // Remover qty do início: "2 RETENTOR..." → "RETENTOR..."
  if (qty !== null) {
    desc = desc.replace(/^\s*\d{1,3}\s*\.?\s+/, "").trim();
  }

  // Remover valor monetário do final: "R$ 750,00" ou "RS 360,00"
  desc = desc.replace(/\s+r?s?\$?\s*[\d.]+,\d{2}\s*$/i, "").trim();

  // Remover "RS" ou "R$" soltos que sobraram (artefato OCR)
  desc = desc.replace(/\s+R[S$]\s*$/i, "").trim();

  // Correções de junção óbvias (apenas padrões fortes conhecidos do domínio)
  const joins: [RegExp, string][] = [
    [/\bKITTRANSMISS(AO|ÃO)\b/i, "KIT TRANSMISSÃO"],
    [/\bANELVEDA(CAO|ÇÃO)\b/i, "ANEL VEDAÇÃO"],
    [/\bPARANELVEDA/i, "PAR ANEL VEDAÇÃO"],
    [/\bDESCARBONIZANTECAR/i, "DESCARBONIZANTE CAR"],
    [/\bMDOTROCA\b/i, "MDO TROCA"],
    [/\bMDOREVIS/i, "MDO REVIS"],
    [/\bADITIVORADIADOR\b/i, "ADITIVO RADIADOR"],
    [/\bARBA[ÇC]ADEIRAS\b/i, "ABRAÇADEIRAS"],
    [/\bABRA[ÇC]ADEIRAS\b/i, "ABRAÇADEIRAS"],
  ];
  for (const [pattern, replacement] of joins) {
    desc = desc.replace(pattern, replacement);
  }

  // Normalizar espaços múltiplos
  desc = desc.replace(/\s+/g, " ").trim();

  return desc;
}

function identifyItem(line: string, schedules: any[]): OcrSuggestedItem | null {
  // 1. Filtros de exclusão
  if (IGNORE_PATTERNS.some((p) => p.test(line))) return null;

  // 2. Ignora linhas muito curtas ou só números/símbolos
  const stripped = line.replace(/[\d.,\s\-\/R$%°]/g, "").trim();
  if (stripped.length < 3) return null;

  // 3. Extrair qty e valor desta linha (independente de classificação)
  const qty = extractQty(line);
  const totalValue = extractValue(line);

  // 4. Linha de texto base (remover qty do início para normalização)
  const lineWithoutLeadingQty = qty !== null
    ? line.replace(/^\s*\d{1,3}\s*\.?\s+/, "").trim()
    : line.trim();

  // 5. Descrição limpa do documento (exibição principal — nunca substituída pelo DICT)
  const cleanDesc = extractCleanDescription(line, qty);
  if (cleanDesc.length < 2) return null;

  // 6. Verificar LABOR_PRIORITY
  for (const labor of LABOR_PRIORITY) {
    if (labor.pattern.test(line)) {
      return {
        rawDescription: line.trim(),
        normalizedName: cleanDesc,        // descrição completa do documento
        classificationHint: labor.name,  // hint auxiliar ("Mão de obra")
        category: "other",
        itemKind: "labor",
        qty: qty ?? undefined,
        totalValue: totalValue ?? undefined,
        confidence: "high",
      };
    }
  }

  // 7. Verificar dicionário de peças — usado apenas para classificação, NÃO para descrição
  for (const entry of DICT) {
    if (entry.pattern.test(lineWithoutLeadingQty)) {
      const matched = schedules.find(
        (s) =>
          s.name.toLowerCase().includes(entry.name.toLowerCase().split(" ")[0]) ||
          entry.name.toLowerCase().includes(s.name.toLowerCase().split(" ")[0]),
      );
      return {
        rawDescription: line.trim(),
        normalizedName: cleanDesc,         // descrição completa do documento
        classificationHint: entry.name,   // hint auxiliar ("Retentor", "Bateria"…)
        category: entry.category,
        itemKind: entry.itemKind,
        qty: qty ?? undefined,
        totalValue: totalValue ?? undefined,
        confidence: "high",
        scheduleId: matched?.id,
        templateItemId: matched?.template_item_id,
      };
    }
  }

  // 8. FALLBACK: linha estruturalmente válida, não reconhecida pelo DICT
  if (!isStructurallyTableLine(line)) return null;
  if (cleanDesc.length < 3) return null;

  // Linhas de fallback: auto-selecionadas SOMENTE se têm qty ou valor identificado.
  const autoSelect = qty !== null || totalValue !== null;

  return {
    rawDescription: line.trim(),
    normalizedName: cleanDesc,
    category: "other",
    itemKind: "technical",
    qty: qty ?? undefined,
    totalValue: totalValue ?? undefined,
    confidence: autoSelect ? "medium" : "low",
  };
}

// ─── Validação de qualidade da imagem ─────────────────────────────────────────

export async function validateImageQuality(file: File): Promise<OcrQualityResult> {
  const warnings: string[] = [];
  if (!file.type.startsWith("image/")) return { ok: true, warnings: [] };
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth, h = img.naturalHeight;
      if (w < 600 || h < 400)
        warnings.push(`Resolução baixa (${w}×${h}px). Imagens maiores melhoram a leitura.`);
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(w, 200);
      canvas.height = Math.min(h, 200);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let bright = 0, dark = 0;
        const total = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          const b = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (b > 200) bright++;
          else if (b < 50) dark++;
        }
        if (bright / total > 0.95) { resolve({ ok: false, warnings: ["Imagem toda branca — verifique a câmera."] }); return; }
        if (dark / total > 0.95) { resolve({ ok: false, warnings: ["Imagem toda escura — verifique a iluminação."] }); return; }
      }
      resolve({ ok: true, warnings });
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ ok: false, warnings: ["Não foi possível carregar a imagem."] }); };
    img.src = url;
  });
}

// ─── Extração de texto de PDF digital ────────────────────────────────────────

async function extractTextFromPdf(file: File): Promise<string> {
  const { getDocument } = await import("pdfjs-dist");
  const buf = await file.arrayBuffer();
  const pdf = await getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Reconstruir linhas usando coordenada Y dos items para preservar estrutura
    const items = content.items.filter((x: any) => "str" in x && x.str.trim()) as any[];
    if (items.length === 0) continue;

    // Agrupar por Y (linha) — tolerância de 3 unidades
    const lineGroups: Map<number, string[]> = new Map();
    for (const item of items) {
      const y = Math.round(item.transform[5] / 3) * 3;
      if (!lineGroups.has(y)) lineGroups.set(y, []);
      lineGroups.get(y)!.push(item.str);
    }
    // Ordenar por Y decrescente (topo para baixo no PDF)
    const sortedYs = [...lineGroups.keys()].sort((a, b) => b - a);
    for (const y of sortedYs) {
      text += lineGroups.get(y)!.join(" ") + "\n";
    }
  }
  return text.trim();
}

// ─── OCR via Tesseract ────────────────────────────────────────────────────────

async function renderPdfPageToDataUrl(file: File, pageNum: number): Promise<string> {
  const { getDocument } = await import("pdfjs-dist");
  const buf = await file.arrayBuffer();
  const pdf = await getDocument({ data: buf }).promise;
  const page = await pdf.getPage(pageNum);
  const vp = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement("canvas");
  canvas.width = vp.width;
  canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
  return canvas.toDataURL("image/png");
}

async function getPdfPageCount(file: File): Promise<number> {
  const { getDocument } = await import("pdfjs-dist");
  const buf = await file.arrayBuffer();
  const pdf = await getDocument({ data: buf }).promise;
  return pdf.numPages;
}

/** Configurações do CDN Tesseract.js — centralizadas para reutilização */
const TESSERACT_OPTIONS = {
  workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js",
  langPath: "https://tessdata.projectnaptha.com/4.0.0",
  corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd-lstm.wasm.js",
};

/** Cria um novo worker Tesseract */
async function createTesseractWorker() {
  const { createWorker } = await import("tesseract.js");
  return createWorker("por+eng", 1, TESSERACT_OPTIONS);
}

/**
 * Determina se um token é candidato à segunda passada.
 * Critérios baseados nos testes reais do documento MOTOFIRE:
 *   A. token muito longo sem espaço (possível junção de palavras)
 *   B. OU confiança muito baixa em texto alfabético
 * NÃO usa dicionário nem categoria — apenas estrutura do token.
 */
function isSuspiciousToken(word: string, conf: number): boolean {
  const letters = word.replace(/[^A-Za-zÀ-ÿ]/g, "");
  // A: token longo sem espaço + confiança moderada/baixa — possível junção
  if (word.length >= 10 && !word.includes(" ") && conf < 85 && letters.length >= 7) return true;
  // B: token muito longo independente de confiança
  if (word.length > 14 && !word.includes(" ")) return true;
  return false;
}

/**
 * Segunda passada: OCR direcionado ao crop do token suspeito.
 * Usa worker SEPARADO do principal — sem risco de condição de corrida.
 * Executa PSM7 e PSM13 SEQUENCIALMENTE no mesmo worker secundário.
 * Substitui o token original SOMENTE se conf2 > conf1 + 5 pontos.
 */
async function retryToken(
  imageDataUrl: string,
  token: TesseractToken,
  imgWidth: number,
  imgHeight: number,
): Promise<{ text: string; conf: number; replaced: boolean }> {
  // Crop do token com padding — limitado à largura real do token para não capturar tokens adjacentes
  const PAD = 8;
  const SCALE = 4;
  const x0 = Math.max(0, token.left - PAD);
  const y0 = Math.max(0, token.top - PAD);
  // x1 limitado à borda direita do token + PAD (não capturar token ao lado)
  const x1 = Math.min(imgWidth, token.left + token.width + PAD);
  const y1 = Math.min(imgHeight, token.top + token.height + PAD);

  // Criar canvas crop + upscale
  const cropCanvas = document.createElement("canvas");
  const cw = (x1 - x0) * SCALE;
  const ch = (y1 - y0) * SCALE;
  cropCanvas.width = cw;
  cropCanvas.height = ch;
  const ctx = cropCanvas.getContext("2d")!;

  // Desenhar imagem original no canvas recortado
  const img = new Image();
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.src = imageDataUrl;
  });
  ctx.filter = "contrast(2.5) grayscale(1)";
  ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0, 0, 0, cw, ch);
  const cropDataUrl = cropCanvas.toDataURL("image/png");

  // Worker secundário — separado do principal para evitar condição de corrida
  const worker2 = await createTesseractWorker();

  try {
    // PSM 7: single text line — bom para linhas com conteúdo misto
    await (worker2 as any).setParameters({ tessedit_pageseg_mode: "7" });
    const r7 = await worker2.recognize(cropDataUrl);
    const text7 = r7.data.text.trim().replace(/[^\w\sÀ-ÿ().,-]/g, "").trim();
    const conf7 = r7.data.confidence;

    // PSM 13: raw line — bom para tokens técnicos/códigos sem dicionário
    await (worker2 as any).setParameters({ tessedit_pageseg_mode: "13" });
    const r13 = await worker2.recognize(cropDataUrl);
    const text13 = r13.data.text.trim().replace(/[^\w\sÀ-ÿ().,-]/g, "").trim();
    const conf13 = r13.data.confidence;

    // Selecionar melhor resultado
    const [bestText, bestConf] = conf7 >= conf13
      ? [text7, conf7]
      : [text13, conf13];

    // Substituir somente se:
    // 1. Há melhora real de confiança (margem de 5 pontos)
    // 2. Resultado não está vazio
    // 3. Não é apenas pontuação/ruído
    const MARGIN = 5;
    const hasImprovement = bestConf > token.conf + MARGIN;
    const isValid = bestText.length > 0 && /[A-Za-zÀ-ÿ]/.test(bestText);

    if (hasImprovement && isValid) {
      return { text: bestText, conf: bestConf, replaced: true };
    }
    return { text: token.word, conf: token.conf, replaced: false };
  } finally {
    await worker2.terminate();
  }
}

async function runTesseract(src: string | File): Promise<{ text: string; confidence: number }> {
  const worker = await createTesseractWorker();
  const url = src instanceof File ? URL.createObjectURL(src) : src;

  // Primeira passada: PSM 6 (página inteira)
  const { data } = await worker.recognize(url);
  await worker.terminate();
  if (src instanceof File) URL.revokeObjectURL(url);

  // Verificar se há tokens suspeitos que merecem segunda passada
  // data.words contém tokens individuais com bounding boxes
  const words: any[] = (data as any).words ?? [];
  if (words.length === 0) {
    // Fallback: sem data.words disponível, retornar texto como está
    return { text: data.text, confidence: data.confidence };
  }

  // Mapear tokens por linha e identificar suspeitos
  type LineTokens = { tokens: TesseractToken[]; hasSuspicious: boolean };
  const lineMap = new Map<string, LineTokens>();

  for (const w of words) {
    if (!w.text?.trim()) continue;
    // Tesseract.js v5 retorna w.bbox: {x0, y0, x1, y1}
    const bbox = w.bbox ?? { x0: 0, y0: 0, x1: 0, y1: 0 };
    const conf = w.confidence ?? 0;
    const lineKey = `${w.paragraph_num ?? 0}-${w.line_num ?? 0}`;
    const token: TesseractToken = {
      word: w.text.trim(),
      left: bbox.x0,
      top: bbox.y0,
      width: bbox.x1 - bbox.x0,
      height: bbox.y1 - bbox.y0,
      conf,
      lineKey,
    };
    if (!lineMap.has(lineKey)) lineMap.set(lineKey, { tokens: [], hasSuspicious: false });
    const entry = lineMap.get(lineKey)!;
    entry.tokens.push(token);
    if (isSuspiciousToken(token.word, conf)) entry.hasSuspicious = true;
  }

  // Verificar se há linhas com tokens suspeitos
  const linesWithSuspicious = [...lineMap.values()].filter((l) => l.hasSuspicious);
  if (linesWithSuspicious.length === 0) {
    return { text: data.text, confidence: data.confidence };
  }

  // Dimensões da imagem para calcular crops corretos
  let imgWidth = 0, imgHeight = 0;
  if (typeof src === "string") {
    // dataUrl — obter dimensões via Image
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => { imgWidth = img.naturalWidth; imgHeight = img.naturalHeight; resolve(); };
      img.src = src;
    });
  } else {
    // File — criar dataUrl temporário para crops
    const bmp = await createImageBitmap(src);
    imgWidth = bmp.width; imgHeight = bmp.height; bmp.close();
  }

  // Converter src para dataUrl para uso nos crops
  let imageDataUrl: string;
  if (src instanceof File) {
    imageDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(src);
    });
  } else {
    imageDataUrl = src;
  }

  // Segunda passada: processar tokens suspeitos SEQUENCIALMENTE
  // (não usar Promise.all no mesmo worker — cada retryToken cria worker próprio)
  const corrections = new Map<string, string>(); // word original → word corrigido

  for (const line of linesWithSuspicious) {
    for (const token of line.tokens) {
      if (!isSuspiciousToken(token.word, token.conf)) continue;
      // Pular tokens muito estreitos (crop seria inútil)
      if (token.width < 20) continue;

      const result = await retryToken(imageDataUrl, token, imgWidth, imgHeight);
      if (result.replaced) {
        corrections.set(token.word, result.text);
      }
    }
  }

  if (corrections.size === 0) {
    return { text: data.text, confidence: data.confidence };
  }

  // Reconstruir data.text substituindo somente os tokens corrigidos
  // Mantendo a ordem e espaços da primeira passada
  let correctedText = data.text;
  for (const [original, corrected] of corrections) {
    // Substituição do token original no texto reconstruído
    correctedText = correctedText.split(original).join(corrected);
  }

  return { text: correctedText, confidence: data.confidence };
}

// ─── Entrada principal ────────────────────────────────────────────────────────

export async function runOcr(file: File, schedules: any[]): Promise<OcrResult> {
  let rawText = "", confidence = 100;

  if (file.type === "application/pdf") {
    const direct = await extractTextFromPdf(file);
    if (direct.trim().length > 50) {
      rawText = direct;
    } else {
      // PDF escaneado — processar TODAS as páginas (corrigido)
      const numPages = await getPdfPageCount(file);
      const parts: string[] = [];
      for (let p = 1; p <= numPages; p++) {
        const dataUrl = await renderPdfPageToDataUrl(file, p);
        const r = await runTesseract(dataUrl);
        parts.push(r.text);
        confidence = Math.min(confidence, r.confidence);
      }
      rawText = parts.join("\n");
    }
  } else {
    const r = await runTesseract(file);
    rawText = r.text;
    confidence = r.confidence;
  }

  const quality: OcrQualityResult = { ok: true, warnings: [], confidence };

  if (confidence < 50) {
    quality.warnings.push(
      `Confiança da leitura: ${Math.round(confidence)}%. ` +
        `Tente fotografar em superfície plana, com boa iluminação e o documento bem enquadrado.`,
    );
  }

  const wordCount = rawText.trim().split(/\s+/).length;
  if (wordCount < 5) {
    quality.ok = false;
    quality.warnings.push("Não conseguimos identificar texto suficiente. Tente novamente com melhor iluminação.");
    return { quality, items: [], rawText };
  }

  // Extrair total do documento para validação auxiliar
  const documentTotal = extractDocumentTotal(rawText);

  // Segmentar por linha
  const lines = rawText
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 3);

  // Para OCR de baixa qualidade, tentar pares de linhas consecutivas
  const usePairs = confidence < 70;
  const candidates: string[] = [...lines];
  if (usePairs) {
    for (let i = 0; i < lines.length - 1; i++) {
      candidates.push(`${lines[i]} ${lines[i + 1]}`);
    }
  }

  const seen = new Set<string>();
  const items: OcrSuggestedItem[] = [];

  for (const line of candidates) {
    const item = identifyItem(line, schedules);
    if (!item) continue;

    const rawKey = item.rawDescription.trim().toLowerCase();
    if (seen.has(rawKey)) continue;
    seen.add(rawKey);

    items.push(item);
  }

  // Validação auxiliar: soma dos valores vs. documentTotal
  if (documentTotal !== null && items.length > 0) {
    const extractedValues = items.map((i) => i.totalValue ?? 0);
    const sum = extractedValues.reduce((a, b) => a + b, 0);
    const diff = Math.abs(sum - documentTotal);
    if (sum > 0 && diff / documentTotal > 0.05) {
      quality.warnings.push("Alguns valores podem precisar de revisão.");
    }
  }

  return { quality, items, rawText, documentTotal: documentTotal ?? undefined };
}
