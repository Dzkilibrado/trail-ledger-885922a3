import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { TBPdfViewer } from "@/components/pdf/TBPdfViewer";
import { RECEIPT_STATUS_LABEL, type ReceiptStatus } from "@/lib/smart-receipts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type SearchParams = { variant?: "signed" | "original" };

export const Route = createFileRoute("/_authenticated/recibos/$code/visualizar")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    variant: search.variant === "original" ? "original" : "signed",
  }),
  head: ({ params }) => ({
    meta: [
      { title: `Visualizar recibo ${params.code} — TrailBook` },
      { name: "description", content: `Visualização controlada do Recibo Inteligente ${params.code}.` },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ReceiptViewer,
});

function ReceiptViewer() {
  const { code } = Route.useParams();
  const { variant = "signed" } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();

  // Busca leve só para exibir o status no cabeçalho (sem PII).
  const meta = useQuery({
    queryKey: ["receipt-meta", code],
    queryFn: async () => {
      const { data } = await supabase
        .from("smart_receipts" as never)
        .select("status")
        .eq("code", code)
        .maybeSingle();
      return (data as { status?: string } | null) ?? null;
    },
  });
  const statusLabel = meta.data?.status
    ? RECEIPT_STATUS_LABEL[meta.data.status as ReceiptStatus] ?? meta.data.status
    : null;

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
    else navigate({ to: "/central" });
  }
  function close() { navigate({ to: "/central" }); }

  return (
    <TBPdfViewer
      code={code}
      variant={variant}
      status={statusLabel}
      onBack={goBack}
      onClose={close}
    />
  );
}