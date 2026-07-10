import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CheckCircle2, FileDown, MessageSquareWarning, ShieldAlert, XCircle } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  open: "Aberta", in_review: "Em análise", awaiting_info: "Aguardando informação",
  approved: "Aprovada", rejected: "Rejeitada", cancelled: "Cancelada",
};
const STATUS_TONE: Record<string, string> = {
  open: "bg-primary/15 text-primary border-primary/30",
  in_review: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  awaiting_info: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

/**
 * Painel administrativo para chamados do tipo `cpf_change`.
 * Exibe apenas dados mascarados via RPC `admin_cpf_request_detail`.
 * Ações: solicitar informação, rejeitar (motivo obrigatório) e aprovar (confirmação dupla).
 */
export function CpfChangeAdminPanel({ ticketId }: { ticketId: string }) {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<null | "info" | "reject" | "approve">(null);
  const [notes, setNotes] = useState("");
  const [working, setWorking] = useState(false);

  // Busca o request via ticket_id
  const req = useQuery({
    queryKey: ["cpf-req", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cpf_change_requests")
        .select("id")
        .eq("ticket_id", ticketId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: detail, error: eD } = await supabase.rpc("admin_cpf_request_detail" as never, { _id: data.id } as never);
      if (eD) throw eD;
      return detail as any;
    },
  });

  async function openDoc(path: string) {
    const { data, error } = await supabase.storage.from("cpf-change-docs").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) { toast.error(error?.message ?? "Falha ao gerar link"); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function run() {
    if (!req.data) return;
    if (dialog !== "approve" && notes.trim().length < 5) {
      toast.error("Descreva o motivo (mínimo 5 caracteres).");
      return;
    }
    setWorking(true);
    try {
      const fn = dialog === "approve" ? "admin_approve_cpf_change"
               : dialog === "reject"  ? "admin_reject_cpf_change"
               : "admin_request_more_info_cpf";
      const { error } = await supabase.rpc(fn as never, { _id: req.data.id, _notes: notes.trim() || null } as never);
      if (error) throw error;
      toast.success(
        dialog === "approve" ? "Solicitação aprovada. CPF atualizado."
          : dialog === "reject" ? "Solicitação rejeitada."
          : "Solicitação enviada de volta ao usuário."
      );
      setDialog(null); setNotes("");
      qc.invalidateQueries({ queryKey: ["cpf-req", ticketId] });
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
      qc.invalidateQueries({ queryKey: ["ticket-msgs", ticketId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao executar");
    } finally { setWorking(false); }
  }

  if (req.isLoading) return <div className="text-sm text-muted-foreground">Carregando solicitação…</div>;
  const r = req.data;
  if (!r) return null;
  const decided = r.status === "approved" || r.status === "rejected" || r.status === "cancelled";

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
        <ShieldAlert className="h-4 w-4" /> Analisar alteração de CPF
        <Badge className={STATUS_TONE[r.status] ?? ""}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <Info label="Usuário" value={`${r.user?.full_name ?? "—"} · ${r.user?.email ?? ""}`} />
        <Info label="CPF atual" value={r.current_cpf_masked ?? "—"} mono />
        <Info label="CPF novo" value={r.new_cpf_masked ?? "—"} mono />
        <Info label="Aberta em" value={new Date(r.created_at).toLocaleString("pt-BR")} />
        {r.decided_at && <Info label="Decidida em" value={new Date(r.decided_at).toLocaleString("pt-BR")} />}
      </div>

      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Motivo do usuário</div>
        <p className="mt-1 whitespace-pre-wrap text-sm">{r.reason}</p>
      </div>

      {r.decision_notes && (
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Notas da decisão</div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{r.decision_notes}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => openDoc(r.document_path)}>
          <FileDown className="h-4 w-4" /> Ver documento
        </Button>
        {!decided && (
          <>
            <Button variant="outline" size="sm" onClick={() => { setNotes(""); setDialog("info"); }}>
              <MessageSquareWarning className="h-4 w-4" /> Pedir informação
            </Button>
            <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => { setNotes(""); setDialog("reject"); }}>
              <XCircle className="h-4 w-4" /> Rejeitar
            </Button>
            <Button size="sm" className="btn-glow" onClick={() => { setNotes(""); setDialog("approve"); }}>
              <CheckCircle2 className="h-4 w-4" /> Aprovar
            </Button>
          </>
        )}
      </div>

      <AlertDialog open={dialog !== null} onOpenChange={(v) => { if (!v) setDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog === "approve" && "Aprovar alteração de CPF"}
              {dialog === "reject" && "Rejeitar solicitação"}
              {dialog === "info" && "Solicitar informação"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog === "approve" && "Esta ação altera o CPF do usuário definitivamente e é auditada. Não pode ser desfeita pelo cliente."}
              {dialog === "reject" && "Descreva o motivo. O usuário será notificado e o chamado será encerrado."}
              {dialog === "info" && "Descreva o que precisa. O usuário será notificado e o chamado ficará aguardando resposta."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-2">
            <Label className="text-xs">{dialog === "approve" ? "Notas (opcional)" : "Motivo/Observação"}</Label>
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder={dialog === "approve" ? "Registro para auditoria" : "Mínimo 5 caracteres"} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={run} disabled={working}>
              {dialog === "approve" ? "Confirmar aprovação" : dialog === "reject" ? "Confirmar rejeição" : "Enviar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={"mt-0.5 " + (mono ? "font-mono" : "")}>{value}</div>
    </div>
  );
}