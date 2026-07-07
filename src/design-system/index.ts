// Barrel export oficial do TrailBook Design System.
// Regra: telas SEMPRE importam daqui, nunca de @/components/ui/* para
// reproduzir os padrões abaixo. Ver src/design-system/tokens/README.md.

// Forms
export { TBFormField } from "./forms/TBFormField";
export { TBFormGrid } from "./forms/TBFormGrid";
export { TBFormSection } from "./forms/TBFormSection";
export { TBFormActions } from "./forms/TBFormActions";

// Primitives
export { TBButton } from "./primitives/TBButton";
export { TBInput } from "./primitives/TBInput";
export { TBTextarea } from "./primitives/TBTextarea";
export { TBSelect, type TBSelectOption } from "./primitives/TBSelect";
export { TBBadge, type TBSeverity } from "./primitives/TBBadge";
export { TBChip } from "./primitives/TBChip";
export { TBIcon } from "./primitives/TBIcon";

// Inputs especializados
export { TBNumberInput } from "./inputs/TBNumberInput";
export { TBCurrencyInput } from "./inputs/TBCurrencyInput";
export { TBDateInput } from "./inputs/TBDateInput";
export { TBHourmeterInput } from "./inputs/TBHourmeterInput";
export { TBOdometerInput } from "./inputs/TBOdometerInput";
export { TBSearchInput } from "./inputs/TBSearchInput";

// Layout
export { TBPageHeader } from "./layout/TBPageHeader";
export { TBSectionHeader } from "./layout/TBSectionHeader";
export { TBCard } from "./layout/TBCard";
export { TBStatusCard } from "./layout/TBStatusCard";
export { TBInfoCard } from "./layout/TBInfoCard";
export { TBActionCard } from "./layout/TBActionCard";
export { TBKpiCard } from "./layout/TBKpiCard";
export { TBTimelineItem } from "./layout/TBTimelineItem";

// Overlays
export { TBBottomSheet } from "./overlays/TBBottomSheet";
export { TBDrawer } from "./overlays/TBDrawer";
export { TBDialog } from "./overlays/TBDialog";

// Feedback / estados
export { TBEmptyState } from "./feedback/TBEmptyState";
export { TBLoadingState } from "./feedback/TBLoadingState";
export { TBErrorState } from "./feedback/TBErrorState";
export { TBSuccessState } from "./feedback/TBSuccessState";
export { TBInfoState } from "./feedback/TBInfoState";
export { TBWarningState } from "./feedback/TBWarningState";

// Filtros
export { TBFilterBar } from "./filters/TBFilterBar";
export { TBFilterChip } from "./filters/TBFilterChip";