import { Skeleton } from "@/components/ui/skeleton";

// Skeletons padronizados do TrailBook (Sprint v1.6 — Bloco B).
// Reduzem flicker e comunicam a estrutura da tela antes dos dados chegarem.
// Regra: nunca usar texto "Carregando…" em telas principais — usar skeleton.

export function ListRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="surface-elevated divide-y divide-border rounded-2xl" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  );
}

export function CardBlockSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`surface-elevated rounded-2xl p-4 ${className}`} aria-hidden="true">
      <Skeleton className="h-5 w-1/3" />
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3.5 w-3/5" />
      </div>
    </div>
  );
}

export function MotoGridSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="surface-elevated overflow-hidden rounded-2xl">
          <Skeleton className="h-44 w-full rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-hidden="true">
      <CardBlockSkeleton />
      <CardBlockSkeleton />
      <ListRowsSkeleton rows={3} />
    </div>
  );
}

export function PageLineSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}