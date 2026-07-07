import { forwardRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const TBTextarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <Textarea
    ref={ref}
    className={cn("min-h-[88px] rounded-xl text-base sm:text-sm", className)}
    {...props}
  />
));
TBTextarea.displayName = "TBTextarea";