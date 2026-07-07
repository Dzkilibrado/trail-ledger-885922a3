import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const SIZE = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-6 w-6" } as const;

export function TBIcon({
  icon: Icon,
  size = "md",
  className,
}: {
  icon: LucideIcon;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return <Icon className={cn(SIZE[size], className)} aria-hidden />;
}