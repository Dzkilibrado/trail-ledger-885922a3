import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { generateSmartReceipt } from "@/lib/smart-receipts.functions";
import { toast } from "sonner";
import { FileSignature, Search } from "lucide-react";

const PAYMENT_METHODS = [
  "Dinheiro", "PIX", "Transferência bancária", "Financiamento", "Cartão", "Outro",
];

type BuyerLookup = { id: string; full_name: string; email: string | null; cpf: string | null } | null;

export function EmitReceiptDialog({ motorcycleId, trigger, onIssued }: {
  motorcycleId: string;
  trigger: React.ReactNode;
  onIssued?: (url: string) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [buyerMode, setBuyerMode] = useState<"tb" | "external">("tb");
  const [buyerSearch, setBuyerSearch] = useState("");
  const [buyerFound, setBuyerFound] = useState<BuyerLookup>(null);
  const [buyerName, setBuyerName] = useState("");
  const [buyerCpf, setBuyerCpf] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("PIX");
  const [paymentOther, setPaymentOther] = useState("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [lgpd, setLgpd] = useState(false);
  const [loading, setLoading] = useState(false);

  const emit = useServerFn(generateSmartReceipt);

  async function lookupBuyer() {
    const q = buyerSearch.trim();
    if (!q) return;
    const { data, error } = await supabase
      .from("profiles").select("id, full_name, email, cpf")
      .or(`email.eq.${q},cpf.eq.${q.replace(/\D/g, "")}`)
      .maybeSingle();
    if (error) { toast.error("Falha na busca"); return; }
    if (!data) { toast.info("Nenhum usuário TrailBook encontrado com este e-mail/CPF"); setBuyerFound(null); return; }
    setBuyerFound(data as BuyerLookup);
    setBuyerName(data.full_name ?? "");
    setBuyerCpf(data.cpf ?? "");
    setBuyerEmail(data.email ?? "");
  }

  function resetForm() {
    setBuyerMode("tb"); setBuyerSearch(""); setBuyerFound(null);
    setBuyerName(""); setBuyerCpf(""); setBuyerEmail("");
    setAmount(""); setPaymentMethod("PIX"); setPaymentOther("");
    setDate(new Date().toISOString().slice(0, 10));
    setLocation(""); setNotes(""); setLgpd(false);
  }

  async function submit() {
    if (!buyerName.trim()) return toast.error("Informe o nome do comprador");
    const value = Number(String(amount).replace(",", "."));
    if (!value || value <= 0) return toast.error("Informe um valor válido");
    if (!lgpd) return toast.error("Aceite o consentimento LGPD");
    const method = paymentMethod === "Outro" ? paymentOther.trim() || "Outro" : paymentMethod;

    setLoading(true);
    try {
      const res = await emit({
        data: {
          motorcycle_id: motorcycleId,
          buyer: {
            user_id: buyerMode === "tb" ? buyerFound?.id ?? null : null,
            full_name: buyerName.trim(),
            cpf: buyerCpf.trim() || null,
            email: buyerEmail.trim() || null,
          },
          negotiation: {
            amount: value, payment_method: method, date,
            location: location.trim() || null, notes: notes.trim() || null,
          },
          lgpd_consent: true,
        },
      });
      toast.success(`Recibo ${res.receipt?.code} emitido`);
      qc.invalidateQueries({ queryKey: ["smart-receipts", motorcycleId] });
      onIssued?.(res.url);
      resetForm();
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao emitir recibo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" /> Emitir Recibo Inteligente
          </DialogTitle>
          <DialogDescription>
            Documento eletrônico com código único, QR Code e validação pública. Modelo de referência —
            não substitui ATPV-e ou registro no DETRAN.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Comprador</Label>
            <div className="mt-2 flex gap-2">
              <Button type="button" size="sm" variant={buyerMode === "tb" ? "default" : "outline"} onClick={() => setBuyerMode("tb")}>
                Usuário TrailBook
              </Button>
              <Button type="button" size="sm" variant={buyerMode === "external" ? "default" : "outline"} onClick={() => { setBuyerMode("external"); setBuyerFound(null); }}>
                Comprador externo
              </Button>
            </div>
            {buyerMode === "tb" && (
              <div className="mt-3 flex gap-2">
                <Input placeholder="E-mail ou CPF" value={buyerSearch} onChange={(e) => setBuyerSearch(e.target.value)} />
                <Button type="button" variant="outline" onClick={lookupBuyer}><Search className="h-4 w-4" /></Button>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="b-name">Nome completo *</Label>
              <Input id="b-name" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-cpf">CPF</Label>
              <Input id="b-cpf" value={buyerCpf} onChange={(e) => setBuyerCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-email">E-mail</Label>
              <Input id="b-email" type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="12500,00" />
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              {paymentMethod === "Outro" && (
                <Input className="mt-2" placeholder="Especifique" value={paymentOther} onChange={(e) => setPaymentOther(e.target.value)} />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Data da negociação *</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Local</Label>
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Cidade / UF" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Estado da moto, acessórios inclusos, garantias combinadas…" />
          </div>

          <label className="flex items-start gap-2 rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            <Checkbox checked={lgpd} onCheckedChange={(v) => setLgpd(!!v)} />
            <span>
              Confirmo que ambas as partes autorizam o registro deste recibo no TrailBook e sua consulta pública
              pelo código único (LGPD). CPF será exibido de forma mascarada na página pública.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading || !lgpd}>
            {loading ? "Emitindo…" : "Emitir Recibo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}