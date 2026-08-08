import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import {
  createReceiptDraft,
  updateReceiptDraft,
  generateReceiptPdf,
  attachSignedReceipt,
  acceptSignedReceipt,
  completeReceiptTransfer,
  cancelDraftReceipt,
  getReceiptPdfBytes,
  getConfirmedBuyerDetails,
} from "@/lib/smart-receipts.functions";
import { toast } from "sonner";
import {
  FileSignature,
  Search,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Upload,
  Download,
  XCircle,
  Eye,
  Share2,
  Printer,
  Clock,
  FileText,
  PenLine,
} from "lucide-react";
import {
  formatCurrencyBRL,
  publicReceiptUrl,
  RECEIPT_STATUS_LABEL,
  type ReceiptStatus,
} from "@/lib/smart-receipts";
import { HelpTooltip } from "@/components/HelpTooltip";
import { HELP } from "@/lib/help/texts";
import { LocationPicker } from "@/components/LocationPicker";
import { useProfileSnapshot } from "@/hooks/useProfileSnapshot";
import { ProfileDataChip } from "@/components/ProfileDataChip";
import {
  isStaleStateError,
  staleStateUserMessage,
  stripStaleStatePrefix,
} from "@/lib/errors/stale-state";
import { isValidCPF, maskCPF, onlyDigits } from "@/lib/br-validators";

const PAYMENT_METHODS = [
  "Dinheiro",
  "PIX",
  "Transferência bancária",
  "Financiamento",
  "Cartão",
  "Outro",
];

type BuyerLookup = {
  id: string;
  full_name: string;
  email_masked: string | null;
  cpf_masked: string | null;
} | null;
type ReceiptRow = {
  id: string;
  code: string;
  status: string;
  version: number;
  buyer_id: string | null;
  seller_id: string;
  external_buyer: boolean;
  buyer_snapshot: { full_name?: string; cpf?: string | null; email?: string | null } | null;
  negotiation: {
    amount?: number;
    payment_method?: string;
    date?: string;
    location?: string | null;
    notes?: string | null;
  } | null;
  signed_pdf_path: string | null;
  seller_accepted_at: string | null;
  buyer_accepted_at: string | null;
};

function makeReceiptRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function supportCodeFromRequestId(requestId: string): string {
  const compact = requestId.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `SR-${compact.slice(0, 8).padEnd(8, "0")}`;
}

function extractSupportMessage(message: string, requestId: string): string {
  if (/Código:\s*SR-[A-Z0-9]+/i.test(message)) return message;
  return `Não foi possível gerar o PDF. Código: ${supportCodeFromRequestId(requestId)}`;
}

export function EmitReceiptDialog({
  motorcycleId,
  receiptId,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onIssued,
}: {
  motorcycleId: string;
  receiptId?: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  onIssued?: (url: string) => void;
}) {
  const qc = useQueryClient();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (v: boolean) => {
    onOpenChange?.(v);
    setUncontrolledOpen(v);
  };

  const [step, setStep] = useState(1);
  const [currentReceiptId, setCurrentReceiptId] = useState<string | null>(receiptId ?? null);
  const [currentReceipt, setCurrentReceipt] = useState<ReceiptRow | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [buyerMode, setBuyerMode] = useState<"tb" | "external">("tb");
  const [buyerSearch, setBuyerSearch] = useState("");
  const [buyerFound, setBuyerFound] = useState<BuyerLookup>(null);
  const [buyerCandidate, setBuyerCandidate] = useState<BuyerLookup>(null);
  const [buyerName, setBuyerName] = useState("");
  const [buyerCpf, setBuyerCpf] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("PIX");
  const [paymentOther, setPaymentOther] = useState("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  // Marca se o campo Local foi pré-preenchido a partir do perfil do vendedor
  // (para exibir o chip explicativo). Reseta quando o usuário edita.
  const [locationFromProfile, setLocationFromProfile] = useState(false);
  const [notes, setNotes] = useState("");
  const [lgpd, setLgpd] = useState(false);
  const [loading, setLoading] = useState(false);

  const createDraft = useServerFn(createReceiptDraft);
  const updateDraft = useServerFn(updateReceiptDraft);
  const genPdf = useServerFn(generateReceiptPdf);
  const attach = useServerFn(attachSignedReceipt);
  const accept = useServerFn(acceptSignedReceipt);
  const complete = useServerFn(completeReceiptTransfer);
  const cancelDraft = useServerFn(cancelDraftReceipt);
  const pdfBytesFn = useServerFn(getReceiptPdfBytes);
  const navigate = useNavigate();
  const confirmBuyerFn = useServerFn(getConfirmedBuyerDetails);
  const profileQ = useProfileSnapshot();

  useEffect(() => {
    if (!open) return;
    supabase.auth.getSession().then(({ data }) => setCurrentUserId(data.session?.user.id ?? null));
  }, [open]);

  // Pré-preenche "Local da negociação" com a Cidade/UF do perfil do vendedor
  // somente quando: dialog aberto, novo recibo (sem receiptId), campo vazio
  // e snapshot disponível. Não sobrescreve rascunhos nem edições em andamento.
  useEffect(() => {
    if (!open) return;
    if (currentReceiptId) return; // rascunho/edição: respeita valor salvo
    if (location) return; // já digitado nesta sessão
    const loc = profileQ.data?.location;
    if (loc) {
      setLocation(loc);
      setLocationFromProfile(true);
    }
  }, [open, currentReceiptId, location, profileQ.data?.location]);

  useEffect(() => {
    setCurrentReceiptId(receiptId ?? null);
  }, [receiptId]);

  async function reloadReceipt(id: string) {
    const { data, error } = await supabase
      .from("smart_receipts" as never)
      .select(
        "id, code, status, version, buyer_id, seller_id, external_buyer, buyer_snapshot, negotiation, signed_pdf_path, seller_accepted_at, buyer_accepted_at",
      )
      .eq("id", id)
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    const r = data as unknown as ReceiptRow;
    setCurrentReceipt(r);
    return r;
  }

  useEffect(() => {
    if (!open || !currentReceiptId) return;
    (async () => {
      const r = await reloadReceipt(currentReceiptId);
      if (!r) return;
      setBuyerName(r.buyer_snapshot?.full_name ?? "");
      setBuyerCpf(r.buyer_snapshot?.cpf ?? "");
      setBuyerEmail(r.buyer_snapshot?.email ?? "");
      setBuyerMode(r.external_buyer ? "external" : "tb");
      if (r.buyer_id) {
        const rawEmail = r.buyer_snapshot?.email ?? null;
        setBuyerFound({
          id: r.buyer_id,
          full_name: r.buyer_snapshot?.full_name ?? "",
          email_masked: rawEmail
            ? `${rawEmail.slice(0, 1)}***@${rawEmail.split("@")[1] ?? ""}`
            : null,
          cpf_masked: r.buyer_snapshot?.cpf
            ? `***.***.***-${r.buyer_snapshot.cpf.replace(/\D/g, "").slice(-2)}`
            : null,
        });
      }
      setAmount(String(r.negotiation?.amount ?? ""));
      setPaymentMethod(r.negotiation?.payment_method ?? "PIX");
      setDate(r.negotiation?.date ?? new Date().toISOString().slice(0, 10));
      setLocation(r.negotiation?.location ?? "");
      setNotes(r.negotiation?.notes ?? "");
      setLgpd(true);
      setStep(r.status === "draft" ? 4 : 5);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentReceiptId]);

  async function lookupBuyer() {
    const q = buyerSearch.trim();
    if (!q) return;
    setBuyerCandidate(null);
    setBuyerFound(null);
    // Busca exclusivamente via RPC SECURITY DEFINER. Nenhuma leitura direta
    // em `profiles` a partir do cliente. A RPC detecta CPF vs e-mail, exige
    // autenticação, aplica rate limit e registra auditoria.
    const { data, error } = await supabase.rpc(
      "find_trailbook_buyer" as never,
      { _query: q } as never,
    );
    if (error) {
      console.error("[TB] Falha na busca segura de comprador", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      toast.error("Não foi possível consultar compradores agora. Tente novamente em instantes.");
      return;
    }
    const row = Array.isArray(data) ? (data[0] as BuyerLookup) : null;
    if (!row) {
      toast.info("Nenhum usuário TrailBook encontrado");
      return;
    }
    // Não preenche o formulário; exige confirmação explícita do vendedor.
    setBuyerCandidate(row);
  }

  async function confirmBuyerCandidate() {
    if (!buyerCandidate) return;
    setLoading(true);
    try {
      // Busca autoritativa server-side (mesma query que localizou o candidato).
      // Só devolve dados se a busca reproduzir o mesmo buyer_id — não é possível
      // dumpar PII iterando IDs.
      const details = await confirmBuyerFn({
        data: { buyer_id: buyerCandidate.id, query: buyerSearch.trim() },
      });
      setBuyerFound(buyerCandidate);
      setBuyerName(details.full_name ?? "");
      setBuyerCpf(details.cpf ? maskCPF(details.cpf) : "");
      setBuyerEmail(details.email ?? "");
      setBuyerCandidate(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não foi possível confirmar o comprador";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function clearConfirmedBuyer() {
    setBuyerFound(null);
    setBuyerName("");
    setBuyerCpf("");
    setBuyerEmail("");
  }

  function resetForm() {
    setStep(1);
    setCurrentReceiptId(receiptId ?? null);
    setCurrentReceipt(null);
    setBuyerMode("tb");
    setBuyerSearch("");
    setBuyerFound(null);
    setBuyerCandidate(null);
    setBuyerName("");
    setBuyerCpf("");
    setBuyerEmail("");
    setAmount("");
    setPaymentMethod("PIX");
    setPaymentOther("");
    setDate(new Date().toISOString().slice(0, 10));
    setLocation("");
    setLocationFromProfile(false);
    setNotes("");
    setLgpd(false);
  }

  const amountValue = useMemo(() => Number(String(amount).replace(",", ".")), [amount]);
  const paymentLabel = paymentMethod === "Outro" ? paymentOther.trim() || "Outro" : paymentMethod;

  // Bloqueio de edição: quando o comprador TrailBook já foi confirmado, os
  // três campos (Nome, CPF, E-mail) refletem o snapshot autoritativo do
  // backend e não podem ser alterados pelo vendedor.
  const buyerLocked = buyerMode === "tb" && !!buyerFound;

  // Consistência mínima para avançar da etapa 1: nome + CPF válido + e-mail.
  const partesReady = useMemo(() => {
    if (!buyerName.trim()) return false;
    if (!isValidCPF(buyerCpf)) return false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.trim())) return false;
    if (buyerMode === "tb" && !buyerFound) return false;
    return true;
  }, [buyerName, buyerCpf, buyerEmail, buyerMode, buyerFound]);

  function validatePartes() {
    if (!buyerName.trim()) {
      toast.error("Informe o nome do comprador");
      return false;
    }
    if (buyerMode === "tb" && !buyerFound) {
      toast.error("Localize um usuário TrailBook ou selecione comprador externo");
      return false;
    }
    if (!isValidCPF(buyerCpf)) {
      toast.error("Informe um CPF válido do comprador");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.trim())) {
      toast.error("Informe um e-mail válido do comprador");
      return false;
    }
    return true;
  }
  function validateValor() {
    if (!amountValue || amountValue <= 0) {
      toast.error("Informe um valor válido");
      return false;
    }
    if (!paymentMethod) {
      toast.error("Selecione a forma de pagamento");
      return false;
    }
    if (!date) {
      toast.error("Informe a data");
      return false;
    }
    return true;
  }

  function invalidateAll() {
    // Governança v1.6 (princípio "sucesso só após UI sincronizada"):
    // aguardar invalidações para garantir que consumidores externos
    // (Central da Moto, Passaporte, Timeline, Indicadores) refetchem
    // ANTES do toast de sucesso.
    return Promise.all([
      qc.invalidateQueries({ queryKey: ["smart-receipts", motorcycleId] }),
      qc.invalidateQueries({ queryKey: ["active-negotiation", motorcycleId] }),
      qc.invalidateQueries({ queryKey: ["events", motorcycleId] }),
      qc.invalidateQueries({ queryKey: ["ownership", motorcycleId] }),
      qc.invalidateQueries({ queryKey: ["motorcycle", motorcycleId] }),
      qc.invalidateQueries({ queryKey: ["document-pendencies"] }),
    ]);
  }

  async function saveAndIssue() {
    if (!validatePartes() || !validateValor()) return;
    if (!lgpd) {
      toast.error("Aceite o consentimento LGPD");
      return;
    }
    setLoading(true);
    const requestId = makeReceiptRequestId();
    const startedAt = new Date().toISOString();
    let stage = "create_or_update_draft";
    try {
      let id = currentReceiptId;
      const buyerPayload = {
        user_id: buyerMode === "tb" ? (buyerFound?.id ?? null) : null,
        full_name: buyerName.trim(),
        cpf: onlyDigits(buyerCpf) || null,
        email: buyerEmail.trim() || null,
      };
      const negPayload = {
        amount: amountValue,
        payment_method: paymentLabel,
        date,
        location: location.trim() || null,
        notes: notes.trim() || null,
      };
      if (!id) {
        try {
          const res = await createDraft({
            data: {
              motorcycle_id: motorcycleId,
              buyer: buyerPayload,
              external_buyer: buyerMode === "external",
              negotiation: negPayload,
              lgpd_consent: true,
            },
          });
          id = res.receipt.id;
          setCurrentReceiptId(id);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (/já existe um processo ativo/i.test(message)) {
            toast.error("Já existe um processo ativo de compra e venda para esta motocicleta.", {
              action: {
                label: "Abrir processo existente",
                onClick: () => {
                  setOpen(false);
                  navigate({ to: "/transfers", search: { filter: "awaiting_me" } });
                },
              },
            });
            return;
          }
          throw err;
        }
      } else if (currentReceipt?.status === "draft") {
        await updateDraft({
          data: {
            id,
            patch: {
              buyer: buyerPayload,
              external_buyer: buyerMode === "external",
              negotiation: negPayload,
            },
          },
        });
      }
      stage = "generate_pdf";
      const pdfRes = await genPdf({ data: { id: id!, request_id: requestId } });
      await reloadReceipt(id!);
      setStep(5);
      await invalidateAll();
      onIssued?.(pdfRes.url);
      toast.success(`Recibo ${pdfRes.code} emitido. Assine e anexe o PDF para concluir.`);
    } catch (e) {
      // Log técnico de correlação (sem PII). O detalhe real fica no Worker/server pelo mesmo código.
      const raw = e instanceof Error ? e.message : String(e);
      console.error("[SmartReceipt] Falha na emissão do PDF:", {
        request_id: requestId,
        support_code: supportCodeFromRequestId(requestId),
        receipt_id: currentReceiptId,
        motorcycle_id: motorcycleId,
        stage,
        timestamp: startedAt,
        error: raw,
      });
      const isRuntime =
        /__extends|__toESM|is not a function|Cannot destructure|undefined \(reading/i.test(raw);
      const isBusiness = !isRuntime && raw && raw.length < 200 && !/\bat\b|\n/.test(raw);
      const msg = isBusiness ? raw : extractSupportMessage(raw, requestId);
      toast.error(msg, {
        action: {
          label: "Tentar novamente",
          onClick: () => {
            void saveAndIssue();
          },
        },
        cancel: {
          label: "Fechar",
          onClick: () => {
            /* dismiss */
          },
        },
      });
    } finally {
      setLoading(false);
    }
  }

  async function onUploadSigned(file: File) {
    if (!currentReceiptId) return;
    if (file.type !== "application/pdf") {
      toast.error("Envie um PDF");
      return;
    }
    setLoading(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const b64 = btoa(bin);
      const res = await attach({ data: { id: currentReceiptId, pdf_base64: b64 } });
      // Princípio v1.6: aplicar novo estado ANTES do toast
      if (res?.receipt) setCurrentReceipt(res.receipt as ReceiptRow);
      else await reloadReceipt(currentReceiptId);
      await invalidateAll();
      toast.success("Documento assinado anexado.");
    } catch (e) {
      await handleReceiptError(e, "anexar documento assinado");
    } finally {
      setLoading(false);
    }
  }

  async function onAccept() {
    if (!currentReceiptId) return;
    setLoading(true);
    try {
      const res = await accept({ data: { id: currentReceiptId } });
      // Princípio v1.6 (sucesso só após UI refletir novo estado):
      // aplicamos o registro retornado pelo backend (fonte única) ANTES
      // de exibir toast. Antes usávamos update sem .select() — RLS podia
      // filtrar 0 linhas silenciosamente e o toast "sucesso" aparecia
      // com a tela ainda em "pendente / Aguardando aceite".
      if (res?.receipt) setCurrentReceipt(res.receipt as ReceiptRow);
      else await reloadReceipt(currentReceiptId);
      await invalidateAll();
      toast.success("Aceite registrado");
    } catch (e) {
      await handleReceiptError(e, "registrar aceite");
    } finally {
      setLoading(false);
    }
  }

  async function onComplete() {
    if (!currentReceiptId) return;
    setLoading(true);
    try {
      const res = await complete({ data: { id: currentReceiptId } });
      if (res?.receipt) setCurrentReceipt(res.receipt as ReceiptRow);
      await invalidateAll();
      setOpen(false);
      resetForm();
      toast.success("Transferência concluída. Histórico atualizado.");
    } catch (e) {
      await handleReceiptError(e, "concluir a transferência");
    } finally {
      setLoading(false);
    }
  }

  async function onCancel() {
    if (!currentReceiptId) return;
    if (!confirm("Cancelar esta negociação? A ação não pode ser desfeita.")) return;
    setLoading(true);
    try {
      await cancelDraft({ data: { id: currentReceiptId, reason: "Cancelado pelo vendedor" } });
      await invalidateAll();
      setOpen(false);
      resetForm();
      toast.success("Negociação cancelada");
    } catch (e) {
      await handleReceiptError(e, "cancelar a negociação");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Erro com Recuperação (ADR 0012). Quando o backend detectar que o estado
   * mudou (`STALE_STATE:` prefix), sincronizamos o recibo + queries
   * correlatas ANTES de mostrar a mensagem — a UI reflete o estado real e o
   * usuário não precisa dar refresh manual. Erros de negócio comuns
   * (mensagem curta) e técnicos (stack) mantêm o comportamento anterior.
   */
  async function handleReceiptError(err: unknown, operation: string) {
    if (isStaleStateError(err)) {
      const supportCode = `SR-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      console.warn(`[SmartReceipt][${supportCode}] stale_state_recovered`, {
        operation,
        receipt_id: currentReceiptId,
        motorcycle_id: motorcycleId,
        detail: stripStaleStatePrefix(err),
        timestamp: new Date().toISOString(),
      });
      // 1. sincroniza fonte única (recibo) 2. invalida consumidores
      // 3. só então mostra mensagem — nenhum botão fica com estado obsoleto.
      if (currentReceiptId) await reloadReceipt(currentReceiptId);
      await invalidateAll();
      toast.info(staleStateUserMessage(operation), {
        description: "Revise o status atualizado antes de tentar novamente.",
      });
      return;
    }
    const raw = err instanceof Error ? err.message : String(err);
    const isTechnical = /\bat\b|\n|Cannot|undefined \(reading|is not a function/.test(raw);
    toast.error(
      isTechnical
        ? "Não foi possível concluir esta ação agora. Tente novamente em instantes."
        : raw,
    );
  }

  function viewPdf() {
    if (!currentReceipt) return;
    navigate({
      to: "/recibos/$code/visualizar",
      params: { code: currentReceipt.code },
      search: { variant: "original", from: `/motorcycles/${motorcycleId}/control` },
    });
  }

  async function downloadPdfBlob() {
    if (!currentReceipt) return;
    try {
      const res = await pdfBytesFn({ data: { code: currentReceipt.code, variant: "original" } });
      if (!res.found) {
        toast.error("PDF indisponível");
        return;
      }
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const buf = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      const href = URL.createObjectURL(new Blob([buf], { type: res.contentType }));
      const a = document.createElement("a");
      a.href = href;
      a.download = res.filename ?? `${currentReceipt.code}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 5_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no download");
    }
  }

  async function sharePdf() {
    if (!currentReceipt) return;
    const pageUrl = publicReceiptUrl(currentReceipt.code);
    const data = {
      title: `Recibo TrailBook ${currentReceipt.code}`,
      text: `Recibo Inteligente TrailBook — valide em ${pageUrl}`,
      url: pageUrl,
    };
    if (
      typeof navigator !== "undefined" &&
      (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }).share
    ) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share(data);
        return;
      } catch {
        /* usuário cancelou */ return;
      }
    }
    try {
      await navigator.clipboard.writeText(pageUrl);
      toast.success("Link do recibo copiado", { description: pageUrl });
    } catch {
      toast.info(pageUrl);
    }
  }

  function printPdf() {
    if (!currentReceipt) return;
    navigate({
      to: "/recibos/$code/visualizar",
      params: { code: currentReceipt.code },
      search: { variant: "original", from: `/motorcycles/${motorcycleId}/control` },
    });
  }

  function continueLater() {
    toast.info("Você pode retomar em Central da Moto, Passaporte ou Histórico de Recibos.");
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" /> Recibo Inteligente
          </DialogTitle>
          <DialogDescription>
            Etapa {Math.min(step, 5)} de 5 — a transferência só se concluirá após o PDF assinado ser
            anexado e os aceites registrados.
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                  Comprador
                </Label>
                <HelpTooltip label="Fluxo da negociação" text={HELP.negotiationFlow} />
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={buyerMode === "tb" ? "default" : "outline"}
                  onClick={() => setBuyerMode("tb")}
                >
                  Usuário TrailBook
                </Button>
                <HelpTooltip label="Comprador TrailBook" text={HELP.buyerTrailBook} />
                <Button
                  type="button"
                  size="sm"
                  variant={buyerMode === "external" ? "default" : "outline"}
                  onClick={() => {
                    setBuyerMode("external");
                    setBuyerFound(null);
                  }}
                >
                  Comprador externo
                </Button>
                <HelpTooltip label="Comprador externo" text={HELP.buyerExternal} />
              </div>
              {buyerMode === "tb" ? (
                <div className="mt-3 flex gap-2">
                  <Input
                    placeholder="E-mail ou CPF"
                    value={buyerSearch}
                    onChange={(e) => setBuyerSearch(e.target.value)}
                  />
                  <Button type="button" variant="outline" onClick={lookupBuyer}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Comprador sem conta TrailBook. Só o aceite do vendedor será exigido; a moto será
                  arquivada ao concluir.
                </p>
              )}
              {buyerMode === "tb" && buyerCandidate && (
                <div className="mt-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Confirme o comprador
                  </p>
                  <div className="mt-1 text-sm">
                    <p className="font-semibold">{buyerCandidate.full_name || "—"}</p>
                    {buyerCandidate.email_masked && (
                      <p className="text-xs text-muted-foreground">{buyerCandidate.email_masked}</p>
                    )}
                    {buyerCandidate.cpf_masked && (
                      <p className="text-xs text-muted-foreground">
                        CPF {buyerCandidate.cpf_masked}
                      </p>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button type="button" size="sm" onClick={confirmBuyerCandidate}>
                      <CheckCircle2 className="h-4 w-4" /> É esse comprador
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setBuyerCandidate(null)}
                    >
                      Não é esse
                    </Button>
                  </div>
                </div>
              )}
              {buyerMode === "tb" && buyerFound && !buyerCandidate && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 text-[11px] text-emerald-500">
                    Comprador TrailBook confirmado: {buyerFound.full_name}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={clearConfirmedBuyer}
                    className="shrink-0"
                  >
                    Trocar comprador
                  </Button>
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="b-name">Nome completo *</Label>
                <Input
                  id="b-name"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  readOnly={buyerLocked}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-cpf">CPF *</Label>
                <Input
                  id="b-cpf"
                  value={buyerCpf}
                  onChange={(e) => setBuyerCpf(maskCPF(e.target.value))}
                  onBlur={(e) => setBuyerCpf(maskCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  readOnly={buyerLocked}
                  maxLength={14}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-email">E-mail *</Label>
                <Input
                  id="b-email"
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  readOnly={buyerLocked}
                />
              </div>
              {buyerLocked && (
                <p className="sm:col-span-2 text-[11px] text-muted-foreground">
                  Dados carregados do perfil TrailBook do comprador. Para alterar, use "Trocar
                  comprador".
                </p>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Motocicleta
            </Label>
            <p className="mt-2 text-muted-foreground">
              Os dados da moto (marca, modelo, ano, chassi, placa, horímetro/km atual) são
              capturados do TrailBook e ficarão registrados no recibo. Confira no Passaporte antes
              de avançar.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input
                id="amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="12500,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {paymentMethod === "Outro" && (
                <Input
                  className="mt-2"
                  placeholder="Especifique"
                  value={paymentOther}
                  onChange={(e) => setPaymentOther(e.target.value)}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Data da negociação *</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Local da negociação</Label>
                {locationFromProfile && location === profileQ.data?.location && <ProfileDataChip />}
              </div>
              <LocationPicker
                value={location}
                onChange={(v) => {
                  setLocation(v);
                  setLocationFromProfile(false);
                }}
                label=""
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Estado da moto, acessórios inclusos…"
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Comprador
              </div>
              <div className="mt-1 font-semibold">{buyerName}</div>
              <div className="text-xs text-muted-foreground">
                {buyerMode === "tb" ? "Usuário TrailBook" : "Comprador externo"}
                {buyerCpf ? ` · ${buyerCpf}` : ""}
                {buyerEmail ? ` · ${buyerEmail}` : ""}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Negociação
              </div>
              <div className="mt-1 text-lg font-bold">{formatCurrencyBRL(amountValue)}</div>
              <div className="text-xs text-muted-foreground">
                {paymentLabel} · {date ? new Date(date).toLocaleDateString("pt-BR") : ""}
                {location ? ` · ${location}` : ""}
              </div>
              {notes && <p className="mt-2 text-xs text-muted-foreground">{notes}</p>}
            </div>
            <label className="flex items-start gap-2 rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              <Checkbox checked={lgpd} onCheckedChange={(v) => setLgpd(!!v)} />
              <span>
                Confirmo o registro do recibo no TrailBook e a consulta pública pelo código único
                (LGPD). O PDF gerado é modelo para assinatura — a transferência só se efetiva após
                anexar o documento assinado e as partes registrarem aceite.
              </span>
            </label>
          </div>
        )}

        {step === 5 && currentReceipt && (
          <ReceiptLifecyclePanel
            receipt={currentReceipt}
            userId={currentUserId}
            loading={loading}
            onUpload={onUploadSigned}
            onAccept={onAccept}
            onComplete={onComplete}
            onCancel={onCancel}
            onView={viewPdf}
            onDownload={downloadPdfBlob}
            onShare={sharePdf}
            onPrint={printPdf}
            onContinueLater={continueLater}
          />
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {step > 1 && step < 5 && (
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))}>
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Fechar
            </Button>
            {step < 4 && (
              <Button
                onClick={() => {
                  if (step === 1 && !validatePartes()) return;
                  if (step === 3 && !validateValor()) return;
                  setStep(step + 1);
                }}
                disabled={step === 1 && !partesReady}
              >
                Avançar <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {step === 4 && (
              <Button onClick={saveAndIssue} disabled={loading || !lgpd} className="btn-glow">
                <FileSignature className="h-4 w-4" /> {loading ? "Emitindo…" : "Emitir PDF"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptLifecyclePanel({
  receipt,
  userId,
  loading,
  onUpload,
  onAccept,
  onComplete,
  onCancel,
  onView,
  onDownload,
  onShare,
  onPrint,
  onContinueLater,
}: {
  receipt: ReceiptRow;
  userId: string | null;
  loading: boolean;
  onUpload: (f: File) => void;
  onAccept: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onView: () => void;
  onDownload: () => void;
  onShare: () => void;
  onPrint: () => void;
  onContinueLater: () => void;
}) {
  const isSeller = userId === receipt.seller_id;
  const isBuyer = userId === receipt.buyer_id;
  const needsBuyerAccept = !!receipt.buyer_id;
  const canComplete =
    !!receipt.signed_pdf_path &&
    !!receipt.seller_accepted_at &&
    (!needsBuyerAccept || !!receipt.buyer_accepted_at);
  const label = RECEIPT_STATUS_LABEL[receipt.status as ReceiptStatus] ?? receipt.status;
  const justIssued = receipt.status === "issued" && !receipt.signed_pdf_path;

  // Timeline oficial da transferência — deriva do estado real do recibo.
  const steps: Array<{ key: string; label: string; done: boolean; current: boolean }> = [
    { key: "created", label: "Recibo criado", done: true, current: false },
    {
      key: "generated",
      label: "Documento gerado",
      done: receipt.status !== "draft",
      current: receipt.status === "draft",
    },
    {
      key: "signed",
      label: "Documento assinado anexado",
      done: !!receipt.signed_pdf_path,
      current: receipt.status !== "draft" && !receipt.signed_pdf_path,
    },
    {
      key: "seller",
      label: "Aceite do vendedor",
      done: !!receipt.seller_accepted_at,
      current: !!receipt.signed_pdf_path && !receipt.seller_accepted_at,
    },
    ...(needsBuyerAccept
      ? [
          {
            key: "buyer",
            label: "Aceite do comprador",
            done: !!receipt.buyer_accepted_at,
            current: !!receipt.seller_accepted_at && !receipt.buyer_accepted_at,
          },
        ]
      : []),
    {
      key: "done",
      label: "Transferência concluída",
      done: receipt.status === "completed",
      current: canComplete && receipt.status !== "completed",
    },
  ];

  // Próxima ação sugerida (uma única frase, sempre concreta).
  const nextAction = (() => {
    if (receipt.status === "completed") return "Transferência concluída. Nenhuma ação pendente.";
    if (!receipt.signed_pdf_path) return "Anexe o PDF assinado pelas partes.";
    if (isSeller && !receipt.seller_accepted_at) return "Registre seu aceite como vendedor.";
    if (isBuyer && needsBuyerAccept && !receipt.buyer_accepted_at)
      return "Registre seu aceite como comprador.";
    if (needsBuyerAccept && !receipt.buyer_accepted_at) return "Aguardando aceite do comprador.";
    if (canComplete) return "Concluir transferência.";
    return "Aguardando próxima etapa da contraparte.";
  })();

  return (
    <div className="space-y-4 text-sm">
      {justIssued && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-base font-bold text-emerald-300">
                Recibo criado com sucesso
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Código{" "}
                <span className="font-mono font-semibold text-foreground">{receipt.code}</span> —{" "}
                {label}.
              </div>
              <div className="mt-2 text-xs text-emerald-100/80">
                Próxima ação: <strong className="text-emerald-200">{nextAction}</strong>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={onView} disabled={loading}>
              <Eye className="h-4 w-4" /> Abrir documento
            </Button>
            <Button size="sm" variant="ghost" onClick={onContinueLater} disabled={loading}>
              <Clock className="h-4 w-4" /> Continuar depois
            </Button>
          </div>
        </div>
      )}

      {/* Cabeçalho executivo */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-primary">Transferência</div>
            <div className="mt-0.5 font-mono text-sm font-bold text-foreground">{receipt.code}</div>
          </div>
          <div className="text-xs text-muted-foreground">
            Estado <strong className="text-foreground">{label}</strong>
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Próxima ação: <strong className="text-foreground">{nextAction}</strong>
        </div>
      </div>

      {/* Timeline visual */}
      <ol className="rounded-xl border border-border bg-card p-3">
        {steps.map((s, i) => {
          const isLast = i === steps.length - 1;
          const dot = s.done
            ? "bg-emerald-500 text-background"
            : s.current
              ? "bg-amber-400 text-background"
              : "bg-muted text-muted-foreground";
          const line = s.done ? "bg-emerald-500/40" : "bg-border";
          return (
            <li key={s.key} className="relative flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${dot}`}
                >
                  {s.done ? "✓" : i + 1}
                </div>
                {!isLast && <div className={`w-px flex-1 ${line}`} />}
              </div>
              <div
                className={`min-w-0 flex-1 pb-3 text-xs ${s.done ? "text-foreground" : s.current ? "text-foreground" : "text-muted-foreground"}`}
              >
                {s.label}
                {s.current && (
                  <span className="ml-1 text-[10px] uppercase tracking-widest text-amber-400">
                    agora
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* DOCUMENTO ORIGINAL — ações únicas e padronizadas */}
      <div className="rounded-xl border border-border p-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Documento original
            </div>
            <div className="text-sm font-semibold">PDF modelo — para assinar</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" onClick={onView}>
                <Eye className="h-4 w-4" /> Visualizar
              </Button>
              <Button size="sm" variant="outline" onClick={onDownload}>
                <Download className="h-4 w-4" /> Baixar
              </Button>
              <Button size="sm" variant="outline" onClick={onShare}>
                <Share2 className="h-4 w-4" /> Compartilhar
              </Button>
              <Button size="sm" variant="outline" onClick={onPrint}>
                <Printer className="h-4 w-4" /> Imprimir
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* DOCUMENTO ASSINADO */}
      <div className="rounded-xl border border-border p-3">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${receipt.signed_pdf_path ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"}`}
          >
            <PenLine className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Documento assinado
            </div>
            <div className="text-sm font-semibold">
              {receipt.signed_pdf_path ? "Anexado ✓" : "Nenhum documento anexado"}
            </div>
            {receipt.signed_pdf_path && (
              <div className="text-[11px] text-muted-foreground">Reanexar reseta os aceites.</div>
            )}
            <div className="mt-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
                <Upload className="h-4 w-4" />{" "}
                {receipt.signed_pdf_path ? "Reanexar assinado" : "Anexar documento assinado"}
                <input
                  type="file"
                  accept="application/pdf"
                  hidden
                  onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
                  disabled={loading}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ACEITES */}
      <div className="rounded-xl border border-border p-3 space-y-2">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Aceites</div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs">
            Vendedor{" "}
            {receipt.seller_accepted_at ? (
              <span className="text-emerald-400">
                <CheckCircle2 className="inline h-3 w-3" /> aceito
              </span>
            ) : (
              <span className="text-muted-foreground">pendente</span>
            )}
          </div>
          {isSeller && receipt.status === "awaiting_acceptance" && !receipt.seller_accepted_at && (
            <Button size="sm" onClick={onAccept} disabled={loading}>
              Aceitar
            </Button>
          )}
        </div>
        {needsBuyerAccept ? (
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs">
              Comprador{" "}
              {receipt.buyer_accepted_at ? (
                <span className="text-emerald-400">
                  <CheckCircle2 className="inline h-3 w-3" /> aceito
                </span>
              ) : (
                <span className="text-muted-foreground">pendente</span>
              )}
            </div>
            {isBuyer && receipt.status === "awaiting_acceptance" && !receipt.buyer_accepted_at && (
              <Button size="sm" onClick={onAccept} disabled={loading}>
                Aceitar
              </Button>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Comprador externo — aceite não é exigido dentro do TrailBook.
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {isSeller && receipt.status !== "completed" && (
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
            className="text-destructive"
          >
            <XCircle className="h-4 w-4" /> Cancelar
          </Button>
        )}
        {canComplete && receipt.status === "awaiting_acceptance" && (
          <Button className="ml-auto btn-glow" onClick={onComplete} disabled={loading}>
            <CheckCircle2 className="h-4 w-4" /> Concluir transferência
          </Button>
        )}
      </div>
    </div>
  );
}
