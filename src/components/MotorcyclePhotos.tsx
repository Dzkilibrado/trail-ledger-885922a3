import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile, signedUrl } from "@/lib/trailbook";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Camera, ImagePlus, Star, StarOff, Trash2, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEffect } from "react";

type Photo = {
  id: string;
  motorcycle_id: string;
  bucket: string;
  storage_path: string;
  kind: "photo" | "video";
  caption: string | null;
  position: number;
  is_primary: boolean;
  created_at: string;
};

const MAX_MB = 10;

export function MotorcyclePhotos({ motorcycleId }: { motorcycleId: string }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [toDelete, setToDelete] = useState<Photo | null>(null);

  const q = useQuery({
    queryKey: ["motorcycle-photos", motorcycleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorcycle_photos")
        .select("*")
        .eq("motorcycle_id", motorcycleId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Photo[];
    },
  });

  const photos = q.data ?? [];
  const hasPrimary = useMemo(() => photos.some((p) => p.is_primary), [photos]);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      let base = photos.length;
      const willBePrimary = !hasPrimary && photos.length === 0;
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) { toast.error(`${file.name}: apenas imagens`); continue; }
        if (file.size > MAX_MB * 1024 * 1024) { toast.error(`${file.name}: máx ${MAX_MB} MB`); continue; }
        const up = await uploadFile("motorcycle-photos", file, uid);
        const { error } = await supabase.from("motorcycle_photos").insert({
          motorcycle_id: motorcycleId,
          storage_path: up.path,
          bucket: up.bucket,
          position: base++,
          is_primary: willBePrimary && base === 1,
          created_by: uid,
        } as never);
        if (error) throw error;
      }
      toast.success("Fotos adicionadas");
      qc.invalidateQueries({ queryKey: ["motorcycle-photos", motorcycleId] });
      qc.invalidateQueries({ queryKey: ["motorcycle", motorcycleId] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const setPrimary = useMutation({
    mutationFn: async (photo: Photo) => {
      const { error } = await supabase
        .from("motorcycle_photos")
        .update({ is_primary: true } as never)
        .eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Foto principal atualizada");
      qc.invalidateQueries({ queryKey: ["motorcycle-photos", motorcycleId] });
      qc.invalidateQueries({ queryKey: ["motorcycle", motorcycleId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const move = useMutation({
    mutationFn: async ({ photo, dir }: { photo: Photo; dir: -1 | 1 }) => {
      const idx = photos.findIndex((p) => p.id === photo.id);
      const swap = photos[idx + dir];
      if (!swap) return;
      const a = supabase.from("motorcycle_photos").update({ position: swap.position } as never).eq("id", photo.id);
      const b = supabase.from("motorcycle_photos").update({ position: photo.position } as never).eq("id", swap.id);
      const [r1, r2] = await Promise.all([a, b]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["motorcycle-photos", motorcycleId] }),
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  async function remove(photo: Photo) {
    try {
      await supabase.storage.from(photo.bucket).remove([photo.storage_path]).catch(() => null);
      const { error } = await supabase.from("motorcycle_photos").delete().eq("id", photo.id);
      if (error) throw error;
      // Se removeu a principal, promove a próxima
      if (photo.is_primary) {
        const remaining = photos.filter((p) => p.id !== photo.id);
        if (remaining[0]) {
          await supabase.from("motorcycle_photos").update({ is_primary: true } as never).eq("id", remaining[0].id);
        } else {
          await supabase.from("motorcycles").update({ main_photo_url: null } as never).eq("id", motorcycleId);
        }
      }
      toast.success("Foto removida");
      qc.invalidateQueries({ queryKey: ["motorcycle-photos", motorcycleId] });
      qc.invalidateQueries({ queryKey: ["motorcycle", motorcycleId] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao remover");
    } finally {
      setToDelete(null);
    }
  }

  return (
    <section className="surface-elevated rounded-2xl p-5 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" /> Fotos da moto
          </h2>
          <p className="text-xs text-muted-foreground">
            {photos.length === 0 ? "Nenhuma foto ainda." : `${photos.length} foto(s). A principal aparece no card e no certificado.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => onFiles(e.target.files)}
          />
          <Button size="sm" className="btn-glow" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {uploading ? "Enviando…" : "Adicionar fotos"}
          </Button>
        </div>
      </header>

      {photos.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="grid w-full place-items-center rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground transition hover:border-primary/50"
        >
          <ImagePlus className="mb-2 h-8 w-8 opacity-60" />
          Clique para adicionar fotos (JPG/PNG, até {MAX_MB} MB cada)
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, i) => (
            <PhotoTile
              key={p.id}
              photo={p}
              first={i === 0}
              last={i === photos.length - 1}
              onSetPrimary={() => setPrimary.mutate(p)}
              onMoveLeft={() => move.mutate({ photo: p, dir: -1 })}
              onMoveRight={() => move.mutate({ photo: p, dir: 1 })}
              onDelete={() => setToDelete(p)}
            />
          ))}
        </ul>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta foto?</AlertDialogTitle>
            <AlertDialogDescription>
              A imagem será excluída permanentemente do armazenamento. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && remove(toDelete)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function PhotoTile({
  photo, first, last, onSetPrimary, onMoveLeft, onMoveRight, onDelete,
}: {
  photo: Photo; first: boolean; last: boolean;
  onSetPrimary: () => void; onMoveLeft: () => void; onMoveRight: () => void; onDelete: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFailed(false);
    setUrl(null);
    signedUrl(photo.bucket, photo.storage_path).then((u) => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [photo.bucket, photo.storage_path]);

  return (
    <li className={`group relative overflow-hidden rounded-xl border ${photo.is_primary ? "border-primary" : "border-border"} bg-elevated`}>
      <div className="aspect-square w-full bg-muted">
        {url && !failed ? (
          <img src={url} alt={photo.caption ?? ""} className="h-full w-full object-cover" loading="lazy" onError={() => setFailed(true)} />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            {failed ? <Camera className="h-5 w-5 opacity-40" /> : <Loader2 className="h-5 w-5 animate-spin" />}
          </div>
        )}
      </div>
      {photo.is_primary && (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
          <Star className="h-3 w-3" /> Principal
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        <div className="flex gap-1">
          <IconBtn label="Mover para esquerda" onClick={onMoveLeft} disabled={first}>
            <ArrowLeft className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn label="Mover para direita" onClick={onMoveRight} disabled={last}>
            <ArrowRight className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
        <div className="flex gap-1">
          {!photo.is_primary ? (
            <IconBtn label="Definir como principal" onClick={onSetPrimary}>
              <Star className="h-3.5 w-3.5" />
            </IconBtn>
          ) : (
            <IconBtn label="Já é a principal" disabled>
              <StarOff className="h-3.5 w-3.5" />
            </IconBtn>
          )}
          <IconBtn label="Remover foto" onClick={onDelete} destructive>
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      </div>
    </li>
  );
}

function IconBtn({ children, label, onClick, disabled, destructive }: {
  children: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean; destructive?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid h-7 w-7 place-items-center rounded-md border border-white/20 bg-black/60 text-white transition hover:bg-black/80 disabled:opacity-30 ${destructive ? "hover:bg-destructive/80" : ""}`}
    >
      {children}
    </button>
  );
}