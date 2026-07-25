import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { TBPdfViewer } from "@/components/pdf/TBPdfViewer";
import { RECEIPT_STATUS_LABEL, type ReceiptStatus } from "@/lib/smart-receipts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { closureBannerText, type ClosureType } from "@/lib/receipts/close-reasons";
import { CloseReceiptDialog } from "@/components/receipts/CloseReceiptDialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type SearchParams = { variant?: "signed" | "original"; from?: string };

/** Aceita apenas caminhos internos absolutos, sem esquema/host. */
function sanitizeFrom(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  if (!raw.startsWith("/") || raw.startsWith("//")) return undefined;
  if (raw.length > 300) return undefined;
  // Aceita path + query/hash mas nada além de caracteres seguros.
  if (!/^\/[A-Za-z0-9._~\-/?&=%#]*$/.test(raw)) return undefined;
  return raw;
}

export const Route = createFileRoute("/_authenticated/recibos/$code/visualizar")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    variant: search.variant === "original" ? "original" : "signed",
    from: sanitizeFrom(search.from),
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
  const { variant = "signed", from } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();

  // Busca leve só para exibir o status no cabeçalho (sem PII).
  const meta = useQuery({
    queryKey: ["receipt-meta", code],
    queryFn: async () => {
      const { data } = await supabase
        .from("smart_receipts" as never)
        .select("id, status, closure_type, seller_id, buyer_id, motorcycle_id")
        .eq("code", code)
        .maybeSingle();
      return (data as {
        id?: string;
        status?: string;
        closure_type?: ClosureType | null;
        seller_id?: string;
        buyer_id?: string | null;
        motorcycle_id?: string;
      } | null) ?? null;
    },
  });

  const uidQ = useQuery({
    queryKey: ["auth-uid"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: 60_000,
  });

  const statusLabel = meta.data?.status
    ? RECEIPT_STATUS_LABEL[meta.data.status as ReceiptStatus] ?? meta.data.status
    : null;

  const status = meta.data?.status ?? null;
  const banner = (() => {
    if (status === "cancelled") {
      return {
        text: closureBannerText(meta.data?.closure_type ?? null, status),
        tone: "destructive" as const,
      };
    }
    if (status === "revoked" || status === "superseded") {
      return { text: closureBannerText(null, status), tone: "warning" as const };
    }
    return null;
  })();

  // Papel do usuário atual para expor a ação de encerrar quando aplicável.
  const uid = uidQ.data ?? null;
  const role: "seller" | "buyer" | null =
    uid && meta.data?.seller_id === uid ? "seller"
    : uid && meta.data?.buyer_id === uid ? "buyer"
    : null;
  const canClose =
    role !== null && status !== null &&
    (role === "seller"
      ? ["draft", "issued", "awaiting_acceptance"].includes(status)
      : ["issued", "awaiting_acceptance"].includes(status));

  function goBack() {
    if (from) { navigate({ to: from }); return; }
    if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
    else navigate({ to: "/transfers", search: { receipt: code } });
  }
  function close() {
    if (from) { navigate({ to: from }); return; }
    navigate({ to: "/transfers", search: { receipt: code } });
  }

  return (
    <div className="flex h-dvh flex-col">
      <TBPdfViewer
        code={code}
        variant={variant}
        status={statusLabel}
        onBack={goBack}
        onClose={close}
        banner={banner}
      />
      {canClose && role && meta.data?.id && (
        <div className="border-t border-border bg-background px-3 py-2">
          <CloseReceiptDialog
            receiptId={meta.data.id}
            code={code}
            role={role}
            origin="receipt_view"
            motorcycleId={meta.data.motorcycle_id}
            trigger={
              <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive">
                <X className="h-4 w-4" />
                {role === "seller" ? "Cancelar processo" : "Recusar compra"}
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}