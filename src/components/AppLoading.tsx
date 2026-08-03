/**
 * Estado de carregamento oficial do TrailBook — nunca deixar tela preta vazia.
 */
export function AppLoading({ label = "Preparando seu TrailBook…" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6">
      <div className="text-center">
        <div className="font-display text-2xl font-bold tracking-tight text-foreground">
          TrailBook
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{label}</p>
      </div>
      <div className="w-full max-w-sm space-y-3" aria-busy>
        <div className="h-28 animate-pulse rounded-2xl bg-card" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 animate-pulse rounded-2xl bg-card" />
          <div className="h-16 animate-pulse rounded-2xl bg-card" />
        </div>
      </div>
    </div>
  );
}