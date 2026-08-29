import { useState, useRef } from "react";
import {
  Camera,
  FileText,
  Upload,
  X,
  Check,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MAINT_CATEGORY_LABEL, type MaintenanceCategory } from "@/lib/trailbook";
import {
  validateImageQuality,
  runOcr,
  type OcrSuggestedItem,
  type OcrResult,
} from "@/lib/ocr-engine";
import type { MaintenanceItem } from "./types-registrar";

const CATEGORY_ICON: Record<MaintenanceCategory, string> = {
  engine: "🔧",
  transmission: "⛓",
  brakes: "🛑",
  suspension: "🔩",
  wheels: "🛞",
  electrical: "⚡",
  cooling: "🌡",
  other: "🔩",
};

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];

const ACCEPTED_LABEL = "PDF, JPG, PNG, WEBP";

type OcrStep = "idle" | "validating" | "processing" | "review" | "error";

interface EditingItem extends OcrSuggestedItem {
  selected: boolean;
}

export function OcrUploader({
  schedules,
  onConfirm,
  onCancel,
}: {
  schedules: any[];
  onConfirm: (items: Partial<MaintenanceItem>[], date?: string) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<OcrStep>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [editingItems, setEditingItems] = useState<EditingItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  async function processFile(f: File) {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setErrorMsg(
        `Formato não suportado. Use: ${ACCEPTED_LABEL}.\nDOC/DOCX podem ser anexados à atividade, mas não têm leitura automática.`,
      );
      setStep("error");
      return;
    }
    setFile(f);
    setStep("validating");
    setWarnings([]);

    // Validação de qualidade (apenas imagens)
    const quality = await validateImageQuality(f);
    if (!quality.ok) {
      setErrorMsg(quality.warnings.join("\n"));
      setStep("error");
      return;
    }
    if (quality.warnings.length > 0) setWarnings(quality.warnings);

    setStep("processing");
    try {
      const ocrResult = await runOcr(f, schedules);

      if (!ocrResult.quality.ok) {
        setErrorMsg(ocrResult.quality.warnings.join("\n"));
        setStep("error");
        return;
      }

      if (ocrResult.quality.warnings.length > 0) {
        setWarnings((prev) => [...prev, ...ocrResult.quality.warnings]);
      }

      if (ocrResult.items.length === 0) {
        setErrorMsg(
          "Não encontramos itens reconhecíveis neste documento.\nVerifique se é uma Nota Fiscal, Ordem de Serviço ou Cupom Fiscal.",
        );
        setStep("error");
        return;
      }

      setResult(ocrResult);
      setEditingItems(
        ocrResult.items.map((it) => ({
          ...it,
          selected: it.confidence !== "low",
        })),
      );
      setStep("review");
    } catch (err: any) {
      setErrorMsg(`Erro ao processar: ${err.message}`);
      setStep("error");
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = "";
  }

  function updateItem(idx: number, patch: Partial<EditingItem>) {
    setEditingItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function confirm() {
    const selected = editingItems
      .filter((it) => it.selected)
      .map((it) => ({
        service: it.normalizedName,
        category: it.category,
        itemKind: it.itemKind,
        qty: it.qty,
        unitValue:
          it.unitValue ?? (it.totalValue && it.qty ? it.totalValue / it.qty : it.totalValue),
        scheduleId: it.scheduleId,
        templateItemId: it.templateItemId,
      }));
    onConfirm(selected, result?.date);
  }

  // ---- tela inicial ----
  if (step === "idle") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          Selecione o documento da oficina para preencher os itens automaticamente. Você revisa tudo
          antes de salvar.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => cameraRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card py-6 hover:border-primary/50 active:scale-95 transition"
          >
            <Camera className="h-8 w-8 text-primary" />
            <span className="text-sm font-semibold">Tirar foto</span>
            <span className="text-[11px] text-muted-foreground">Câmera do celular</span>
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card py-6 hover:border-primary/50 active:scale-95 transition"
          >
            <Upload className="h-8 w-8 text-primary" />
            <span className="text-sm font-semibold">Selecionar arquivo</span>
            <span className="text-[11px] text-muted-foreground">{ACCEPTED_LABEL}</span>
          </button>
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-3 text-[11px] text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">
            Documentos aceitos para leitura automática:
          </p>
          <p>✅ Nota Fiscal · Cupom Fiscal · Ordem de Serviço (impresso)</p>
          <p>❌ Manuscritos · fotos desfocadas · DOC/DOCX (apenas anexo)</p>
        </div>

        <button
          onClick={onCancel}
          className="w-full text-xs text-muted-foreground hover:text-foreground underline"
        >
          Continuar preenchendo manualmente
        </button>

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="sr-only"
          onChange={handleFile}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={handleFile}
        />
      </div>
    );
  }

  // ---- validando / processando ----
  if (step === "validating" || step === "processing") {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium">
          {step === "validating" ? "Verificando qualidade da imagem…" : "Lendo o documento…"}
        </p>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          {step === "processing" &&
            "Isso pode levar alguns segundos. O processamento é feito no próprio celular."}
        </p>
        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 w-full">
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-300">
                {w}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---- erro ----
  if (step === "error") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-destructive font-semibold">
            <AlertTriangle className="h-5 w-5" />
            <span>Não foi possível ler o documento</span>
          </div>
          {errorMsg.split("\n").map((line, i) => (
            <p key={i} className="text-sm text-muted-foreground">
              {line}
            </p>
          ))}
        </div>

        <div className="space-y-2">
          <Button
            onClick={() => {
              setStep("idle");
              setFile(null);
              setErrorMsg("");
            }}
            className="w-full"
            variant="outline"
          >
            <Camera className="h-4 w-4" /> Tentar novamente
          </Button>
          <button
            onClick={onCancel}
            className="w-full text-xs text-muted-foreground hover:text-foreground underline"
          >
            Continuar preenchendo manualmente
          </button>
        </div>
      </div>
    );
  }

  // ---- revisão ----
  if (step === "review" && result) {
    const selectedCount = editingItems.filter((it) => it.selected).length;
    return (
      <div className="space-y-4">
        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-300">
                ⚠️ {w}
              </p>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">
            Encontramos {editingItems.length} item{editingItems.length > 1 ? "s" : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {selectedCount} selecionado{selectedCount !== 1 ? "s" : ""}
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Revise, corrija se necessário e selecione o que deseja adicionar.
        </p>

        <div className="max-h-[45vh] overflow-y-auto space-y-2 pr-1">
          {editingItems.map((item, idx) => (
            <div
              key={idx}
              className={cn(
                "rounded-xl border p-3 space-y-2 transition",
                item.selected
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card opacity-60",
              )}
            >
              <div className="flex items-start gap-2">
                <button
                  onClick={() => updateItem(idx, { selected: !item.selected })}
                  className={cn(
                    "mt-0.5 h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition",
                    item.selected ? "border-primary bg-primary" : "border-border",
                  )}
                >
                  {item.selected && <Check className="h-3 w-3 text-white" />}
                </button>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {/* Nome normalizado (editável) */}
                  <Input
                    value={item.normalizedName}
                    onChange={(e) => updateItem(idx, { normalizedName: e.target.value })}
                    className="h-8 text-sm font-medium"
                  />

                  {item.confidence === "low" && (
                    <p className="text-[10px] text-amber-400">
                      ⚠️ Não identificado automaticamente — revise o nome e a categoria
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {/* Categoria */}
                    <span className="text-[11px] rounded-full border border-border px-2 py-0.5">
                      {CATEGORY_ICON[item.category]} {MAINT_CATEGORY_LABEL[item.category]}
                    </span>
                    {/* Tipo */}
                    <span
                      className={cn(
                        "text-[11px] rounded-full border px-2 py-0.5",
                        item.itemKind === "labor"
                          ? "border-amber-500/40 text-amber-400"
                          : item.itemKind === "expense"
                            ? "border-blue-500/40 text-blue-400"
                            : "border-border",
                      )}
                    >
                      {item.itemKind === "labor"
                        ? "Mão de obra"
                        : item.itemKind === "expense"
                          ? "Despesa"
                          : "Peça"}
                    </span>
                  </div>

                  {/* Valores */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Qtd</p>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={item.qty ?? ""}
                        onChange={(e) =>
                          updateItem(idx, {
                            qty: e.target.value ? parseFloat(e.target.value) : undefined,
                          })
                        }
                        className="h-7 text-xs"
                        placeholder="—"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Vl unit (R$)</p>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={item.unitValue ?? ""}
                        onChange={(e) =>
                          updateItem(idx, {
                            unitValue: e.target.value ? parseFloat(e.target.value) : undefined,
                          })
                        }
                        className="h-7 text-xs"
                        placeholder="—"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Total (R$)</p>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={item.totalValue ?? ""}
                        onChange={(e) =>
                          updateItem(idx, {
                            totalValue: e.target.value ? parseFloat(e.target.value) : undefined,
                          })
                        }
                        className="h-7 text-xs"
                        placeholder="—"
                      />
                    </div>
                  </div>

                  {/* Texto original */}
                  <p className="text-[10px] text-muted-foreground/60 italic truncate">
                    Original: {item.rawDescription}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {result.documentTotal && (
          <p className="text-xs text-muted-foreground text-right">
            Total do documento: <strong>R$ {result.documentTotal.toFixed(2)}</strong>
          </p>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setStep("idle");
              setFile(null);
            }}
            className="flex-1"
          >
            Nova leitura
          </Button>
          <Button
            onClick={confirm}
            disabled={selectedCount === 0}
            className="flex-1 btn-glow disabled:opacity-40"
          >
            Adicionar {selectedCount} item{selectedCount !== 1 ? "s" : ""}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <button
          onClick={onCancel}
          className="w-full text-xs text-muted-foreground hover:text-foreground underline"
        >
          Cancelar e preencher manualmente
        </button>
      </div>
    );
  }

  return null;
}
