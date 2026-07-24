// Registro global mínimo de trabalho em andamento — puramente em memória.
const sources = new Set<string>();
let uploadCount = 0;

export function registerDirtySource(key: string): () => void {
  sources.add(key);
  return () => {
    sources.delete(key);
  };
}

export function beginUpload(): () => void {
  uploadCount += 1;
  return () => {
    uploadCount = Math.max(0, uploadCount - 1);
  };
}

export function hasUnsavedWork(): boolean {
  return sources.size > 0 || uploadCount > 0;
}

export function listDirtySources(): string[] {
  return Array.from(sources);
}