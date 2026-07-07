import { forwardRef } from "react";
import { TBInput } from "../primitives/TBInput";

/**
 * TBNumberInput — número inteiro/decimal com teclado numérico no mobile.
 */
export const TBNumberInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
    allowDecimal?: boolean;
  }
>(({ allowDecimal = false, inputMode, ...props }, ref) => (
  <TBInput
    ref={ref}
    type="number"
    inputMode={inputMode ?? (allowDecimal ? "decimal" : "numeric")}
    step={allowDecimal ? "0.01" : "1"}
    {...props}
  />
));
TBNumberInput.displayName = "TBNumberInput";