import { forwardRef } from "react";
import { Search } from "lucide-react";
import { TBInput } from "../primitives/TBInput";
import { cn } from "@/lib/utils";

export const TBSearchInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, ...props }, ref) => (
  <div className="relative">
    <Search
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden
    />
    <TBInput
      ref={ref}
      type="search"
      className={cn("pl-9", className)}
      placeholder="Buscar…"
      {...props}
    />
  </div>
));
TBSearchInput.displayName = "TBSearchInput";