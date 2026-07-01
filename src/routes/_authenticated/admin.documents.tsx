import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOC_TYPES, DOC_TYPE_LABEL, formatBytes, type DocType } from "@/lib/motorcycle-documents";
import { formatDate } from "@/lib/trailbook";
import { ShieldCheck, ShieldAlert, FileText } from "lucide-react";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_authenticated/admin/documents")({
  head: () => ({ meta: [{ title: "Admin · Documentos — TrailBook" }] }),
  component: AdminDocs,
});

function AdminDocs() {
  const { isAdmin, loading } = useIsAdmin();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | DocType>("all");
  const [status, setStatus] = useState<"all" | "active" | "trash">("all");

  const q = useQuery({
    queryKey: ["admin-docs"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("motorcycle_documents" as never)
        .select("*").order("updated_at", { ascending: false }).limit(500);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Array<any>;
      const motoIds = Array.from(new Set(rows.map((r) => r.motorcycle_id)));
      const userIds = Array.from(new Set(rows.map((r) => r.created_by).filter(Boolean)));
      const [{ data: motos }, { data: profs }] = await Promise.all([
        supabase.from("motorcycles").select("id, nickname, brand, model, trailbook_id, owner_id").in("id", motoIds),
        supabase.from("profiles").select("id, full_name, email").in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      ]);
      const motoMap: Record<string, any> = {}; (motos ?? []).forEach((m: any) => { motoMap[m.id] = m; });
      const userMap: Record<string, string> = {}; (profs ?? []).forEach((p: any) => { userMap[p.id] = p.full_name ?? p.email ?? "—"; });
      return rows.map((r) => ({ ...r, _moto: motoMap[r.motorcycle_id], _author: userMap[r.created_by] ?? "—" }));
    },
  });

  const filtered = useMemo(() => {
    let list = q.data ?? [];
    if (type !== "all") list = list.filter((r: any) => r.doc_type === type);
    if (status === "active") list = list.filter((r: any) => r.is_current && !r.deleted_at);
    if (status === "trash") list = list.filter((r: any) => r.deleted_at);
    if (query.trim()) {
      const t = query.toLowerCase();
      list = list.filter((r: any) =>
        (r.file_name ?? "").toLowerCase().includes(t) ||
        (r._author ?? "").toLowerCase().includes(t) ||
        (r._moto?.trailbook_id ?? "").toLowerCase().includes(t) ||
        (r._moto?.nickname ?? "").toLowerCase().includes(t),
      );
    }
    return list;
  }, [q.data, type, status, query]);

  if (loading) return <Skeleton className="h-40" />;
  if (!isAdmin) return <p className="text-sm text-muted-foreground">Acesso restrito.</p>;

  return (
    <div className="space-y-6">
      <PageHeader title="Documentos (auditoria)" description="Visão administrativa. Somente leitura." />

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar por arquivo, usuário, TrailBook ID…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 w-72" />
        <Select value={type} onValueChange={(v) => setType(v as never)}>
          <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {DOC_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.icon} {d.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as never)}>
          <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos (atuais)</SelectItem>
            <SelectItem value="trash">Lixeira</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {q.isLoading ? <Skeleton className="h-40" /> : (
        <div className="surface-elevated overflow-x-auto rounded-2xl">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2">Documento</th>
                <th className="px-3 py-2">Moto</th>
                <th className="px-3 py-2">Responsável</th>
                <th className="px-3 py-2">Versão</th>
                <th className="px-3 py-2">Tamanho</th>
                <th className="px-3 py-2">Integridade (SHA-256)</th>
                <th className="px-3 py-2">Atualizado</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr key={r.id} className="border-b border-border/50 align-top">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <div>
                        <div className="font-medium">{r.custom_label || DOC_TYPE_LABEL[r.doc_type as DocType]}</div>
                        <div className="text-[11px] text-muted-foreground">{r.file_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{r._moto?.nickname ?? `${r._moto?.brand ?? ""} ${r._moto?.model ?? ""}`}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{r._moto?.trailbook_id ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{r._author}</td>
                  <td className="px-3 py-2">v{r.version}</td>
                  <td className="px-3 py-2 text-xs">{formatBytes(r.size_bytes)}</td>
                  <td className="px-3 py-2">
                    {r.sha256 ? (
                      <div className="flex items-center gap-1 text-emerald-400 text-xs">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span className="font-mono">{r.sha256.slice(0, 12)}…</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-amber-400 text-xs">
                        <ShieldAlert className="h-3.5 w-3.5" /> não calculado
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{formatDate(r.updated_at)}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.deleted_at
                      ? <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-destructive">Lixeira</span>
                      : r.is_current
                        ? <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-400">Atual</span>
                        : <span className="rounded bg-muted px-1.5 py-0.5">Antiga</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground text-sm">Nenhum documento encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}