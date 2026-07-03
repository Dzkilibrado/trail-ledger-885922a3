import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AccessDenied } from "./admin";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  MESSAGE_TYPES, MESSAGE_SUBJECTS, MESSAGE_PRIORITIES, MESSAGE_AUDIENCES,
  PRIORITY_TONE, labelOf,
} from "@/lib/comm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/messages")({
  head: () => ({ meta: [{ title: "Mensagens — Admin TrailBook" }] }),
  component: Page,
});

function Page() {
  const { isAdmin, loading } = useIsAdmin();
  if (loading) return null;
  if (!isAdmin) return <AccessDenied />;
  return (
    <div className="space-y-5">
      <PageHeader title="Central de Mensagens" subtitle="Comunicação interna entre administração e usuários." />
      <Tabs defaultValue="send">
        <TabsList>
          <TabsTrigger value="send">Enviar</TabsTrigger>
          <TabsTrigger value="manage">Gestão</TabsTrigger>
          <TabsTrigger value="simulated">Envios simulados</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>
        <TabsContent value="send" className="mt-4"><Compose /></TabsContent>
        <TabsContent value="manage" className="mt-4"><Manage /></TabsContent>
        <TabsContent value="simulated" className="mt-4"><Simulated /></TabsContent>
        <TabsContent value="settings" className="mt-4"><Settings /></TabsContent>
      </Tabs>
    </div>
  );
}

function useCommSettings() {
  return useQuery({
    queryKey: ["comm", "settings"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_comm_settings" as any);
      if (error) throw error;
      return data as any;
    },
  });
}

function Compose() {
  const settingsQ = useCommSettings();
  const emailEnabled = !!settingsQ.data?.email_enabled;
  const homolog = !!settingsQ.data?.homologation_mode;

  const [type, setType] = useState("system_notice");
  const [subjectKey, setSubjectKey] = useState("important_notice");
  const [subjectOther, setSubjectOther] = useState("");
  const [priority, setPriority] = useState("medium");
  const [audience, setAudience] = useState("single_user");
  const [userId, setUserId] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [roleFilter, setRoleFilter] = useState("user");
  const [body, setBody] = useState("");
  const [allowReply, setAllowReply] = useState(true);
  const [chInternal, setChInternal] = useState(true);
  const [chEmail, setChEmail] = useState(false);

  const usersQ = useQuery({
    queryKey: ["admin", "users", "min"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users" as any, { _limit: 500 });
      if (error) throw error;
      return data as any[];
    },
    enabled: audience === "single_user",
  });

  const send = useMutation({
    mutationFn: async () => {
      const filter: any = {};
      if (audience === "single_user") filter.user_id = userId;
      if (audience === "by_status") filter.status = statusFilter;
      if (audience === "by_role") filter.role = roleFilter;
      const channels = [chInternal && "internal", chEmail && "email"].filter(Boolean);
      const { error } = await supabase.rpc("admin_send_message" as any, {
        _type: type, _subject_key: subjectKey, _subject_other: subjectOther || null,
        _body: body, _priority: priority, _audience: audience, _filter: filter,
        _allow_reply: allowReply, _related_ticket_id: null, _channels: channels,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      const suffix = chEmail && !emailEnabled
        ? " O envio por e-mail está desabilitado no momento — registrado internamente."
        : chEmail && homolog
          ? " Modo homologação ativo — o e-mail foi registrado como envio simulado."
          : "";
      toast.success("Mensagem enviada com sucesso." + suffix);
      setBody("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao enviar"),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Tipo">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MESSAGE_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Assunto">
          <Select value={subjectKey} onValueChange={setSubjectKey}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MESSAGE_SUBJECTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      {subjectKey === "other" && (
        <Field label="Detalhe o assunto"><Input value={subjectOther} onChange={(e) => setSubjectOther(e.target.value)} /></Field>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Prioridade">
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MESSAGE_PRIORITIES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Destinatários">
          <Select value={audience} onValueChange={setAudience}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MESSAGE_AUDIENCES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>

      {audience === "single_user" && (
        <Field label="Usuário">
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger><SelectValue placeholder="Selecionar usuário" /></SelectTrigger>
            <SelectContent>
              {(usersQ.data ?? []).map((u: any) => (
                <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.email} · {u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      {audience === "by_status" && (
        <Field label="Status">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["active","pending","blocked","inactive"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      )}
      {audience === "by_role" && (
        <Field label="Perfil">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Administradores</SelectItem>
              <SelectItem value="user">Usuários</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}

      <Field label="Mensagem">
        <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escreva a mensagem…" />
      </Field>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-background/50 p-3">
        <label className="flex items-center gap-2 text-sm"><Switch checked={allowReply} onCheckedChange={setAllowReply} /> Permitir resposta</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={chInternal} onCheckedChange={setChInternal} /> Notificação interna</label>
        <label className="flex items-center gap-2 text-sm" title={!emailEnabled ? "Canal de e-mail desabilitado. A mensagem será registrada como envio simulado." : undefined}>
          <Switch checked={chEmail} onCheckedChange={setChEmail} /> E-mail {(!emailEnabled || homolog) && <Badge variant="outline" className="text-xs">{emailEnabled ? "homologação" : "desabilitado"}</Badge>}
        </label>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => send.mutate()} disabled={send.isPending || !body.trim() || (audience === "single_user" && !userId)}>
          {send.isPending ? "Enviando…" : "Enviar mensagem"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Manage() {
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState("all");
  const [prioF, setPrioF] = useState("all");
  const [autoF, setAutoF] = useState("all");
  const [detail, setDetail] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin", "messages", search, typeF, prioF, autoF],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_messages" as any, {
        _search: search || null,
        _type: typeF === "all" ? null : typeF,
        _priority: prioF === "all" ? null : prioF,
        _automatic: autoF === "all" ? null : autoF,
      });
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-4">
        <Input placeholder="Buscar por assunto, corpo, código…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={typeF} onValueChange={setTypeF}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {MESSAGE_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={prioF} onValueChange={setPrioF}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as prioridades</SelectItem>
            {MESSAGE_PRIORITIES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={autoF} onValueChange={setAutoF}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Automáticas + manuais</SelectItem>
            <SelectItem value="auto">Somente automáticas</SelectItem>
            <SelectItem value="manual">Somente manuais</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead><TableHead>Assunto</TableHead><TableHead>Tipo</TableHead>
              <TableHead>Prioridade</TableHead><TableHead>Destinatários</TableHead>
              <TableHead>Lidas</TableHead><TableHead>Origem</TableHead><TableHead>Criada em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((r: any) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetail(r.id)}>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell>{r.subject_text}</TableCell>
                <TableCell>{labelOf(MESSAGE_TYPES, r.type)}</TableCell>
                <TableCell><Badge variant="outline" className={cn("border", PRIORITY_TONE[r.priority])}>{labelOf(MESSAGE_PRIORITIES, r.priority)}</Badge></TableCell>
                <TableCell>{r.recipients_count}</TableCell>
                <TableCell>{r.read_count}/{r.recipients_count}</TableCell>
                <TableCell>{r.is_automatic ? "Automática" : (r.sender_name ?? "Manual")}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
              </TableRow>
            ))}
            {!q.isLoading && (q.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">Nenhuma mensagem.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <ThreadDialog id={detail} onOpenChange={(o) => !o && setDetail(null)} />
    </div>
  );
}

function ThreadDialog({ id, onOpenChange }: { id: string | null; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const q = useQuery({
    queryKey: ["admin", "message", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_message_thread" as any, { _id: id });
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });
  async function send() {
    if (reply.trim().length < 2) return;
    const { error } = await supabase.rpc("admin_reply_message" as any, { _parent: id, _body: reply });
    if (error) return toast.error(error.message);
    toast.success("Resposta enviada.");
    setReply("");
    qc.invalidateQueries({ queryKey: ["admin", "message", id] });
    qc.invalidateQueries({ queryKey: ["admin", "messages"] });
  }
  const t = q.data;
  return (
    <Dialog open={!!id} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{t?.message?.subject_text ?? "Mensagem"}</DialogTitle></DialogHeader>
        {!t ? <div className="text-sm text-muted-foreground">Carregando…</div> : (
          <div className="space-y-3">
            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
              {(t.thread ?? []).map((m: any) => (
                <div key={m.id} className="rounded-lg border border-border bg-background/40 p-3">
                  <div className="text-xs text-muted-foreground">{m.sender_name ?? "Sistema"} · {new Date(m.created_at).toLocaleString("pt-BR")}</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm">{m.body}</div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Destinatários ({(t.recipients ?? []).length})</div>
              <ul className="mt-1 text-xs text-muted-foreground max-h-24 overflow-y-auto">
                {(t.recipients ?? []).map((r: any) => (
                  <li key={r.user_id}>{r.name ?? r.email} — {r.status}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Escreva sua resposta…" />
              <Button size="sm" onClick={send}>Responder</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Simulated() {
  const q = useQuery({
    queryKey: ["admin", "deliveries", "simulated"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_deliveries" as any, { _only_simulated: true });
      if (error) throw error;
      return data as any[];
    },
  });
  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">Registros de e-mails que <b>seriam enviados</b> — nenhum e-mail real foi enviado.</div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead><TableHead>Assunto</TableHead><TableHead>Para</TableHead>
              <TableHead>Canal</TableHead><TableHead>Status</TableHead><TableHead>Prévia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((d: any) => (
              <TableRow key={d.id}>
                <TableCell className="text-xs">{new Date(d.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell>{d.subject_text}</TableCell>
                <TableCell className="text-xs">{d.user_name ?? d.user_email}</TableCell>
                <TableCell><Badge variant="outline">{d.channel}</Badge></TableCell>
                <TableCell><Badge variant="outline">{d.status}</Badge></TableCell>
                <TableCell className="max-w-md text-xs text-muted-foreground truncate" title={d.payload?.body}>{d.payload?.body}</TableCell>
              </TableRow>
            ))}
            {!q.isLoading && (q.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Nenhum envio simulado ainda.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Settings() {
  const qc = useQueryClient();
  const q = useCommSettings();
  const s = q.data ?? {};
  const [local, setLocal] = useState<any>(null);
  const cur = local ?? s;

  const save = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.rpc("admin_update_comm_settings" as any, { _json: patch });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Configurações salvas."); qc.invalidateQueries({ queryKey: ["comm", "settings"] }); setLocal(null); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  function set(k: string, v: any) { setLocal({ ...cur, [k]: v }); }

  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-semibold">Canais de comunicação</h2>
      <Row label="Notificação interna" desc="Sempre ativo enquanto for o canal padrão do TrailBook.">
        <Switch checked={!!cur.internal_enabled} onCheckedChange={(v) => set("internal_enabled", v)} />
      </Row>
      <Row label="E-mail" desc="Enquanto desativado, e-mails ficam apenas registrados no sistema (sem custo).">
        <Switch checked={!!cur.email_enabled} onCheckedChange={(v) => set("email_enabled", v)} />
      </Row>
      <Row label="WhatsApp (futuro)" desc="Reservado para integração futura."><Switch checked={!!cur.whatsapp_enabled} onCheckedChange={(v) => set("whatsapp_enabled", v)} /></Row>
      <Row label="Push (futuro)" desc="Reservado para integração futura."><Switch checked={!!cur.push_enabled} onCheckedChange={(v) => set("push_enabled", v)} /></Row>
      <Row label="SMS (futuro)" desc="Reservado para integração futura."><Switch checked={!!cur.sms_enabled} onCheckedChange={(v) => set("sms_enabled", v)} /></Row>

      <h2 className="font-display text-lg font-semibold pt-2">Modo homologação</h2>
      <Row label="Ativar modo homologação" desc="Registra o e-mail que seria enviado (assunto, destinatário, corpo) sem envio real.">
        <Switch checked={!!cur.homologation_mode} onCheckedChange={(v) => set("homologation_mode", v)} />
      </Row>

      <h2 className="font-display text-lg font-semibold pt-2">E-mail (futuro)</h2>
      <Field label="Remetente"><Input value={cur.email_from ?? ""} onChange={(e) => set("email_from", e.target.value)} placeholder="TrailBook <no-reply@trailbook.com.br>" /></Field>
      <Field label="Provedor"><Input value={cur.email_provider ?? ""} onChange={(e) => set("email_provider", e.target.value)} placeholder="lovable | resend | sendgrid | brevo" /></Field>
      <Field label="Redirecionar todos os e-mails para (teste)"><Input value={cur.email_test_redirect ?? ""} onChange={(e) => set("email_test_redirect", e.target.value)} placeholder="dev@trailbook.com.br" /></Field>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setLocal(null)} disabled={!local}>Descartar</Button>
        <Button onClick={() => save.mutate(cur)} disabled={!local || save.isPending}>Salvar configurações</Button>
      </div>
    </div>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background/40 p-3">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
      </div>
      {children}
    </div>
  );
}