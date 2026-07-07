import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * TBDrawer — drawer lateral (desktop). Para mobile use TBBottomSheet.
 */
export function TBDrawer({
  open,
  onOpenChange,
  title,
  description,
  side = "right",
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  side?: "left" | "right";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn("w-full max-w-md overflow-y-auto", className)}
      >
        {(title || description) && (
          <SheetHeader className="text-left">
            {title && <SheetTitle>{title}</SheetTitle>}
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
        )}
        <div className="pt-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}