import { RECEIPT_STATUS_LABEL, RECEIPT_STATUS_TONE, type ReceiptStatus } from "@/lib/smart-receipts";
import { cn } from "@/lib/utils";

export function ReceiptStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = (status ?? "issued") as ReceiptStatus;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
      RECEIPT_STATUS_TONE[s] ?? RECEIPT_STATUS_TONE.issued,
      className,
    )}>
      {RECEIPT_STATUS_LABEL[s] ?? status}
    </span>
  );
}