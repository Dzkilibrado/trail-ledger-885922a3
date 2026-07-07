import { forwardRef } from "react";
import { TBInput } from "../primitives/TBInput";

/**
 * TBCurrencyInput — valor monetário em BRL.
 * A formatação visual fica a cargo do consumidor; este componente garante
 * teclado decimal e step consistentes.
 */
export const TBCurrencyInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>((props, ref) => (
  <TBInput
    ref={ref}
    type="number"
    inputMode="decimal"
    step="0.01"
    min={0}
    {...props}
  />
));
TBCurrencyInput.displayName = "TBCurrencyInput";