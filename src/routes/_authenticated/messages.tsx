import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mail, MailOpen, Archive, MessageSquare, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { MESSAGE_TYPES, MESSAGE_PRIORITIES, PRIORITY_TONE, labelOf, RECIPIENT_STATUS_LABEL } from "@/lib/comm";
import { cn } from "@/lib/utils";
import { ListRowsSkeleton } from "@/components/Skeletons";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesInbox,
});

type Row = {
  message_id: string;
  code: string | null;
  subject_text: string;
  body: string;
  type: string;
  priority: string;
  is_automatic: boolean;
  allow_reply: boolean;
  sender_id: string | null;
  sender_name: string | null;
  related_ticket_id: string | null;
  created_at: string;
  status: "sent" | "read" | "replied" | "archived";
  read_at: string | null;
};

function MessagesInbox() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"inbox" | "unread" | "archived">("inbox");
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState<string>("all");
  const [prioF, setPrioF] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["messages", filter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("user_list_messages" as any, { _filter: filter });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = (q.data ?? []).filter((r) =>
    (typeF === "all" || r.type === typeF) &&
    (prioF === "all" || r.priority === prioF) &&
    (!search || r.subject_text.toLowerCase().includes(search.toLowerCase()) || r.body.toLowerCase().includes(search.toLowerCase())),
  );

  const mark = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const { error } = await supabase.rpc("user_mark_message" as any, { _id: id, _action: action });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      qc.invalidateQueries({ queryKey: ["messages", "unread-count"] });
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Minhas mensagens</h1>
          <p className="text-sm text-muted-foreground">Central de comunicação do TrailBook.</p>
        </div>
        <div className="flex gap-2">
          {(["inbox", "unread", "archived"] as const).map((k) => (
            <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
              {k === "inbox" ? "Recebidas" : k === "unread" ? "Não lidas" : "Arquivadas"}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={typeF} onValueChange={setTypeF}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {MESSAGE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={prioF} onValueChange={setPrioF}>
          <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as prioridades</SelectItem>
            {MESSAGE_PRIORITIES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {q.isLoading ? (
        <ListRowsSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Nenhuma mensagem recebida.
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((r) => {
            const unread = r.status === "sent";
            const open = openId === r.message_id;
            return (
              <div key={r.message_id} className={cn("p-4", unread && "bg-primary/[0.04]")}>
                <button
                  className="flex w-full items-start justify-between gap-3 text-left"
                  onClick={() => {
                    setOpenId(open ? null : r.message_id);
                    if (unread && !open) mark.mutate({ id: r.message_id, action: "read" });
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {unread ? <Mail className="mt-0.5 h-4 w-4 text-primary" /> : <MailOpen className="mt-0.5 h-4 w-4 text-muted-foreground" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("font-semibold", unread && "text-foreground")}>{r.subject_text}</span>
                        <Badge variant="outline" className={cn("border", PRIORITY_TONE[r.priority])}>{labelOf(MESSAGE_PRIORITIES, r.priority)}</Badge>
                        <Badge variant="outline">{labelOf(MESSAGE_TYPES, r.type)}</Badge>
                        {r.is_automatic && <Badge variant="outline" className="text-muted-foreground">Automática</Badge>}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {r.sender_name ?? "Sistema TrailBook"} · {new Date(r.created_at).toLocaleString("pt-BR")} · {RECIPIENT_STATUS_LABEL[r.status]}
                      </div>
                      {!open && <div className="mt-1 line-clamp-1 text-sm text-muted-foreground">{r.body}</div>}
                    </div>
                  </div>
                </button>
                {open && <MessageDetail row={r} onDone={() => qc.invalidateQueries({ queryKey: ["messages"] })} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MessageDetail({ row, onDone }: { row: Row; onDone: () => void }) {
  const [reply, setReply] = useState("");
  const [tSubject, setTSubject] = useState(row.subject_text);
  const [tBody, setTBody] = useState(row.body);
  const [tPrio, setTPrio] = useState("medium");
  const [ticketMode, setTicketMode] = useState(false);

  async function send() {
    if (reply.trim().length < 2) return toast.error("Escreva sua resposta.");
    const { error } = await supabase.rpc("user_reply_message" as any, { _parent: row.message_id, _body: reply });
    if (error) return toast.error(error.message);
    toast.success("Resposta enviada.");
    setReply("");
    onDone();
  }
  async function archive() {
    const { error } = await supabase.rpc("user_mark_message" as any, { _id: row.message_id, _action: "archived" });
    if (error) return toast.error(error.message);
    toast.success("Mensagem arquivada.");
    onDone();
  }
  async function openTicket() {
    const { data, error } = await supabase.rpc("user_open_ticket_from_message" as any, {
      _id: row.message_id, _subject: tSubject, _body: tBody, _priority: tPrio,
    });
    if (error) return toast.error(error.message);
    toast.success("Chamado aberto.");
    setTicketMode(false);
    window.location.href = `/tickets/${data}`;
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border bg-background/40 p-4">
      <div className="whitespace-pre-wrap text-sm">{row.body}</div>
      {row.related_ticket_id && (
        <Link to="/tickets/$id" params={{ id: row.related_ticket_id }} className="inline-flex items-center gap-1 text-xs text-primary underline">
          <LifeBuoy className="h-3 w-3" /> Chamado vinculado
        </Link>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={archive}><Archive className="h-4 w-4" /> Arquivar</Button>
        {!ticketMode && (
          <Button size="sm" variant="outline" onClick={() => setTicketMode(true)}><LifeBuoy className="h-4 w-4" /> Abrir chamado</Button>
        )}
      </div>

      {ticketMode && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Novo chamado</div>
          <Input value={tSubject} onChange={(e) => setTSubject(e.target.value)} placeholder="Título" />
          <Input value={tBody} onChange={(e) => setTBody(e.target.value)} placeholder="Descrição" />
          <Select value={tPrio} onValueChange={setTPrio}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MESSAGE_PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button size="sm" onClick={openTicket}>Criar chamado</Button>
            <Button size="sm" variant="ghost" onClick={() => setTicketMode(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {row.allow_reply && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Responder</div>
          <textarea
            className="w-full rounded-md border border-input bg-transparent p-2 text-sm"
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Escreva sua resposta…"
          />
          <Button size="sm" onClick={send}>Enviar resposta</Button>
        </div>
      )}
    </div>
  );
}