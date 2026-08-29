/**
 * OCR Engine — versão simplificada e mais confiável
 *
 * Estratégia: identificar APENAS itens de moto/acessório/serviço.
 * Valores (qty, unitValue, total) ficam em branco — o usuário preenche.
 * Isso elimina a maior fonte de erro: confundir ano/modelo/código com valor.
 *
 * Ignorado explicitamente:
 * - Endereço, telefone, CNPJ, CPF, e-mail
 * - Cabeçalhos, totais, subtotais
 * - Datas (não confundir com valores)
 * - Códigos de produto (números puros sem contexto)
 * - Modelo/referência do item (ex: "SR39 110/90-19") — não é valor
 */

import type { MaintenanceCategory } from "@/lib/trailbook";

export interface OcrQualityResult {
  ok: boolean;
  warnings: string[];
  confidence?: number;
}

export interface OcrSuggestedItem {
  rawDescription: string;
  normalizedName: string;
  category: MaintenanceCategory;
  itemKind: "technical" | "labor" | "expense";
  // Intencionalmente vazios — usuário preenche
  qty?: undefined;
  unitValue?: undefined;
  totalValue?: undefined;
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

// ============================================================
// Linhas que devem ser IGNORADAS completamente
// (endereço, telefone, fiscal, cabeçalho, totais)
// ============================================================
const IGNORE_PATTERNS = [
  /\b(rua|av\.|avenida|alameda|travessa|estrada|rod\.)\b/i,
  /\b(bairro|cidade|municipio|cep|uf|estado)\b/i,
  /\b(cnpj|cpf|ie:|inscri|i\.e\.)\b/i,
  /\b(fone|telefone|tel\.|celular|whatsapp|e-mail|email|site|www)\b/i,
  /\b(nf-?e?|nfc-?e?|sat|cupom|ecf|nota fiscal|serie|chave)\b/i,
  /\b(total\s*(da\s*os|geral|do\s*pedido|dos\s*serv|dos\s*mat|da\s*nota|itens))\b/i,
  /\b(subtotal|desconto|acrescimo|troco|dinheiro|cartao|pix|pagamento)\b/i,
  /\b(data|hora|emissao|emissão|validade|vencimento)\b/i,
  /\b(obrigado|volte\s*sempre|nao\s*e\s*valido|nao\s*comprova|consumidor)\b/i,
  /\b(ordem\s*de\s*servi|os\s*n[°º]|n[°º]\s*os|orcamento|orçamento)\b/i,
  /^(qtd\.?|un\.?|vr\.?\s*unit|vr\.?\s*total|item\s+cod|descricao|descri[çc]ao)\s*$/i,
  /^\s*[-=*_]{3,}\s*$/,
];

// ============================================================
// Dicionário de normalização — identifica itens de moto
// ============================================================
type DictEntry = {
  pattern: RegExp;
  name: string;
  category: MaintenanceCategory;
  itemKind: "technical" | "labor" | "expense";
};

const DICT: DictEntry[] = [
  // Motor
  {
    pattern: /\b(oleo|óleo|oil)\b.*\b(motor|engine|4t|2t)\b/i,
    name: "Óleo do motor",
    category: "engine",
    itemKind: "technical",
  },
  {
    pattern: /\b(motor|engine)\b.*\b(oleo|óleo|oil)\b/i,
    name: "Óleo do motor",
    category: "engine",
    itemKind: "technical",
  },
  {
    pattern: /\boleo\s*(motor|4t|2t|sintetico|mineral)\b/i,
    name: "Óleo do motor",
    category: "engine",
    itemKind: "technical",
  },
  {
    pattern: /\b(filtro|filter)\b.*\b(ar|air)\b/i,
    name: "Filtro de ar",
    category: "engine",
    itemKind: "technical",
  },
  {
    pattern: /\b(filtro|filter)\b.*\b(oleo|óleo|oil)\b/i,
    name: "Filtro de óleo",
    category: "engine",
    itemKind: "technical",
  },
  { pattern: /\bvela\b/i, name: "Vela de ignição", category: "engine", itemKind: "technical" },
  {
    pattern: /\b(spark\s*plug|iridium|ngk|champion)\b/i,
    name: "Vela de ignição",
    category: "engine",
    itemKind: "technical",
  },
  { pattern: /\bcarburador\b/i, name: "Carburador", category: "engine", itemKind: "technical" },
  // Transmissão
  { pattern: /\bcorrente\b/i, name: "Corrente", category: "transmission", itemKind: "technical" },
  {
    pattern: /\b(kit\s*(corrente|transm|relac)|kit\s*relação|kit\s*relacao)\b/i,
    name: "Kit transmissão",
    category: "transmission",
    itemKind: "technical",
  },
  { pattern: /\bcoroa\b/i, name: "Coroa", category: "transmission", itemKind: "technical" },
  {
    pattern: /\b(pinhão|pinhao)\b/i,
    name: "Pinhão",
    category: "transmission",
    itemKind: "technical",
  },
  {
    pattern: /\b(guia|deslizador)\b.*corrente\b/i,
    name: "Guia de corrente",
    category: "transmission",
    itemKind: "technical",
  },
  // Freios
  {
    pattern: /\bpastilha\b/i,
    name: "Pastilhas de freio",
    category: "brakes",
    itemKind: "technical",
  },
  {
    pattern: /\bpastilha\b.*diant/i,
    name: "Pastilhas dianteiras",
    category: "brakes",
    itemKind: "technical",
  },
  {
    pattern: /\bpastilha\b.*tras/i,
    name: "Pastilhas traseiras",
    category: "brakes",
    itemKind: "technical",
  },
  {
    pattern: /\b(fluido|fluid)\b.*freio/i,
    name: "Fluido de freio",
    category: "brakes",
    itemKind: "technical",
  },
  {
    pattern: /\bdisco\b.*freio/i,
    name: "Disco de freio",
    category: "brakes",
    itemKind: "technical",
  },
  // Suspensão
  {
    pattern: /\b(oleo|óleo)\b.*garfo/i,
    name: "Óleo do garfo",
    category: "suspension",
    itemKind: "technical",
  },
  {
    pattern: /\b(vedac|seal|retentor)\b.*garfo/i,
    name: "Vedações do garfo",
    category: "suspension",
    itemKind: "technical",
  },
  {
    pattern: /\bamortecedor\b/i,
    name: "Amortecedor",
    category: "suspension",
    itemKind: "technical",
  },
  // Rodas / Pneus — atenção extra para não confundir modelo com valor
  {
    pattern: /\bpneu\b.*diant/i,
    name: "Pneu dianteiro",
    category: "wheels",
    itemKind: "technical",
  },
  { pattern: /\bpneu\b.*tras/i, name: "Pneu traseiro", category: "wheels", itemKind: "technical" },
  {
    pattern: /\bpneu\b.*(cross|off|trilha|enduro|motocross|xr|crf|kx|yz|rm)\b/i,
    name: "Pneu off-road",
    category: "wheels",
    itemKind: "technical",
  },
  { pattern: /\bpneu\b/i, name: "Pneu", category: "wheels", itemKind: "technical" },
  {
    pattern: /\bcâmara\b|\bcamara\b/i,
    name: "Câmara de ar",
    category: "wheels",
    itemKind: "technical",
  },
  { pattern: /\braio\b/i, name: "Raios", category: "wheels", itemKind: "technical" },
  // Elétrica
  { pattern: /\bbateria\b/i, name: "Bateria", category: "electrical", itemKind: "technical" },
  {
    pattern: /\bcabo\b.*vela/i,
    name: "Cabo de vela",
    category: "electrical",
    itemKind: "technical",
  },
  // Arrefecimento
  {
    pattern: /\b(liquido|líquido)\b.*arrefec/i,
    name: "Líquido de arrefecimento",
    category: "cooling",
    itemKind: "technical",
  },
  { pattern: /\bradiador\b/i, name: "Radiador", category: "cooling", itemKind: "technical" },
  // Estrutura
  {
    pattern: /\bguidão\b|\bguida[oõ]\b/i,
    name: "Guidão",
    category: "other",
    itemKind: "technical",
  },
  { pattern: /\bmanete\b/i, name: "Manetes", category: "other", itemKind: "technical" },
  {
    pattern: /\bprotetor\b.*motor/i,
    name: "Protetor de motor",
    category: "other",
    itemKind: "technical",
  },
  {
    pattern: /\bplástico\b|\bplastico\b|\bcarenagem\b/i,
    name: "Plásticos / carenagens",
    category: "other",
    itemKind: "technical",
  },
  // Lubrificantes / consumíveis
  { pattern: /\bgraxa\b/i, name: "Graxa", category: "other", itemKind: "technical" },
  {
    pattern: /\b(wp|wd-40|lubrificante|lubri)\b/i,
    name: "Lubrificante",
    category: "other",
    itemKind: "technical",
  },
  { pattern: /\bpresilha\b/i, name: "Presilha", category: "other", itemKind: "technical" },
  // Mão de obra — padrões comuns em OS brasileira
  {
    pattern: /\b(m\.?o\.?|mao\s*de\s*obra|mão\s*de\s*obra|mao-de-obra)\b/i,
    name: "Mão de obra",
    category: "other",
    itemKind: "labor",
  },
  {
    pattern: /\b(trocar?\s*(pneu|oleo|corrente|pastilha|vela)|troca\s+de)\b/i,
    name: "Serviço de troca",
    category: "other",
    itemKind: "labor",
  },
  {
    pattern: /\b(balancear|balanceamento|alinhar|alinhamento)\b/i,
    name: "Balanceamento / alinhamento",
    category: "other",
    itemKind: "labor",
  },
  {
    pattern: /\b(instalac|instalação|montar|montagem|desmontar|desmontagem)\b/i,
    name: "Serviço de instalação",
    category: "other",
    itemKind: "labor",
  },
  {
    pattern: /\b(revisao|revisão|servico|serviço)\b/i,
    name: "Serviço / revisão",
    category: "other",
    itemKind: "labor",
  },
  // Despesas
  {
    pattern: /\b(desconto|abatimento)\b/i,
    name: "Desconto",
    category: "other",
    itemKind: "expense",
  },
  {
    pattern: /\b(taxa|frete|entrega)\b/i,
    name: "Taxa / frete",
    category: "other",
    itemKind: "expense",
  },
];

// ============================================================
// Validação de qualidade da imagem
// ============================================================
export async function validateImageQuality(file: File): Promise<OcrQualityResult> {
  const warnings: string[] = [];
  if (!file.type.startsWith("image/")) return { ok: true, warnings: [] };
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth,
        h = img.naturalHeight;
      if (w < 600 || h < 400)
        warnings.push(`Resolução baixa (${w}×${h}px). Imagens maiores melhoram a leitura.`);
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(w, 200);
      canvas.height = Math.min(h, 200);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let bright = 0,
          dark = 0;
        const total = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          const b = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (b > 200) bright++;
          else if (b < 50) dark++;
        }
        if (bright / total > 0.95) {
          resolve({ ok: false, warnings: ["Imagem toda branca — verifique a câmera."] });
          return;
        }
        if (dark / total > 0.95) {
          resolve({ ok: false, warnings: ["Imagem toda escura — verifique a iluminação."] });
          return;
        }
      }
      resolve({ ok: true, warnings });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ ok: false, warnings: ["Não foi possível carregar a imagem."] });
    };
    img.src = url;
  });
}

// ============================================================
// Extração de texto de PDF digital
// ============================================================
async function extractTextFromPdf(file: File): Promise<string> {
  const { getDocument } = await import("pdfjs-dist");
  const buf = await file.arrayBuffer();
  const pdf = await getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text +=
      content.items
        .filter((x: any) => "str" in x)
        .map((x: any) => x.str)
        .join(" ") + "\n";
  }
  return text.trim();
}

async function renderPdfPageToDataUrl(file: File): Promise<string> {
  const { getDocument } = await import("pdfjs-dist");
  const buf = await file.arrayBuffer();
  const pdf = await getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const vp = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement("canvas");
  canvas.width = vp.width;
  canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
  return canvas.toDataURL("image/png");
}

async function runTesseract(src: string | File): Promise<{ text: string; confidence: number }> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("por+eng", 1, {
    workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js",
    langPath: "https://tessdata.projectnaptha.com/4.0.0",
    corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd-lstm.wasm.js",
  });
  const url = src instanceof File ? URL.createObjectURL(src) : src;
  const { data } = await worker.recognize(url);
  await worker.terminate();
  if (src instanceof File) URL.revokeObjectURL(url);
  return { text: data.text, confidence: data.confidence };
}

// ============================================================
// Identifica se uma linha é um item de moto
// Retorna o item normalizado ou null se deve ser ignorado
// ============================================================
function identifyItem(line: string, schedules: any[]): OcrSuggestedItem | null {
  // 1. Ignora linhas de cabeçalho/endereço/totais
  if (IGNORE_PATTERNS.some((p) => p.test(line))) return null;

  // 2. Ignora linhas muito curtas ou só números
  const stripped = line.replace(/[\d.,\s\-\/]/g, "").trim();
  if (stripped.length < 3) return null;

  // 3. Tenta o dicionário
  for (const entry of DICT) {
    if (entry.pattern.test(line)) {
      const matched = schedules.find(
        (s) =>
          s.name.toLowerCase().includes(entry.name.toLowerCase().split(" ")[0]) ||
          entry.name.toLowerCase().includes(s.name.toLowerCase().split(" ")[0]),
      );
      return {
        rawDescription: line.trim(),
        normalizedName: entry.name,
        category: entry.category,
        itemKind: entry.itemKind,
        confidence: "high",
        scheduleId: matched?.id,
        templateItemId: matched?.template_item_id,
      };
    }
  }

  return null; // Não reconhecido = não mostra (evita trazer endereço/telefone)
}

// ============================================================
// Entrada principal
// ============================================================
export async function runOcr(file: File, schedules: any[]): Promise<OcrResult> {
  let rawText = "",
    confidence = 100;

  if (file.type === "application/pdf") {
    const direct = await extractTextFromPdf(file);
    if (direct.trim().length > 50) {
      rawText = direct;
    } else {
      const r = await runTesseract(await renderPdfPageToDataUrl(file));
      rawText = r.text;
      confidence = r.confidence;
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
    quality.warnings.push(
      "Não conseguimos identificar texto suficiente. Tente novamente com melhor iluminação.",
    );
    return { quality, items: [], rawText };
  }

  // Processa linha por linha — só retorna itens reconhecidos
  const lines = rawText
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 3);
  const seen = new Set<string>();
  const items: OcrSuggestedItem[] = [];

  for (const line of lines) {
    const item = identifyItem(line, schedules);
    if (!item) continue;
    // Deduplicação: mesmo item normalizado não entra duas vezes
    if (seen.has(item.normalizedName)) continue;
    seen.add(item.normalizedName);
    items.push(item);
  }

  return { quality, items, rawText };
}
