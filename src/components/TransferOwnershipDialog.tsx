import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRightLeft, ShieldAlert } from "lucide-react";

export function TransferOwnershipDialog({ motorcycleId, trigger }: { motorcycleId: string; trigger: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email) return toast.error("Informe o e-mail do comprador");
    setLoading(true);
    const { error } = await supabase.rpc("request_ownership_transfer", {
      _moto_id: motorcycleId, _to_email: email.trim(), _message: message || null,
    } as never);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Solicitação enviada");
    qc.invalidateQueries({ queryKey: ["transfers"] });
    qc.invalidateQueries({ queryKey: ["transfers-for-moto", motorcycleId] });
    setOpen(false); setEmail(""); setMessage("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-primary" /> Transferir propriedade</DialogTitle>
          <DialogDescription>
            O comprador receberá uma solicitação no TrailBook. Toda a história permanece vinculada à mesma motocicleta — o TrailBook ID nunca muda.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300">
            <div className="flex gap-2"><ShieldAlert className="h-4 w-4 shrink-0" />
              <span>A transferência só é efetivada quando o comprador aprovar. O destinatário precisa ter conta no TrailBook com este e-mail.</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to-email">E-mail do comprador</Label>
            <Input id="to-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="comprador@email.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="msg">Mensagem (opcional)</Label>
            <Textarea id="msg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Detalhes da venda, condições, etc." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Enviando…" : "Enviar solicitação"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}