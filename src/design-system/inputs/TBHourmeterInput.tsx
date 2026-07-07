import { forwardRef } from "react";
import { TBNumberInput } from "./TBNumberInput";

/**
 * TBHourmeterInput — horímetro em horas (aceita decimal).
 */
export const TBHourmeterInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>((props, ref) => (
  <TBNumberInput ref={ref} allowDecimal min={0} placeholder="0,0" {...props} />
));
TBHourmeterInput.displayName = "TBHourmeterInput";