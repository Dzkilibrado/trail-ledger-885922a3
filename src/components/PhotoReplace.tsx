/**
 * PhotoReplace — altera a FOTO PRINCIPAL da moto com preview antes de salvar.
 * Diferente de MotorcyclePhotos (galeria geral), este componente foca em
 * "substituir a foto principal" — sem navegação, sem multi-upload.
 */
import { useRef, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile, signedUrl } from "@/lib/trailbook";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Camera, ImagePlus, Loader2, RotateCcw } from "lucide-react";

const MAX_MB = 10;

export function PhotoReplace({ motorcycleId }: { motorcycleId: string }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  const { data: currentPhoto } = useQuery({
    queryKey: ["motorcycle-primary-photo", motorcycleId],
    queryFn: async () => {
      const { data } = await supabase
        .from("motorcycle_photos")
        .select("id, storage_path, bucket, is_primary")
        .eq("motorcycle_id", motorcycleId)
        .eq("is_primary", true as never)
        .maybeSingle();
      return data ?? null;
    },
  });

  useEffect(() => {
    if (!currentPhoto) { setCurrentUrl(null); return; }
    signedUrl(currentPhoto.bucket, currentPhoto.storage_path).then(setCurrentUrl);
  }, [currentPhoto]);

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem (JPG, PNG, etc.)"); return; }
    if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Imagem muito grande (máx. ${MAX_MB} MB)`); return; }
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview({ file, url: URL.createObjectURL(file) });
    e.target.value = "";
  }

  function cancelPreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  async function confirmPhoto() {
    if (!preview) return;
    setSaving(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session!.user.id;
      const up = await uploadFile("motorcycle-photos", preview.file, uid);

      if (currentPhoto) {
        // Atualiza o storage_path da foto principal — trigger sync_primary_photo
        // cuida de sincronizar main_photo_url automaticamente
        const { error } = await supabase
          .from("motorcycle_photos")
          .update({ storage_path: up.path, bucket: up.bucket } as never)
          .eq("id", currentPhoto.id);
        if (error) throw error;
      } else {
        // Sem foto principal ainda — insere nova como principal
        const { error } = await supabase.from("motorcycle_photos").insert({
          motorcycle_id: motorcycleId,
          storage_path: up.path,
          bucket: up.bucket,
          is_primary: true,
          position: 0,
          created_by: uid,
        } as never);
        if (error) throw error;
      }

      toast.success("Foto da moto atualizada.");
      URL.revokeObjectURL(preview.url);
      setPreview(null);
      // Invalida queries sem navegar
      qc.invalidateQueries({ queryKey: ["motorcycle-primary-photo", motorcycleId] });
      qc.invalidateQueries({ queryKey: ["motorcycle-photos", motorcycleId] });
      qc.invalidateQueries({ queryKey: ["motorcycle", motorcycleId] });
    } catch (e: any) {
      toast.error("Não foi possível atualizar a foto.", { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  const displayUrl = preview ? preview.url : currentUrl;

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-muted w-full" style={{ aspectRatio: "16/9", maxHeight: "12rem" }}>
        {displayUrl ? (
          <img src={displayUrl} alt="Foto da moto" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Camera className="h-8 w-8 opacity-40" />
            <span className="text-xs">Sem foto</span>
          </div>
        )}
        {preview && (
          <span className="absolute left-2 top-2 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            Prévia
          </span>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={onFileSelected} />

      {preview ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="flex-1 btn-glow" onClick={confirmPhoto} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Atualizando…</> : "Usar esta foto"}
          </Button>
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-1" />Escolher outra
          </Button>
          <Button type="button" variant="ghost" onClick={cancelPreview} disabled={saving}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
          <ImagePlus className="h-4 w-4 mr-1" />
          {currentPhoto ? "Alterar foto" : "Adicionar foto"}
        </Button>
      )}
    </div>
  );
}
