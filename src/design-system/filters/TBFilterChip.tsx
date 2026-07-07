import { TBChip } from "../primitives/TBChip";

export function TBFilterChip({
  label,
  active,
  onToggle,
  count,
}: {
  label: string;
  active?: boolean;
  onToggle?: () => void;
  count?: number;
}) {
  return (
    <TBChip active={active} onClick={onToggle}>
      {label}
      {typeof count === "number" && (
        <span className="ml-1 opacity-70">({count})</span>
      )}
    </TBChip>
  );
}