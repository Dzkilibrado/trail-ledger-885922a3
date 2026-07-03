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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Bike, Clock, Eye, FileText, KeyRound, Pencil, ScrollText, ShieldAlert, ShieldCheck, Ticket, Trash2, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/trailbook";
import { adminSendPasswordReset, adminDeleteHomologUser } from "@/lib/admin-users.functions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
const ROLE_OPTS = [
  { value: "all", label: "Todos" },
  { value: "admin", label: "Administrador" },
  { value: "user", label: "Usuário" },
];
const LOGIN_OPTS = [
  { value: "all", label: "Todos" },
  { value: "email", label: "E-mail e senha" },
  { value: "google", label: "Google" },
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
const BLOCK_REASONS = [
  "Solicitação do usuário",
  "Suspeita de duplicidade",
  "Homologação/Teste",
  "Uso indevido",
  "Dados inconsistentes",
  "Outro",
];
const DEACTIVATE_REASONS = [
  "Solicitação do usuário",
  "Homologação/Teste",
  "Duplicidade",
  "Dados inconsistentes",
  "Outro",
];
const DELETE_REASONS = [
  "Limpeza de homologação",
  "Teste concluído",
  "Cadastro duplicado de homologação",
  "Outro",
];

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
  const [hasDocs, setHasDocs] = useState("any");
  const [isHomolog, setIsHomolog] = useState("any");
  const [role, setRole] = useState("all");
  const [loginProv, setLoginProv] = useState("all");
  const [search, setSearch] = useState("");
  const [detailsUser, setDetailsUser] = useState<string | null>(null);

  const filters = useMemo(
    () => ({ status, plan, period, hasMoto, hasTicket, hasDocs, isHomolog, role, loginProv, search }),
    [status, plan, period, hasMoto, hasTicket, hasDocs, isHomolog, role, loginProv, search],
  );

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
        _has_documents: hasDocs === "any" ? null : hasDocs === "yes",
        _is_homologation: isHomolog === "any" ? null : isHomolog === "yes",
        _role: role === "all" ? null : role,
        _login_provider: loginProv === "all" ? null : loginProv,
        _from: range.from ?? null,
        _to: range.to ?? null,
      };
      const { data, error } = await supabase.rpc("admin_list_users" as any, params);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const me = useQuery({ queryKey: ["me"], queryFn: async () => (await supabase.auth.getUser()).data.user });

  async function quickReactivate(uid: string) {
    const { error } = await supabase.rpc("admin_reactivate_user" as any, { _user: uid, _notes: null });
    if (error) return toast.error(error.message);
    toast.success("Usuário reativado");
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
  }

  if (loading) return <div className="text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return <AccessDenied />;

  return (
    <div className="space-y-6">
      <PageHeader title="Usuários" description="Gerencie contas, planos e status de acesso." crumbs={[{ label: "Admin", to: "/admin" }, { label: "Usuários" }]} />

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-3 lg:grid-cols-5">
        <Field label="Status"><SelectBox value={status} onChange={setStatus} options={STATUS_OPTS} /></Field>
        <Field label="Perfil"><SelectBox value={role} onChange={setRole} options={ROLE_OPTS} /></Field>
        <Field label="Plano"><SelectBox value={plan} onChange={setPlan} options={PLAN_OPTS} /></Field>
        <Field label="Tipo de login"><SelectBox value={loginProv} onChange={setLoginProv} options={LOGIN_OPTS} /></Field>
        <Field label="Homologação"><SelectBox value={isHomolog} onChange={setIsHomolog} options={YESNO} /></Field>
        <Field label="Cadastro"><SelectBox value={period} onChange={setPeriod} options={PERIOD_OPTS} /></Field>
        <Field label="Possui moto"><SelectBox value={hasMoto} onChange={setHasMoto} options={YESNO} /></Field>
        <Field label="Chamado aberto"><SelectBox value={hasTicket} onChange={setHasTicket} options={YESNO} /></Field>
        <Field label="Possui documentos"><SelectBox value={hasDocs} onChange={setHasDocs} options={YESNO} /></Field>
        <Field label="Buscar"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, e-mail, CPF ou WhatsApp" /></Field>
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
                    <div className="font-medium flex flex-wrap items-center gap-1">
                      {u.full_name || "—"}
                      {u.is_admin && <Badge className="bg-primary/15 text-primary border-primary/30">🛡 Admin</Badge>}
                      {u.is_homologation && <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">🧪 Homologação</Badge>}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">{u.id.slice(0, 8)}…</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{u.email || "—"}</div>
                    <div className="text-muted-foreground">{u.phone || "—"}</div>
                  </TableCell>
                  <TableCell><Badge className={STATUS_TONE[u.status]}>{u.status}</Badge></TableCell>
                  <TableCell className="text-xs">{u.is_admin ? "🛡 Administrador" : "👤 Usuário"}</TableCell>
                  <TableCell className="text-xs uppercase">{u.plan}</TableCell>
                  <TableCell className="text-right">{u.motorcycles_count}</TableCell>
                  <TableCell className="text-right">{u.open_tickets}</TableCell>
                  <TableCell className="text-xs">{formatDate(u.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setDetailsUser(u.id)} aria-label="Ver detalhes" title="Ver detalhes">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {u.status !== "active" && (
                        <Button size="sm" variant="outline" onClick={() => quickReactivate(u.id)}>Reativar</Button>
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

      <UserDetailsSheet userId={detailsUser} onClose={() => setDetailsUser(null)} currentAdminId={me.data?.id} />
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

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  pending: "Pendente",
  blocked: "Bloqueado",
  inactive: "Inativo",
};
const PLAN_LABELS: Record<string, string> = { free: "Free", premium: "Premium", workshop: "Oficina" };
const TICKET_OPEN_STATUSES = new Set(["open", "in_analysis", "in_progress", "awaiting_user"]);

function initials(name?: string | null, email?: string | null) {
  const source = (name?.trim() || email?.split("@")[0] || "Usuário").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : source.slice(0, 2)).toUpperCase();
}

function formatPhone(phone?: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "Telefone não informado";
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

function formatMotorcycleName(m: any) {
  const name = [m.nickname, m.brand, m.model].filter(Boolean).join(" · ");
  const year = [m.year_make, m.year_model].filter(Boolean).join("/");
  return `${name || "Motocicleta"}${year ? ` · ${year}` : ""}`;
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-5 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function UserDetailsSheet({ userId, onClose, currentAdminId }: { userId: string | null; onClose: () => void; currentAdminId?: string }) {
  const qc = useQueryClient();
  const details = useQuery({
    queryKey: ["admin", "user-details", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_user_details" as any, { _user: userId });
      if (error) throw error;
      return data as any;
    },
  });
  const list = useQuery({
    queryKey: ["admin", "user-row", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users" as any, { _search: null });
      if (error) throw error;
      return (data ?? []).find((r: any) => r.id === userId);
    },
  });
  const audit = useQuery({
    queryKey: ["admin", "user-audit", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_user_audit" as any, { _user: userId, _limit: 100 });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  function refetchAll() {
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
    qc.invalidateQueries({ queryKey: ["admin", "user-details", userId] });
    qc.invalidateQueries({ queryKey: ["admin", "user-row", userId] });
    qc.invalidateQueries({ queryKey: ["admin", "user-audit", userId] });
  }

  const d = details.data;
  const row = list.data;
  const profile = d?.profile ?? row;
  const isSelf = currentAdminId && userId === currentAdminId;
  const motorcycles = (d?.motorcycles ?? []) as any[];
  const documents = (d?.documents ?? []) as any[];
  const certificates = (d?.certificates ?? []) as any[];
  const tickets = (d?.tickets ?? []) as any[];
  const openTickets = tickets.filter((t) => TICKET_OPEN_STATUSES.has(String(t.status))).length;
  const isAdminProfile = !!(d?.is_admin ?? row?.is_admin);
  const statusLabel = STATUS_LABELS[profile?.status] ?? profile?.status ?? "—";
  const planLabel = PLAN_LABELS[profile?.plan] ?? profile?.plan ?? "—";

  return (
    <Sheet open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col overflow-hidden p-0 sm:max-w-3xl">
        <div className="border-b border-border p-4 sm:p-6">
          <SheetHeader className="space-y-4 text-left">
            <div className="flex items-start gap-4 pr-8">
              <Avatar className="h-14 w-14 rounded-xl border border-border">
                <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.full_name || "Usuário"} />
                <AvatarFallback className="rounded-xl text-base font-semibold">{initials(profile?.full_name, profile?.email)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <SheetTitle className="break-words text-xl leading-tight">{profile?.full_name || "Usuário"}</SheetTitle>
                  <SheetDescription className="mt-1 break-words">
                    {profile?.email || "E-mail não informado"}<br />
                    {formatPhone(profile?.phone)}
                  </SheetDescription>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge className={STATUS_TONE[profile?.status ?? "pending"]}>{statusLabel}</Badge>
                  <Badge variant="outline">{isAdminProfile ? "Administrador" : "Usuário"}</Badge>
                  <Badge variant="outline">{planLabel}</Badge>
                  <Badge className={profile?.is_homologation ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"}>
                    {profile?.is_homologation ? "Homologação" : "Produtivo"}
                  </Badge>
                </div>
              </div>
            </div>
          </SheetHeader>

          {!details.isError && profile && (
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <SummaryCard icon={<Bike />} label="Motos" value={row?.motorcycles_count ?? motorcycles.length ?? 0} />
              <SummaryCard icon={<FileText />} label="Documentos" value={row?.documents_count ?? documents.length ?? 0} />
              <SummaryCard icon={<ScrollText />} label="Certificados" value={row?.certificates_count ?? certificates.length ?? 0} />
              <SummaryCard icon={<Ticket />} label="Chamados" value={`${row?.open_tickets ?? openTickets ?? 0} aberto(s)`} />
              <SummaryCard icon={<Clock />} label="Último acesso" value={profile?.last_seen_at ? formatDate(profile.last_seen_at) : "Sem registro"} />
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {details.isLoading ? (
          <div className="rounded-lg border border-border bg-muted/30 p-5 text-sm text-muted-foreground">Carregando dados do usuário…</div>
        ) : details.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
            <p className="font-medium text-destructive">Não foi possível carregar os detalhes deste usuário.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => details.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : !profile ? (
          <EmptyState>Nenhum dado encontrado para este usuário.</EmptyState>
        ) : (
          <Tabs defaultValue="dados" className="space-y-4">
            <div className="overflow-x-auto pb-1">
            <TabsList className="inline-flex w-max min-w-full justify-start">
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="motos">Motos</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
              <TabsTrigger value="certificados">Certificados</TabsTrigger>
              <TabsTrigger value="chamados">Chamados</TabsTrigger>
              <TabsTrigger value="seguranca">Segurança</TabsTrigger>
              <TabsTrigger value="audit">Auditoria</TabsTrigger>
            </TabsList>
            </div>

            <TabsContent value="dados" className="space-y-5">
              <SectionTitle title="Dados cadastrais" description="Informações principais da conta e do acesso." />
              <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <Info label="CPF">{profile.cpf || "—"}</Info>
                <Info label="Tipo de login">{row?.login_provider || "—"}</Info>
                <Info label="Data de cadastro">{formatDate(profile.created_at)}</Info>
                <Info label="Último acesso">{profile.last_seen_at ? formatDate(profile.last_seen_at) : "—"}</Info>
              </div>
              <div className="space-y-3 rounded-lg border border-border p-4">
                <SectionTitle title="Ações administrativas" description="Dados, perfil e plano. Alterações relevantes geram auditoria." />
                <EditForm profile={profile} row={row} isSelf={!!isSelf} isAdmin={isAdminProfile} onSaved={refetchAll} />
              </div>
            </TabsContent>

            <TabsContent value="motos" className="space-y-4">
              <SectionTitle title="Motos vinculadas" description="Motocicletas cadastradas pelo usuário." />
              {motorcycles.length === 0 ? <EmptyState>Este usuário ainda não cadastrou nenhuma motocicleta.</EmptyState> : (
                <div className="space-y-2">{motorcycles.map((m) => <ListItem key={m.id} title={formatMotorcycleName(m)} meta={`${m.trailbook_id || "Sem TrailBook ID"}${m.plate ? ` · Placa ${m.plate}` : ""}`} />)}</div>
              )}
            </TabsContent>

            <TabsContent value="documentos" className="space-y-4">
              <SectionTitle title="Documentos" description="Arquivos e registros documentais das motos do usuário." />
              {documents.length === 0 ? <EmptyState>Nenhum documento cadastrado.</EmptyState> : (
                <div className="space-y-2">{documents.map((doc) => <ListItem key={doc.id} title={doc.file_name || doc.doc_type || "Documento"} meta={`${doc.motorcycle_label || "Moto"} · ${doc.doc_date ? formatDate(doc.doc_date) : formatDate(doc.created_at)}${doc.deleted_at ? " · Excluído" : ""}`} />)}</div>
              )}
            </TabsContent>

            <TabsContent value="certificados" className="space-y-4">
              <SectionTitle title="Certificados" description="Certificados públicos emitidos a partir das motos do usuário." />
              {certificates.length === 0 ? <EmptyState>Nenhum certificado emitido.</EmptyState> : (
                <div className="space-y-2">{certificates.map((cert) => <ListItem key={cert.id} title={cert.public_token || "Certificado"} meta={`${cert.motorcycle_label || "Moto"} · ${cert.status || "status indefinido"} · ${formatDate(cert.created_at)}`} />)}</div>
              )}
            </TabsContent>

            <TabsContent value="chamados" className="space-y-4">
              <SectionTitle title="Chamados" description="Solicitações de suporte associadas a este usuário." />
              {tickets.length === 0 ? <EmptyState>Nenhum chamado aberto.</EmptyState> : (
                <div className="space-y-2">{tickets.map((ticket) => <ListItem key={ticket.id} title={`${ticket.code || "Chamado"} · ${ticket.title || ticket.subject || "Sem título"}`} meta={`${ticket.status || "status indefinido"} · ${ticket.priority || "prioridade não informada"} · ${formatDate(ticket.created_at)}`} />)}</div>
              )}
            </TabsContent>

            <TabsContent value="seguranca" className="space-y-5">
              <SectionTitle title="Ações administrativas" description="Acesso, recuperação de senha, homologação e controles sensíveis." />
              {profile.status === "blocked" && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs">
                  <strong>Bloqueado.</strong> Motivo: {profile.blocked_reason || "—"}
                  {profile.blocked_notes && <div className="mt-1 opacity-80">Obs.: {profile.blocked_notes}</div>}
                </div>
              )}
              {profile.status === "inactive" && (
                <div className="rounded-lg border border-border bg-muted p-3 text-xs">
                  <strong>Inativo.</strong> Motivo: {profile.inactive_reason || "—"}
                  {profile.inactive_notes && <div className="mt-1 opacity-80">Obs.: {profile.inactive_notes}</div>}
                </div>
              )}
              <div className="space-y-3 rounded-lg border border-border p-4">
                <SectionTitle title="Acesso" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <ConfirmDialog
                    trigger={<Button variant="outline" className="w-full justify-start"><KeyRound className="mr-1 h-4 w-4"/>Enviar link de redefinição de senha</Button>}
                    title="Enviar link de redefinição?"
                    description="Um link seguro será gerado com validade limitada. Se o envio de e-mail estiver desabilitado, a operação ficará registrada como envio simulado na Central de Comunicação."
                    confirmLabel="Enviar link"
                    onConfirm={async () => {
                      try {
                        await adminSendPasswordReset({ data: { userId: userId! } });
                        toast.success("Link de redefinição enviado (ou registrado como simulado).");
                        refetchAll();
                      } catch (e: any) {
                        toast.error(e?.message || "Falha ao enviar link");
                      }
                    }}
                  />
                  {profile.status !== "blocked" && (
                    <ReasonDialog
                      trigger={<Button variant="outline" className="w-full justify-start" disabled={!!isSelf}><ShieldAlert className="mr-1 h-4 w-4"/>Bloquear usuário</Button>}
                      title="Bloquear acesso"
                      description="O usuário perderá acesso imediatamente. O histórico é preservado."
                      reasons={BLOCK_REASONS}
                      submitLabel="Bloquear"
                      submitVariant="destructive"
                      onSubmit={async (reason, notes) => {
                        const { error } = await supabase.rpc("admin_block_user" as any, { _user: userId, _reason: reason, _notes: notes });
                        if (error) throw error;
                        toast.success("Usuário bloqueado");
                        refetchAll();
                      }}
                    />
                  )}
                  {profile.status !== "active" && (
                    <ReasonDialog
                      trigger={<Button variant="outline" className="w-full justify-start"><ShieldCheck className="mr-1 h-4 w-4"/>Reativar usuário</Button>}
                      title="Reativar usuário"
                      description="O usuário voltará a ter acesso ao TrailBook."
                      reasons={null}
                      submitLabel="Reativar"
                      onSubmit={async (_r, notes) => {
                        const { error } = await supabase.rpc("admin_reactivate_user" as any, { _user: userId, _notes: notes });
                        if (error) throw error;
                        toast.success("Usuário reativado");
                        refetchAll();
                      }}
                    />
                  )}
                  {profile.status !== "inactive" && (
                    <ReasonDialog
                      trigger={<Button variant="outline" className="w-full justify-start" disabled={!!isSelf}><UserX className="mr-1 h-4 w-4"/>Desativar usuário</Button>}
                      title="Desativar usuário"
                      description="O acesso é bloqueado, mas moto, documentos, eventos, certificados e chamados permanecem preservados."
                      reasons={DEACTIVATE_REASONS}
                      submitLabel="Desativar"
                      submitVariant="destructive"
                      onSubmit={async (reason, notes) => {
                        const { error } = await supabase.rpc("admin_deactivate_user" as any, { _user: userId, _reason: reason, _notes: notes });
                        if (error) throw error;
                        toast.success("Usuário desativado");
                        refetchAll();
                      }}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-border p-4">
                <SectionTitle title="Homologação" description="Limpeza controlada de contas de teste." />
                <div className="flex items-center gap-3 rounded-md border border-border p-3">
                  <Switch
                    checked={!!profile.is_homologation}
                    onCheckedChange={async (v) => {
                      const { error } = await supabase.rpc("admin_update_user" as any, { _user: userId, _is_homologation: v, _reason: "Alteração de flag de homologação" });
                      if (error) return toast.error(error.message);
                      toast.success(v ? "Marcado como homologação" : "Removida flag de homologação");
                      refetchAll();
                    }}
                  />
                  <Label className="text-sm">Marcar como usuário de homologação</Label>
                </div>
                {profile.is_homologation && !isAdminProfile && !isSelf && (
                  <DeleteHomologDialog
                    userId={userId!}
                    profile={profile}
                    counts={{
                      motos: row?.motorcycles_count ?? motorcycles.length,
                      docs: row?.documents_count ?? documents.length,
                      certs: row?.certificates_count ?? certificates.length,
                      tickets: row?.tickets_count ?? tickets.length,
                    }}
                    onDone={() => { refetchAll(); onClose(); }}
                  />
                )}
                {(isAdminProfile || isSelf) && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    {isSelf ? "Você não pode excluir a si mesmo." : "Administradores não podem ser excluídos."}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="audit" className="space-y-4">
              <SectionTitle title="Auditoria" description="Histórico de ações administrativas registradas." />
              <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {audit.isLoading && <div className="p-4 text-center text-xs text-muted-foreground">Carregando auditoria…</div>}
                {!audit.isLoading && (audit.data ?? []).length === 0 && (
                  <div className="p-4 text-center text-xs text-muted-foreground">Nenhuma ação administrativa registrada.</div>
                )}
                {(audit.data ?? []).map((e) => (
                  <div key={e.id} className="p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{e.action}{e.field ? ` · ${e.field}` : ""}</span>
                      <span className="text-muted-foreground">{formatDate(e.created_at)}</span>
                    </div>
                    {e.reason && <div className="mt-1"><strong>Motivo:</strong> {e.reason}</div>}
                    {e.notes && <div className="opacity-80">Obs.: {e.notes}</div>}
                    {(e.old_value != null || e.new_value != null) && (
                      <div className="mt-1 font-mono text-[10px] opacity-70 truncate">
                        {JSON.stringify(e.old_value)} → {JSON.stringify(e.new_value)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">{icon}<span>{label}</span></div>
      <div className="mt-1 break-words text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function ListItem({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="break-words text-sm font-medium text-foreground">{title}</div>
      <div className="mt-1 break-words text-xs text-muted-foreground">{meta}</div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

function EditForm({ profile, row, isSelf, isAdmin, onSaved }: { profile: any; row: any; isSelf: boolean; isAdmin: boolean; onSaved: () => void }) {
  const [form, setForm] = useState({
    full_name: profile.full_name ?? "",
    birth_date: profile.birth_date ?? "",
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    plan: profile.plan ?? "free",
    status: profile.status ?? "active",
    is_admin: !!isAdmin,
  });
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmEmail, setConfirmEmail] = useState(false);

  const changes = useMemo(() => {
    const diffs: string[] = [];
    if (form.full_name !== (profile.full_name ?? "")) diffs.push("Nome");
    if (form.birth_date !== (profile.birth_date ?? "")) diffs.push("Nascimento");
    if (form.phone !== (profile.phone ?? "")) diffs.push("WhatsApp");
    if ((form.email || "").toLowerCase() !== (profile.email ?? "").toLowerCase()) diffs.push("E-mail");
    if (form.plan !== profile.plan) diffs.push("Plano");
    if (form.status !== profile.status) diffs.push("Status");
    if (form.is_admin !== isAdmin) diffs.push("Perfil");
    return diffs;
  }, [form, profile, isAdmin]);

  const emailChanged = (form.email || "").toLowerCase() !== (profile.email ?? "").toLowerCase();

  async function save() {
    if (changes.length === 0) return toast.info("Nenhuma alteração");
    if (emailChanged && !confirmEmail) return toast.error("Confirme a alteração de e-mail marcando a caixa de confirmação");
    setSaving(true);
    const { error } = await supabase.rpc("admin_update_user" as any, {
      _user: profile.id,
      _full_name: form.full_name || null,
      _birth_date: form.birth_date || null,
      _phone: form.phone || null,
      _email: emailChanged ? form.email : null,
      _plan: form.plan || null,
      _status: form.status || null,
      _is_admin: form.is_admin !== isAdmin ? form.is_admin : null,
      _is_homologation: null,
      _reason: reason || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Dados atualizados");
    onSaved();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="text-xs">Nome completo</Label>
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Data de nascimento</Label>
          <Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">WhatsApp</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">E-mail</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Plano</Label>
          <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
              <SelectItem value="workshop">Oficina</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="blocked">Bloqueado</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-border p-2 sm:col-span-2">
          <Switch
            checked={form.is_admin}
            disabled={isSelf && isAdmin}
            onCheckedChange={(v) => setForm({ ...form, is_admin: v })}
          />
          <Label className="text-xs">Perfil de Administrador {isSelf && isAdmin && "(você não pode se auto-rebaixar)"}</Label>
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Motivo / Observação (opcional)</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </div>
        {emailChanged && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs sm:col-span-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={confirmEmail} onChange={(e) => setConfirmEmail(e.target.checked)} className="mt-0.5"/>
              <span>Confirmo a alteração de e-mail (isso impacta login e comunicação com o usuário).</span>
            </label>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {changes.length ? <>Alterações: <strong>{changes.join(", ")}</strong></> : "Sem alterações"}
        </div>
        <Button size="sm" className="w-full sm:w-auto" onClick={save} disabled={saving || changes.length === 0}>
          <Pencil className="mr-1 h-4 w-4"/>Salvar alterações
        </Button>
      </div>
    </div>
  );
}

function ReasonDialog({
  trigger, title, description, reasons, submitLabel, submitVariant = "default", onSubmit,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  reasons: string[] | null;
  submitLabel: string;
  submitVariant?: "default" | "destructive";
  onSubmit: (reason: string, notes: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(reasons?.[0] ?? "");
  const [other, setOther] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const finalReason = reason === "Outro" ? other.trim() : reason;
  async function submit() {
    if (reasons && !finalReason) return toast.error("Selecione um motivo");
    setBusy(true);
    try {
      await onSubmit(finalReason || "—", notes.trim() || null);
      setOpen(false); setReason(reasons?.[0] ?? ""); setOther(""); setNotes("");
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    } finally { setBusy(false); }
  }
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <span onClick={(e) => { if (!(e.target as HTMLElement).closest("button")?.hasAttribute("disabled")) setOpen(true); }}>{trigger}</span>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          {reasons && (
            <div>
              <Label className="text-xs">Motivo</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{reasons.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
              {reason === "Outro" && (
                <Input className="mt-2" placeholder="Descreva o motivo" value={other} onChange={(e) => setOther(e.target.value)} />
              )}
            </div>
          )}
          <div>
            <Label className="text-xs">Observação (opcional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={submitVariant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            onClick={(e) => { e.preventDefault(); submit(); }}
            disabled={busy}
          >
            {submitLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConfirmDialog({ trigger, title, description, confirmLabel, onConfirm }: {
  trigger: React.ReactNode; title: string; description: string; confirmLabel: string; onConfirm: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <span onClick={(e) => { if (!(e.target as HTMLElement).closest("button")?.hasAttribute("disabled")) setOpen(true); }}>{trigger}</span>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={async (e) => { e.preventDefault(); setBusy(true); try { await onConfirm(); setOpen(false); } finally { setBusy(false); } }}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteHomologDialog({ userId, profile, counts, onDone }: {
  userId: string; profile: any; counts: { motos: number; docs: number; certs: number; tickets: number }; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState(DELETE_REASONS[0]);
  const [other, setOther] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const finalReason = reason === "Outro" ? other.trim() : reason;

  async function doDelete() {
    if (!finalReason) return toast.error("Motivo obrigatório");
    if (confirmation !== "EXCLUIR") return toast.error("Digite EXCLUIR para confirmar");
    setBusy(true);
    try {
      await adminDeleteHomologUser({ data: { userId, reason: finalReason, confirmation } });
      toast.success("Usuário de homologação excluído");
      setOpen(false); onDone();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao excluir");
    } finally { setBusy(false); }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <span onClick={() => { setOpen(true); setStep(1); }}>
        <Button variant="destructive" size="sm"><Trash2 className="mr-1 h-4 w-4"/>Excluir usuário de homologação</Button>
      </span>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir usuário de HOMOLOGAÇÃO</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação removerá definitivamente um usuário de HOMOLOGAÇÃO. Essa operação <strong>não poderá ser desfeita</strong>.
            Use apenas para limpeza de testes e cenários de homologação.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {step === 1 && (
          <div className="space-y-3 text-xs">
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
              <div><strong>{profile.full_name || "Usuário"}</strong> · {profile.email}</div>
              <div className="mt-2 grid grid-cols-2 gap-1">
                <div>Motos: <strong>{counts.motos}</strong></div>
                <div>Documentos: <strong>{counts.docs}</strong></div>
                <div>Certificados: <strong>{counts.certs}</strong></div>
                <div>Chamados: <strong>{counts.tickets}</strong></div>
              </div>
            </div>
            <div>
              <Label className="text-xs">Motivo</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-9"><SelectValue/></SelectTrigger>
                <SelectContent>{DELETE_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
              {reason === "Outro" && <Input className="mt-2" value={other} onChange={(e) => setOther(e.target.value)} placeholder="Descreva o motivo"/>}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button variant="destructive" onClick={() => setStep(2)} disabled={!finalReason}>Continuar</Button>
            </AlertDialogFooter>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 text-xs">
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
              Confirme a exclusão digitando <strong>EXCLUIR</strong> no campo abaixo.
            </div>
            <Input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="EXCLUIR"/>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button variant="destructive" disabled={busy || confirmation !== "EXCLUIR"} onClick={doDelete}>
                Excluir definitivamente
              </Button>
            </AlertDialogFooter>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}