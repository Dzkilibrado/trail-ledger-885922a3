import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type TBSelectOption = { value: string; label: string };

export function TBSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  id,
  disabled,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  options: TBSelectOption[];
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        id={id}
        className={cn("h-11 rounded-xl text-base sm:h-10 sm:text-sm", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}