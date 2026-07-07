import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const TBInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <Input
    ref={ref}
    className={cn("h-11 rounded-xl text-base sm:h-10 sm:text-sm", className)}
    {...props}
  />
));
TBInput.displayName = "TBInput";