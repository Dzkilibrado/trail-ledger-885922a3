import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * TBFormField — campo padrão TrailBook.
 *
 * Label uppercase, single-line, altura reservada — todos os campos numa
 * TBFormGrid ficam alinhados na mesma baseline mesmo se um label for maior.
 * Suporta hint (texto de apoio) e error (mensagem de erro).
 */
export function TBFormField({
  label,
  hint,
  error,
  htmlFor,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label
        htmlFor={htmlFor}
        className="min-h-[1rem] truncate text-[11px] uppercase tracking-widest text-muted-foreground"
      >
        {label}
      </Label>
      {children}
      {hint && !error && (
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p className="text-xs leading-relaxed text-destructive">{error}</p>
      )}
    </div>
  );
}