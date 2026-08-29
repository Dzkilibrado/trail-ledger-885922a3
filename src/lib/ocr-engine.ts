/**
 * OCR Engine — Entrega 3
 * Processamento 100% client-side, sem custo por requisição.
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
  qty?: number;
  unitValue?: number;
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

type DictEntry = {
  pattern: RegExp;
  name: string;
  category: MaintenanceCategory;
  itemKind: "technical" | "labor" | "expense";
};

const DICT: DictEntry[] = [
  // Motor
  {
    pattern: /\b(oleo|óleo|oil)\b.*\b(motor|engine)\b/i,
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
    pattern: /\b(vela|spark|plug)\b/i,
    name: "Vela de ignição",
    category: "engine",
    itemKind: "technical",
  },
  {
    pattern: /\b(filtro|filter)\b.*\b(oleo|óleo|oil)\b/i,
    name: "Filtro de óleo",
    category: "engine",
    itemKind: "technical",
  },
  {
    pattern: /\b(carburador|carb)\b/i,
    name: "Carburador",
    category: "engine",
    itemKind: "technical",
  },
  // Transmissão
  {
    pattern: /\b(corrente|chain)\b/i,
    name: "Corrente",
    category: "transmission",
    itemKind: "technical",
  },
  {
    pattern: /\b(kit.*(transm|relac|corrente)|relação kit)\b/i,
    name: "Kit transmissão",
    category: "transmission",
    itemKind: "technical",
  },
  {
    pattern: /\b(coroa|sprocket rear)\b/i,
    name: "Coroa",
    category: "transmission",
    itemKind: "technical",
  },
  {
    pattern: /\b(pinhão|pinhao|sprocket front)\b/i,
    name: "Pinhão",
    category: "transmission",
    itemKind: "technical",
  },
  // Freios
  {
    pattern: /\b(pastilha|pad|brake pad)\b.*\b(diant|front)\b/i,
    name: "Pastilhas dianteiras",
    category: "brakes",
    itemKind: "technical",
  },
  {
    pattern: /\b(pastilha|pad|brake pad)\b.*\b(tras|rear)\b/i,
    name: "Pastilhas traseiras",
    category: "brakes",
    itemKind: "technical",
  },
  {
    pattern: /\b(pastilha|pad)\b/i,
    name: "Pastilhas de freio",
    category: "brakes",
    itemKind: "technical",
  },
  {
    pattern: /\b(fluido|fluid)\b.*\b(freio|brake)\b/i,
    name: "Fluido de freio",
    category: "brakes",
    itemKind: "technical",
  },
  {
    pattern: /\b(disco)\b.*\b(freio|brake)\b/i,
    name: "Disco de freio",
    category: "brakes",
    itemKind: "technical",
  },
  // Suspensão
  {
    pattern: /\b(oleo|óleo)\b.*\b(garfo|fork)\b/i,
    name: "Óleo do garfo dianteiro",
    category: "suspension",
    itemKind: "technical",
  },
  {
    pattern: /\b(vedacao|vedação|seal|retentor)\b.*\b(garfo|fork)\b/i,
    name: "Vedações do garfo",
    category: "suspension",
    itemKind: "technical",
  },
  {
    pattern: /\b(amortecedor|shock)\b/i,
    name: "Amortecedor traseiro",
    category: "suspension",
    itemKind: "technical",
  },
  // Rodas / Pneus
  {
    pattern: /\b(pneu|tire|tyre)\b.*\b(diant|front)\b/i,
    name: "Pneu dianteiro",
    category: "wheels",
    itemKind: "technical",
  },
  {
    pattern: /\b(pneu|tire|tyre)\b.*\b(tras|rear)\b/i,
    name: "Pneu traseiro",
    category: "wheels",
    itemKind: "technical",
  },
  { pattern: /\b(pneu|tire|tyre)\b/i, name: "Pneu", category: "wheels", itemKind: "technical" },
  {
    pattern: /\b(camara|câmara|inner tube)\b/i,
    name: "Câmara de ar",
    category: "wheels",
    itemKind: "technical",
  },
  { pattern: /\b(raio|spoke)\b/i, name: "Raios", category: "wheels", itemKind: "technical" },
  // Elétrica
  {
    pattern: /\b(bateria|battery)\b/i,
    name: "Bateria",
    category: "electrical",
    itemKind: "technical",
  },
  {
    pattern: /\b(cabo.*vela|vela.*cabo|spark.*wire)\b/i,
    name: "Cabo de vela",
    category: "electrical",
    itemKind: "technical",
  },
  // Arrefecimento
  {
    pattern: /\b(liquido|líquido|coolant)\b.*\b(arrefec|cool)\b/i,
    name: "Líquido de arrefecimento",
    category: "cooling",
    itemKind: "technical",
  },
  { pattern: /\b(radiador)\b/i, name: "Radiador", category: "cooling", itemKind: "technical" },
  // Estrutura
  {
    pattern: /\b(guida[oõ]|handlebar|guidão)\b/i,
    name: "Guidão",
    category: "other",
    itemKind: "technical",
  },
  { pattern: /\b(manete|lever)\b/i, name: "Manetes", category: "other", itemKind: "technical" },
  {
    pattern: /\b(protetor.*motor|skid plate)\b/i,
    name: "Protetor de motor",
    category: "other",
    itemKind: "technical",
  },
  {
    pattern: /\b(plastico|plástico|carenagem)\b/i,
    name: "Plásticos / carenagens",
    category: "other",
    itemKind: "technical",
  },
  {
    pattern: /\b(graxa|grease|lubrificante|wp)\b/i,
    name: "Graxa / lubrificante",
    category: "other",
    itemKind: "technical",
  },
  {
    pattern: /\b(presilha|clamp|abraçadeira)\b/i,
    name: "Presilha / fixador",
    category: "other",
    itemKind: "technical",
  },
  // Mão de obra
  {
    pattern: /\b(m\.?o\.?|mao.?de.?obra|mão.?de.?obra|labor)\b/i,
    name: "Mão de obra",
    category: "other",
    itemKind: "labor",
  },
  {
    pattern:
      /\b(servico|serviço|instalac|instalação|montagem|desmontagem|troca.*pneu|balanceamento|alinhamento)\b/i,
    name: "Serviço",
    category: "other",
    itemKind: "labor",
  },
  // Despesas
  {
    pattern: /\b(desconto|discount|abatimento)\b/i,
    name: "Desconto",
    category: "other",
    itemKind: "expense",
  },
  {
    pattern: /\b(taxa|fee|tarifa|frete|freight)\b/i,
    name: "Taxa / frete",
    category: "other",
    itemKind: "expense",
  },
];

export async function validateImageQuality(file: File): Promise<OcrQualityResult> {
  const warnings: string[] = [];
  if (!file.type.startsWith("image/")) return { ok: true, warnings: [] };

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w < 600 || h < 400) {
        warnings.push(`Resolução baixa (${w}×${h}px). Imagens maiores geram resultados melhores.`);
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(w, 200);
      canvas.height = Math.min(h, 200);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let brightCount = 0,
          darkCount = 0;
        const total = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          const b = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (b > 180) brightCount++;
          else if (b < 80) darkCount++;
        }
        if (brightCount / total > 0.95) {
          resolve({ ok: false, warnings: ["A imagem parece toda branca. Verifique a câmera."] });
          return;
        }
        if (darkCount / total > 0.95) {
          resolve({
            ok: false,
            warnings: ["A imagem parece toda escura. Verifique a iluminação."],
          });
          return;
        }
        if (brightCount / total < 0.1 && darkCount / total < 0.1) {
          warnings.push("Contraste baixo. Tente usar boa iluminação e fundo neutro.");
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
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
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

interface RawItem {
  rawDescription: string;
  qty?: number;
  unitValue?: number;
  totalValue?: number;
}

function parseLines(text: string): RawItem[] {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 3);
  const valuePattern = /(\d+[.,]?\d*)/g;
  const items: RawItem[] = [];
  for (const line of lines) {
    if (
      /^(total|subtotal|qtd\.|un\.|vr\s|valor|item|cod|descri|data:|cnpj|cpf|emiss|fone|tel\.|end\.|rua|av\.)/i.test(
        line,
      )
    )
      continue;
    if (/^[-=*]+$/.test(line) || line.length < 5) continue;
    const numbers = [...line.matchAll(valuePattern)].map((m) => parseFloat(m[0].replace(",", ".")));
    if (numbers.length === 0) continue;
    const rawDescription = line.replace(valuePattern, "").replace(/\s+/g, " ").trim();
    if (rawDescription.length < 3) continue;
    let qty: number | undefined, unitValue: number | undefined, totalValue: number | undefined;
    if (numbers.length >= 3) {
      qty = numbers[0];
      unitValue = numbers[1];
      totalValue = numbers[numbers.length - 1];
    } else if (numbers.length === 2) {
      if (numbers[0] <= 10 && numbers[1] > numbers[0]) {
        qty = numbers[0];
        totalValue = numbers[1];
        unitValue = numbers[1] / numbers[0];
      } else {
        unitValue = numbers[0];
        totalValue = numbers[1];
      }
    } else {
      totalValue = numbers[0];
    }
    if (totalValue !== undefined && (totalValue < 0.5 || totalValue > 50000)) {
      totalValue = undefined;
      unitValue = undefined;
    }
    items.push({ rawDescription, qty, unitValue, totalValue });
  }
  return items;
}

function normalize(raw: RawItem, schedules: any[]): OcrSuggestedItem {
  for (const entry of DICT) {
    if (entry.pattern.test(raw.rawDescription)) {
      const matched = schedules.find(
        (s) =>
          s.name.toLowerCase().includes(entry.name.toLowerCase().split(" ")[0]) ||
          entry.name.toLowerCase().includes(s.name.toLowerCase().split(" ")[0]),
      );
      return {
        rawDescription: raw.rawDescription,
        normalizedName: entry.name,
        category: entry.category,
        itemKind: entry.itemKind,
        qty: raw.qty,
        unitValue: raw.unitValue,
        totalValue: raw.totalValue,
        confidence: "high",
        scheduleId: matched?.id,
        templateItemId: matched?.template_item_id,
      };
    }
  }
  return {
    rawDescription: raw.rawDescription,
    normalizedName: raw.rawDescription,
    category: "other",
    itemKind: "technical",
    qty: raw.qty,
    unitValue: raw.unitValue,
    totalValue: raw.totalValue,
    confidence: "low",
  };
}

function extractDate(text: string): string | undefined {
  const m = text.match(/(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{2,4})/);
  if (!m) return undefined;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function extractDocumentTotal(text: string): number | undefined {
  const line = text
    .split("\n")
    .find((l) => /\b(total\s*(da\s*os|geral|do\s*pedido|dos\s*serv|dos\s*mat))\b/i.test(l));
  if (!line) return undefined;
  const m = line.match(/(\d+[.,]\d{2})/g);
  return m ? parseFloat(m[m.length - 1].replace(",", ".")) : undefined;
}

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
  if (confidence < 60)
    quality.warnings.push(
      `Confiança da leitura baixa (${Math.round(confidence)}%). Revise os itens com atenção.`,
    );
  const wordCount = rawText.trim().split(/\s+/).length;
  if (wordCount < 5) {
    quality.ok = false;
    quality.warnings.push("Não conseguimos identificar texto suficiente neste documento.");
    return { quality, items: [], rawText };
  }
  const items = parseLines(rawText)
    .map((raw) => normalize(raw, schedules))
    .filter((it) => it.normalizedName.length > 2);
  return {
    quality,
    items,
    rawText,
    date: extractDate(rawText),
    documentTotal: extractDocumentTotal(rawText),
  };
}
