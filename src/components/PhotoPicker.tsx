import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X } from "lucide-react";

/**
 * Seletor de foto principal em pt-BR, sem o texto "Escolher ficheiro" do input nativo.
 * Mostra miniatura, nome do arquivo e botão "Remover".
 */
export function PhotoPicker({
  value,
  onChange,
  label = "Selecionar foto",
  accept = "image/*",
  hint = "JPG ou PNG até 10 MB",
}: {
  value: File | null;
  onChange: (file: File | null) => void;
  label?: string;
  accept?: string;
  hint?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function pick(f: File | null) {
    onChange(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
          {preview ? (
            <img src={preview} alt="" className="h-16 w-16 rounded-lg object-cover" />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-lg bg-elevated text-muted-foreground"><Camera className="h-6 w-6" /></div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{value.name}</div>
            <div className="text-xs text-muted-foreground">{(value.size / 1024).toFixed(0)} KB</div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => pick(null)}>
            <X className="h-4 w-4" /> Remover
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-card p-4 text-left transition hover:border-primary/50"
        >
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-primary">
            <Upload className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{label}</div>
            <div className="text-xs text-muted-foreground">{hint}</div>
          </div>
        </button>
      )}
    </div>
  );
}