import { useEffect, useState } from "react";
import { signedUrl } from "@/lib/trailbook";
import { Bike } from "lucide-react";
import { cn } from "@/lib/utils";

export function StoragePhoto({
  bucket = "motorcycle-photos",
  path,
  className,
  alt = "",
}: { bucket?: string; path: string | null | undefined; className?: string; alt?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFailed(false);
    setUrl(null);
    if (!path) { setUrl(null); return; }
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
      onError={() => setFailed(true)}
    />
  );
}