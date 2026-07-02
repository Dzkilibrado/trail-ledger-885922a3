import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AccessDenied } from "./admin";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/trailbook";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Usuários — Admin TrailBook" }] }),
  component: AdminUsers,
});

const STATUS_OPTS = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativo" },
  { value: "pending", label: "Pendente" },
  { value: "blocked", label: "Bloqueado" },
  { value: "inactive", label: "Inativo" },
];
const PLAN_OPTS = [
  { value: "all", label: "Todos" },
  { value: "free", label: "Free" },
  { value: "premium", label: "Premium" },
  { value: "workshop", label: "Oficina" },
];
const PERIOD_OPTS = [
  { value: "all", label: "Todos" },
  { value: "1", label: "Hoje" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "month", label: "Este mês" },
];
const YESNO = [
  { value: "any", label: "Todos" },
  { value: "yes", label: "Sim" },
  { value: "no", label: "Não" },
];
const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  blocked: "bg-destructive/15 text-destructive border-destructive/30",
  inactive: "bg-muted text-muted-foreground border-border",
};

function periodRange(v: string): { from?: string; to?: string } {
  if (v === "all") return {};
  const now = new Date();
  if (v === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: from.toISOString() };
  }
  const days = parseInt(v, 10);
  if (!Number.isFinite(days)) return {};
  const from = new Date(now.getTime() - days * 864e5);
  return { from: from.toISOString() };
}

function AdminUsers() {
  const { isAdmin, loading } = useIsAdmin();
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [period, setPeriod] = useState("all");
  const [hasMoto, setHasMoto] = useState("any");
  const [hasTicket, setHasTicket] = useState("any");
  const [search, setSearch] = useState("");
  const [detailsUser, setDetailsUser] = useState<string | null>(null);

  const filters = useMemo(() => ({ status, plan, period, hasMoto, hasTicket, search }), [status, plan, period, hasMoto, hasTicket, search]);

  const users = useQuery({
    queryKey: ["admin", "users", filters],
    enabled: isAdmin,
    queryFn: async () => {
      const range = periodRange(period);
      const params: any = {
        _status: status === "all" ? null : status,
        _plan: plan === "all" ? null : plan,
        _search: search.trim() || null,
        _has_moto: hasMoto === "any" ? null : hasMoto === "yes",
        _has_ticket: hasTicket === "any" ? null : hasTicket === "yes",
        _from: range.from ?? null,
        _to: range.to ?? null,
      };
      const { data, error } = await supabase.rpc("admin_list_users" as any, params);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const me = useQuery({ queryKey: ["me"], queryFn: async () => (await supabase.auth.getUser()).data.user });

  async function setUserStatus(uid: string, s: string) {
    const { error } = await supabase.rpc("admin_set_user_status" as any, { _user: uid, _status: s });
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
  }
  async function setUserPlan(uid: string, p: string) {
    const { error } = await supabase.rpc("admin_set_user_plan" as any, { _user: uid, _plan: p });
    if (error) return toast.error(error.message);
    toast.success("Plano atualizado");
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
  }

  async function setUserRole(uid: string, isAdminNew: boolean) {
    const { error } = await supabase.rpc("admin_set_user_role" as any, { _user: uid, _is_admin: isAdminNew });
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
  }

  if (loading) return <div className="text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return <AccessDenied />;

  return (
    <div className="space-y-6">
      <PageHeader title="Usuários" description="Gerencie contas, planos e status de acesso." crumbs={[{ label: "Admin", to: "/admin" }, { label: "Usuários" }]} />

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-3 lg:grid-cols-6">
        <Field label="Status"><SelectBox value={status} onChange={setStatus} options={STATUS_OPTS} /></Field>
        <Field label="Plano"><SelectBox value={plan} onChange={setPlan} options={PLAN_OPTS} /></Field>
        <Field label="Cadastro"><SelectBox value={period} onChange={setPeriod} options={PERIOD_OPTS} /></Field>
        <Field label="Possui moto"><SelectBox value={hasMoto} onChange={setHasMoto} options={YESNO} /></Field>
        <Field label="Chamado aberto"><SelectBox value={hasTicket} onChange={setHasTicket} options={YESNO} /></Field>
        <Field label="Buscar"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, e-mail ou telefone" /></Field>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead className="text-right">Motos</TableHead>
              <TableHead className="text-right">Chamados</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users.data ?? []).map((u) => {
              const isSelf = me.data?.id === u.id;
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.full_name || "—"} {u.is_admin && <Badge className="ml-1 bg-primary/15 text-primary">Administrador</Badge>}</div>
                    <div className="font-mono text-xs text-muted-foreground">{u.id.slice(0, 8)}…</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{u.email || "—"}</div>
                    <div className="text-muted-foreground">{u.phone || "—"}</div>
                  </TableCell>
                  <TableCell><Badge className={STATUS_TONE[u.status]}>{u.status}</Badge></TableCell>
                  <TableCell>
                    <Select
                      value={u.is_admin ? "admin" : "user"}
                      onValueChange={(v) => setUserRole(u.id, v === "admin")}
                      disabled={isSelf && u.is_admin}
                    >
                      <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Usuário</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={u.plan} onValueChange={(v) => setUserPlan(u.id, v)}>
                      <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                        <SelectItem value="workshop">Oficina</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">{u.motorcycles_count}</TableCell>
                  <TableCell className="text-right">{u.open_tickets}</TableCell>
                  <TableCell className="text-xs">{formatDate(u.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setDetailsUser(u.id)}>Detalhes</Button>
                      {u.status !== "active" && <Button size="sm" variant="outline" onClick={() => setUserStatus(u.id, "active")}>Reativar</Button>}
                      {u.status === "active" && !isSelf && (
                        <ConfirmAction
                          label="Bloquear"
                          title="Bloquear acesso?"
                          description="O usuário perde acesso ao TrailBook. O histórico é preservado."
                          onConfirm={() => setUserStatus(u.id, "blocked")}
                        />
                      )}
                      {!isSelf && (
                        <ConfirmAction
                          label="Desativar"
                          variant="destructive"
                          title="Desativar conta?"
                          description="A conta é desativada logicamente. Motos e histórico são preservados."
                          onConfirm={() => setUserStatus(u.id, "inactive")}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!users.isLoading && !users.data?.length && (
              <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Nenhum usuário encontrado com os filtros atuais.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <UserDetailsDialog userId={detailsUser} onClose={() => setDetailsUser(null)} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>{children}</div>;
}
function SelectBox({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}
function ConfirmAction({ label, title, description, onConfirm, variant = "outline" }: { label: string; title: string; description: string; onConfirm: () => void; variant?: "outline" | "destructive" }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant={variant as any}>{label}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={onConfirm}>Confirmar</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function UserDetailsDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const details = useQuery({
    queryKey: ["admin", "user-details", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_user_details" as any, { _user: userId });
      if (error) throw error;
      return data as any;
    },
  });
  const d = details.data;
  const profile = d?.profile;
  return (
    <Dialog open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{profile?.full_name || "Usuário"}</DialogTitle>
          <DialogDescription>
            {profile?.email || "—"} · Perfil: {d?.is_admin ? "Administrador" : "Usuário"}
          </DialogDescription>
        </DialogHeader>
        {details.isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
        {d && (
          <div className="space-y-6">
            <Section title={`Motocicletas (${d.motorcycles?.length ?? 0})`}>
              {d.motorcycles?.length ? d.motorcycles.map((m: any) => (
                <Row key={m.id} left={`${m.brand} ${m.model} ${m.year ?? ""}`} right={m.trailbook_id} />
              )) : <Empty />}
            </Section>
            <Section title={`Documentos (${d.documents?.length ?? 0})`}>
              {d.documents?.length ? d.documents.map((x: any) => (
                <Row key={x.id} left={`${x.doc_type} — ${x.file_name ?? "arquivo"}`} right={formatDate(x.created_at)} />
              )) : <Empty />}
            </Section>
            <Section title={`Certificados (${d.certificates?.length ?? 0})`}>
              {d.certificates?.length ? d.certificates.map((c: any) => (
                <Row key={c.id} left={`Status: ${c.status}`} right={formatDate(c.created_at)} />
              )) : <Empty />}
            </Section>
            <Section title={`Chamados (${d.tickets?.length ?? 0})`}>
              {d.tickets?.length ? d.tickets.map((t: any) => (
                <Row key={t.id} left={`${t.code} — ${t.subject}`} right={t.status} />
              )) : <Empty />}
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="rounded-lg border border-border divide-y divide-border">{children}</div>
    </div>
  );
}
function Row({ left, right }: { left: string; right?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <div className="truncate">{left}</div>
      <div className="text-xs text-muted-foreground shrink-0">{right}</div>
    </div>
  );
}
function Empty() {
  return <div className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhum registro.</div>;
}