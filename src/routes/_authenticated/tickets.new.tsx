import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { TICKET_MODULES, TICKET_PRIORITIES, TICKET_TYPES } from "@/lib/tickets";
import { Paperclip } from "lucide-react";
import { APP_VERSION, BUILD_ID } from "@/lib/version/build-info";

export const Route = createFileRoute("/_authenticated/tickets/new")({
  head: () => ({ meta: [{ title: "Novo chamado — TrailBook" }] }),
  component: NewTicketPage,
});

function NewTicketPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [type, setType] = useState<string>("question");
  const [module, setModule] = useState<string>("other");
  const [priority, setPriority] = useState<string>("medium");
  const [motoId, setMotoId] = useState<string>("none");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const motos = useQuery({
    queryKey: ["my-motos-min"],
    queryFn: async () => {
      const { data: sessionData, error } = await supabase.auth.getSession();
      if (error) throw error;
      const uid = sessionData.session?.user.id;
      if (!uid) return [];
      const { data } = await supabase
        .from("motorcycles")
        .select("id, brand, model, nickname")
        .eq("owner_id", uid)
        .neq("status" as never, "archived" as never)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return toast.error("Preencha título e descrição");
    setSaving(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const userId = sessionData.session?.user.id;
      if (!userId) {
        toast.error("Sua sessão expirou. Entre novamente para abrir o chamado.");
        navigate({ to: "/auth", search: {} });
        return;
      }

      // Anexa versão/build ao final da descrição para dar ao suporte contexto
      // sobre a build utilizada pelo usuário (v1.7 — controle de versão).
      const standalone =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(display-mode: standalone)").matches;
      const meta =
        `\n\n— — —\nTrailBook ${APP_VERSION} · build ${BUILD_ID}\n` +
        `Rota: ${window.location.pathname}\n` +
        `Modo: ${standalone ? "PWA (Tela de Início)" : "Navegador"}\n` +
        `Agente: ${window.navigator?.userAgent ?? ""}`;
      const { data, error } = await supabase.from("tickets").insert({
        user_id: userId,
        type: type as any, module: module as any, priority: priority as any,
        motorcycle_id: motoId !== "none" ? motoId : null,
        title: title.trim(), description: description.trim() + meta,
      }).select("id, code, status, user_id").single();
      if (error) throw error;

      // Upload de anexos, se houver
      for (const f of files) {
        if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name}: máx 10 MB`); continue; }
        const ext = f.name.split(".").pop() ?? "bin";
        const path = `${userId}/${data.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("ticket-attachments").upload(path, f);
        if (upErr) { toast.error(upErr.message); continue; }
        const { error: attachErr } = await supabase.from("ticket_attachments").insert({
          ticket_id: data.id, uploaded_by: userId,
          bucket: "ticket-attachments", storage_path: path,
          file_name: f.name, mime_type: f.type || null, size_bytes: f.size,
        });
        if (attachErr) toast.error(`Anexo ${f.name}: não foi possível vincular ao chamado.`);
      }

      await qc.invalidateQueries({ queryKey: ["tickets"] });
      try {
        sessionStorage.setItem("tb_ticket_created", data.id);
      } catch { /* noop */ }
      navigate({ to: "/tickets/$id", params: { id: data.id } });
    } catch (err) {
      const supportCode = crypto.randomUUID().slice(0, 8).toUpperCase();
      console.error("[tickets:new] Falha ao abrir chamado", { supportCode, err });
      toast.error(`Não foi possível abrir o chamado agora. Código de suporte: ${supportCode}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Novo chamado" description="Nos conte o que aconteceu — quanto mais detalhes, mais rápido resolvemos." crumbs={[{ label: "Meus chamados", to: "/tickets" }, { label: "Novo" }]} />
      <form onSubmit={submit} className="space-y-5 rounded-xl border border-border bg-card p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <FieldSelect label="Tipo" value={type} onChange={setType} options={TICKET_TYPES as any} />
          <FieldSelect label="Módulo relacionado" value={module} onChange={setModule} options={TICKET_MODULES as any} />
          <FieldSelect label="Prioridade" value={priority} onChange={setPriority} options={TICKET_PRIORITIES as any} />
          <div className="space-y-2">
            <Label>Moto relacionada (opcional)</Label>
            <Select value={motoId} onValueChange={setMotoId}>
              <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {(motos.data ?? []).map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>{m.nickname || `${m.brand} ${m.model}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Resumo em uma frase" />
        </div>
        <div className="space-y-2">
          <Label>Descrição</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} placeholder="Descreva o problema, quando aconteceu e o que já tentou." />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2"><Paperclip className="h-4 w-4" /> Anexos (opcional)</Label>
          <Input
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {files.length > 0 && (
            <ul className="text-xs text-muted-foreground">
              {files.map((f, i) => <li key={i}>• {f.name} ({(f.size/1024/1024).toFixed(2)} MB)</li>)}
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground">Imagens ou PDFs até 10 MB cada.</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate({ to: "/tickets" })}>Cancelar</Button>
          <Button type="submit" className="btn-glow" disabled={saving}>{saving ? "Enviando…" : "Enviar chamado"}</Button>
        </div>
      </form>
    </div>
  );
}

function FieldSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly { value: string; label: string }[] }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
        </SelectContent>
      </Select>
    </div>
  );
}