import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/trailbook";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { labelFor, PRIORITY_TONE, STATUS_TONE, TICKET_MODULES, TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES } from "@/lib/tickets";
import { Shield, Send, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { TicketAttachments } from "@/components/TicketAttachments";

export const Route = createFileRoute("/_authenticated/tickets/$id")({
  head: () => ({ meta: [{ title: "Chamado — TrailBook" }] }),
  component: TicketDetail,
});

function TicketDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { isAdmin } = useIsAdmin();

  const ticket = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tickets").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const messages = useQuery({
    queryKey: ["ticket-msgs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSending(false); return; }
    const { error } = await supabase.from("ticket_messages").insert({
      ticket_id: id, author_id: u.user.id, body: body.trim(), is_internal: isAdmin ? internal : false,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setBody(""); setInternal(false);
    qc.invalidateQueries({ queryKey: ["ticket-msgs", id] });
    qc.invalidateQueries({ queryKey: ["ticket", id] });
  }

  async function updateField(field: "status" | "priority", value: string) {
    const { error } = await supabase.from("tickets").update({ [field]: value } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Atualizado");
    qc.invalidateQueries({ queryKey: ["ticket", id] });
  }

  async function assignToMe() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("tickets").update({ assigned_to: u.user.id }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Chamado atribuído a você");
    qc.invalidateQueries({ queryKey: ["ticket", id] });
  }

  async function userUpdateStatus(next: "resolved" | "open" | "cancelled") {
    const { error } = await supabase.from("tickets").update({ status: next } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(next === "resolved" ? "Marcado como resolvido" : next === "cancelled" ? "Chamado cancelado" : "Chamado reaberto");
    qc.invalidateQueries({ queryKey: ["ticket", id] });
  }

  if (ticket.isLoading) return <div className="text-muted-foreground">Carregando…</div>;
  const t = ticket.data as any;
  if (!t) return <div className="text-muted-foreground">Chamado não encontrado.</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t.title}
        description={`${t.code} • Aberto em ${formatDate(t.created_at)}`}
        crumbs={[
          isAdmin ? { label: "Admin — Chamados", to: "/admin/tickets" } : { label: "Meus chamados", to: "/tickets" },
          { label: t.code },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        <Badge className={STATUS_TONE[t.status]}>{labelFor(TICKET_STATUSES, t.status)}</Badge>
        <Badge className={PRIORITY_TONE[t.priority]}>{labelFor(TICKET_PRIORITIES, t.priority)}</Badge>
        <Badge variant="outline">{labelFor(TICKET_TYPES, t.type)}</Badge>
        <Badge variant="outline">Módulo: {labelFor(TICKET_MODULES, t.module)}</Badge>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Descrição</div>
        <p className="mt-2 whitespace-pre-wrap text-sm">{t.description}</p>
      </div>

      <TicketAttachments ticketId={id} />

      {!isAdmin && (
        <div className="flex flex-wrap gap-2">
          {(t.status === "resolved" || t.status === "closed") ? (
            <Button variant="outline" size="sm" onClick={() => userUpdateStatus("open")}>
              <RotateCcw className="h-4 w-4" /> Reabrir chamado
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => userUpdateStatus("resolved")}>
                <CheckCircle2 className="h-4 w-4" /> Marcar como resolvido
              </Button>
              {t.status === "open" && (
                <Button variant="ghost" size="sm" onClick={() => userUpdateStatus("cancelled")}>
                  <XCircle className="h-4 w-4" /> Cancelar chamado
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <Shield className="h-4 w-4" /> Controles administrativos
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={t.status} onValueChange={(v) => updateField("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TICKET_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={t.priority} onValueChange={(v) => updateField("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TICKET_PRIORITIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" className="w-full" onClick={assignToMe}>Assumir chamado</Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Conversa</h2>
        {(messages.data ?? []).length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Ainda não há respostas. Assim que houver movimento, você será notificado.
          </div>
        )}
        {(messages.data ?? []).map((m: any) => (
          <div key={m.id} className={`rounded-lg border p-4 ${m.is_internal ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card"}`}>
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatDate(m.created_at)}</span>
              {m.is_internal && <Badge className="bg-amber-500/15 text-amber-400">Nota interna</Badge>}
            </div>
            <p className="whitespace-pre-wrap text-sm">{m.body}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <Label className="text-xs">Nova mensagem</Label>
        <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escreva sua resposta…" className="mt-2" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {isAdmin ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={internal} onCheckedChange={(v) => setInternal(!!v)} />
              Nota interna (visível apenas para administradores)
            </label>
          ) : <span />}
          <Button onClick={send} disabled={sending || !body.trim()}><Send className="h-4 w-4" /> Enviar</Button>
        </div>
      </div>
    </div>
  );
}