import { forwardRef } from "react";
import { TBNumberInput } from "./TBNumberInput";

export const TBOdometerInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>((props, ref) => (
  <TBNumberInput ref={ref} min={0} placeholder="0" {...props} />
));
TBOdometerInput.displayName = "TBOdometerInput";