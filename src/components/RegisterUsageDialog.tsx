import { TBDialog } from "@/design-system";
import type { Motorcycle } from "@/lib/trailbook";
import { RegisterUsageForm } from "@/components/RegisterUsageForm";

export function RegisterUsageDialog({ moto, onClose }: { moto: Motorcycle | null; onClose: () => void }) {
  return (
    <TBDialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Registrar Uso"
      description={moto?.nickname || moto?.model || "Motocicleta ativa"}
    >
      <RegisterUsageForm moto={moto} onClose={onClose} />
    </TBDialog>
  );
}
