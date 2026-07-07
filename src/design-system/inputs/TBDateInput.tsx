import { forwardRef } from "react";
import { TBInput } from "../primitives/TBInput";

export const TBDateInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>((props, ref) => <TBInput ref={ref} type="date" {...props} />);
TBDateInput.displayName = "TBDateInput";