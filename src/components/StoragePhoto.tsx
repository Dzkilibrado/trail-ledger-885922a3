import { memo, useEffect, useState } from "react";
import { getCachedSignedUrl, signedUrl } from "@/lib/trailbook";
import { Bike } from "lucide-react";
import { cn } from "@/lib/utils";

function StoragePhotoImpl({
  bucket = "motorcycle-photos",
  path,
  className,
  alt = "",
}: { bucket?: string; path: string | null | undefined; className?: string; alt?: string }) {
  // Se já temos a URL assinada em cache, entramos com ela sincronamente para
  // evitar flicker do placeholder cinza ao navegar entre telas.
  const [url, setUrl] = useState<string | null>(() => getCachedSignedUrl(bucket, path));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFailed(false);
    const cached = getCachedSignedUrl(bucket, path);
    setUrl(cached);
    if (!path || cached) return;
    signedUrl(bucket, path).then((u) => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [bucket, path]);

  if (!url || failed) {
    return (
      <div className={cn("grid place-items-center bg-elevated text-muted-foreground", className)}>
        <Bike className="h-8 w-8 opacity-40" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className={cn("object-cover", className)}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export const StoragePhoto = memo(StoragePhotoImpl);