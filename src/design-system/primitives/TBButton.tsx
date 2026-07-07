import { forwardRef } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * TBButton — botão oficial TrailBook.
 * Garante altura mínima de 44px (área de toque) e radius-xl.
 */
export const TBButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size = "default", ...props }, ref) => (
    <Button
      ref={ref}
      size={size}
      className={cn(
        "min-h-[44px] rounded-xl text-sm font-semibold",
        className,
      )}
      {...props}
    />
  ),
);
TBButton.displayName = "TBButton";