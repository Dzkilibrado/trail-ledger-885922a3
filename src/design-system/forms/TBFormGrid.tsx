import { cn } from "@/lib/utils";

/**
 * TBFormGrid — grid oficial de formulários TrailBook.
 * Mobile: 2 colunas. Desktop (sm+): 4 colunas.
 * `items-end` mantém inputs alinhados quando um label é maior.
 */
export function TBFormGrid({
  columns = 4,
  className,
  children,
}: {
  /** número de colunas no desktop (mobile é sempre 2) */
  columns?: 2 | 3 | 4;
  className?: string;
  children: React.ReactNode;
}) {
  const desktopCols =
    columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4";
  return (
    <div
      className={cn(
        "grid grid-cols-2 items-end gap-x-3 gap-y-3",
        desktopCols,
        className,
      )}
    >
      {children}
    </div>
  );
}