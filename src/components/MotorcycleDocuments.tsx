import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  FileText, Upload, Eye, Download, Replace, Trash2, RotateCcw, History, Pencil,
  ShieldCheck, CheckCircle2, XCircle, Filter, Search, Layers, Inbox, X, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  DOC_TYPES, DOC_TYPE_LABEL, DOC_TYPE_ICON, RECOMMENDED_DOC_TYPES,
  MAX_FILE_BYTES, ACCEPTED_MIME, formatBytes, sha256Hex, type DocType,
} from "@/lib/motorcycle-documents";
import { brl, formatDate } from "@/lib/trailbook";
import { cn } from "@/lib/utils";
import { useMotoDocumentPendency } from "@/hooks/useDocumentPendencies";
import {
  ORIGIN_DOC_TYPES, clearOriginSnooze, suggestOriginDocType,
  type OriginDocType,
} from "@/lib/origin-status";
import { SingleBadgeChip } from "@/components/badges/BadgeSection";

type Doc = {
  id: string;
  motorcycle_id: string;
  doc_type: DocType;
  bucket: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  doc_number: string | null;
  doc_date: string | null;
  issuer: string | null;
  amount: number | null;
  notes: string | null;
  custom_label: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // v1.0.1
  version: number;
  parent_id: string | null;
  is_current: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  sha256: string | null;
  size_bytes: number | null;
};

const TRASH_TTL_DAYS = 30;

export function MotorcycleDocuments({
  motorcycleId,
  openOriginUpload = false,
}: {
  motorcycleId: string;
  /** Quando `true`, abre automaticamente o fluxo de anexo do documento de origem. */
  openOriginUpload?: boolean;
}) {
  const qc = useQueryClient();
  const [upload, setUpload] = useState<{ files: File[]; originMode?: boolean } | null>(null);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [replacing, setReplacing] = useState<Doc | null>(null);
  const [timeline, setTimeline] = useState<Doc | null>(null);
  const [tab, setTab] = useState<"active" | "trash">("active");
  const [filterType, setFilterType] = useState<"all" | DocType>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "old" | "name" | "type">("recent");
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const pendency = useMotoDocumentPendency(motorcycleId);
  const originSuggestedType: OriginDocType = suggestOriginDocType(pendency.data?.origin_type ?? null);

  // Abre automaticamente o upload em modo "origem" quando chegar via ?kind=origin.
  const [autoOpened, setAutoOpened] = useState(false);
  useEffect(() => {
    if (openOriginUpload && !autoOpened) {
      setUpload({ files: [], originMode: true });
      setAutoOpened(true);
    }
  }, [openOriginUpload, autoOpened]);

  const docs = useQuery({
    queryKey: ["motorcycle-documents", motorcycleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorcycle_documents" as never)
        .select("*")
        .eq("motorcycle_id", motorcycleId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as Doc[];
      // Carregar nomes dos responsáveis
      const ids = Array.from(new Set(rows.map((r) => r.created_by).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => { map[p.id] = p.full_name ?? p.email ?? "—"; });
        setProfiles(map);
      }
      return rows;
    },
  });

  const rows = docs.data ?? [];
  const active = rows.filter((r) => r.is_current && !r.deleted_at);
  const trashed = rows.filter((r) => r.deleted_at);

  // ==== métricas do dashboard ====
  const dashboard = useMemo(() => {
    const byType: Record<string, number> = {};
    for (const d of active) byType[d.doc_type] = (byType[d.doc_type] ?? 0) + 1;
    const recPresent = RECOMMENDED_DOC_TYPES.filter((t) => (byType[t] ?? 0) > 0).length;
    const completeness = Math.round((recPresent / RECOMMENDED_DOC_TYPES.length) * 100);
    const missing = RECOMMENDED_DOC_TYPES.filter((t) => !(byType[t] ?? 0));
    const last = active[0] ?? null;
    return { byType, completeness, missing, last, total: active.length };
  }, [active]);

  // ==== list filtrada / ordenada ====
  const filtered = useMemo(() => {
    const src = tab === "active" ? active : trashed;
    let list = src;
    if (filterType !== "all") list = list.filter((d) => d.doc_type === filterType);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((d) =>
        (d.custom_label ?? DOC_TYPE_LABEL[d.doc_type]).toLowerCase().includes(q) ||
        (d.file_name ?? "").toLowerCase().includes(q) ||
        (d.doc_number ?? "").toLowerCase().includes(q) ||
        (d.issuer ?? "").toLowerCase().includes(q),
      );
    }
    list = [...list].sort((a, b) => {
      if (sort === "recent") return +new Date(b.updated_at) - +new Date(a.updated_at);
      if (sort === "old") return +new Date(a.updated_at) - +new Date(b.updated_at);
      if (sort === "name") return (a.custom_label ?? DOC_TYPE_LABEL[a.doc_type]).localeCompare(b.custom_label ?? DOC_TYPE_LABEL[b.doc_type]);
      return a.doc_type.localeCompare(b.doc_type);
    });
    return list;
  }, [tab, active, trashed, filterType, query, sort]);

  // ==== agrupamento por tipo (visão categorizada) ====
  const grouped = useMemo(() => {
    const g: Record<string, Doc[]> = {};
    for (const d of filtered) (g[d.doc_type] ??= []).push(d);
    return g;
  }, [filtered]);
  const [viewMode, setViewMode] = useState<"all" | "grouped">("all");

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["motorcycle-documents", motorcycleId] });
    qc.invalidateQueries({ queryKey: ["audit", motorcycleId] });
    qc.invalidateQueries({ queryKey: ["document-pendencies"] });
    qc.invalidateQueries({ queryKey: ["document-pendencies", motorcycleId] });
  }

  async function openFile(doc: Doc, download = false) {
    if (!doc.storage_path || !doc.bucket) {
      toast.error("Arquivo indisponível", { description: "Este documento não possui arquivo associado." });
      return;
    }
    try {
      const opts = download ? { download: doc.file_name ?? "documento" } : undefined;
      const { data, error } = await supabase.storage.from(doc.bucket).createSignedUrl(doc.storage_path, 300, opts as never);
      if (error || !data?.signedUrl) {
        const msg = error?.message ?? "";
        const missing = /not found|Object not found|404/i.test(msg);
        toast.error(missing ? "Arquivo não encontrado no cofre" : "Não foi possível abrir este documento", {
          description: missing
            ? "O arquivo original pode ter sido removido do storage. Tente novamente ou reenvie o documento."
            : "Tente novamente em instantes. Se persistir, use a opção Substituir para reenviar o arquivo.",
          action: !download ? { label: "Baixar", onClick: () => openFile(doc, true) } : undefined,
        });
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error("Não foi possível abrir este documento", {
        description: e?.message ?? "Erro inesperado ao acessar o arquivo.",
      });
    }
  }

  async function softDelete(doc: Doc) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("motorcycle_documents" as never)
      .update({ deleted_at: new Date().toISOString(), deleted_by: u.user!.id, is_current: false } as never)
      .eq("id", doc.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Documento movido para a lixeira (30 dias)");
    invalidate();
  }

  async function restoreDoc(doc: Doc) {
    // se existe outra versão current na mesma cadeia, não promove
    const rootId = doc.parent_id ?? doc.id;
    const chain = rows.filter((r) => r.id === rootId || r.parent_id === rootId || r.id === doc.parent_id);
    const hasCurrent = chain.some((r) => r.is_current && !r.deleted_at && r.id !== doc.id);
    const { error } = await supabase.from("motorcycle_documents" as never)
      .update({ deleted_at: null, deleted_by: null, is_current: !hasCurrent } as never)
      .eq("id", doc.id);
    if (error) { toast.error(error.message); return; }
    toast.success(hasCurrent ? "Restaurado como versão antiga" : "Documento restaurado");
    invalidate();
  }

  async function hardDelete(doc: Doc) {
    await supabase.storage.from(doc.bucket).remove([doc.storage_path]);
    const { error } = await supabase.from("motorcycle_documents" as never).delete().eq("id", doc.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Documento excluído definitivamente");
    invalidate();
  }

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Central de Documentos
          </h2>
          <p className="text-xs text-muted-foreground">
            Cofre digital privado da motocicleta. Versionado, auditado e protegido — visível apenas para você.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Storage privado · URL assinada · SHA-256
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SingleBadgeChip motorcycleId={motorcycleId} badgeId="origin_proven" />
        <SingleBadgeChip motorcycleId={motorcycleId} badgeId="documentation_complete" />
      </div>

      {/* Dashboard */}
      <div className="surface-elevated rounded-2xl p-4 md:p-5">
        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total de documentos</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="font-display text-4xl font-black">{dashboard.total}</div>
              <div className="text-xs text-muted-foreground">ativos</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DOC_TYPES.map((t) => {
                const c = dashboard.byType[t.value] ?? 0;
                return (
                  <button
                    key={t.value}
                    onClick={() => { setTab("active"); setFilterType(t.value); }}
                    className={cn(
                      "flex items-center justify-between rounded-xl border border-border/60 bg-card px-3 py-2 text-left text-xs transition hover:border-primary/50",
                      filterType === t.value && "border-primary/60 bg-primary/5",
                    )}
                  >
                    <span className="flex items-center gap-1.5"><span>{t.icon}</span><span className="truncate">{t.label}</span></span>
                    <span className={cn("font-bold", c === 0 ? "text-muted-foreground" : "text-primary")}>
                      {c === 0 ? "✖" : c === 1 ? "✔" : c}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4 rounded-xl bg-card p-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Completude da documentação</div>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="font-display text-3xl font-black text-primary">{dashboard.completeness}%</div>
                <div className="text-xs text-muted-foreground">recomendados</div>
              </div>
              <Progress value={dashboard.completeness} className="mt-2 h-2" />
              <p className="mt-2 text-xs text-muted-foreground">
                {dashboard.missing.length === 0
                  ? "Todos os documentos recomendados estão anexados. 🎉"
                  : `Faltam ${dashboard.missing.length} documento(s) recomendado(s): ${dashboard.missing.map((t) => DOC_TYPE_LABEL[t]).join(", ")}.`}
              </p>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {dashboard.last ? (
                <>Última atualização: <strong className="text-foreground">{formatDate(dashboard.last.updated_at)}</strong>
                  {" · "}{new Date(dashboard.last.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  {" · por "}{profiles[dashboard.last.created_by ?? ""] ?? "—"}</>
              ) : "Nenhum documento anexado."}
            </div>
            <Button className="btn-glow" onClick={() => setUpload({ files: [] })}>
              <Upload className="h-4 w-4" /> Anexar Documentos
            </Button>
          </div>
        </div>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "trash")}>
          <TabsList>
            <TabsTrigger value="active"><Inbox className="mr-1 h-3.5 w-3.5" /> Ativos ({active.length})</TabsTrigger>
            <TabsTrigger value="trash"><Trash2 className="mr-1 h-3.5 w-3.5" /> Lixeira ({trashed.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome / nº / loja" className="h-8 w-52 pl-7 text-xs" />
          </div>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as never)}>
            <SelectTrigger className="h-8 w-40 text-xs"><Filter className="mr-1 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {DOC_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as never)}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="old">Mais antigos</SelectItem>
              <SelectItem value="name">Nome (A→Z)</SelectItem>
              <SelectItem value="type">Tipo</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setViewMode((m) => (m === "all" ? "grouped" : "all"))}>
            <Layers className="h-4 w-4" /> {viewMode === "all" ? "Agrupar" : "Todos"}
          </Button>
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <EmptyState tab={tab} onUpload={() => setUpload({ files: [] })} />
      ) : viewMode === "all" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => (
            <DocCard
              key={d.id}
              doc={d}
              authorName={profiles[d.created_by ?? ""] ?? "—"}
              isTrash={tab === "trash"}
              onView={() => openFile(d)}
              onDownload={() => openFile(d, true)}
              onEdit={() => setEditing(d)}
              onReplace={() => setReplacing(d)}
              onRemove={() => softDelete(d)}
              onRestore={() => restoreDoc(d)}
              onHardDelete={() => hardDelete(d)}
              onTimeline={() => setTimeline(d)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([type, list]) => (
            <div key={type} className="rounded-2xl border border-border bg-card/50 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <span>{DOC_TYPE_ICON[type as DocType]}</span> {DOC_TYPE_LABEL[type as DocType]} ({list.length})
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((d) => (
                  <DocCard
                    key={d.id} doc={d} authorName={profiles[d.created_by ?? ""] ?? "—"}
                    isTrash={tab === "trash"}
                    onView={() => openFile(d)} onDownload={() => openFile(d, true)}
                    onEdit={() => setEditing(d)} onReplace={() => setReplacing(d)}
                    onRemove={() => softDelete(d)} onRestore={() => restoreDoc(d)}
                    onHardDelete={() => hardDelete(d)} onTimeline={() => setTimeline(d)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {upload && (
        <UploadDialog
          motorcycleId={motorcycleId}
          initialFiles={upload.files}
          originMode={upload.originMode ?? false}
          suggestedOriginType={originSuggestedType}
          userId={uid}
          onClose={() => setUpload(null)}
          onDone={() => { setUpload(null); invalidate(); }}
        />
      )}
      {editing && (
        <MetadataDialog doc={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); invalidate(); }} />
      )}
      {replacing && (
        <ReplaceDialog doc={replacing} onClose={() => setReplacing(null)} onSaved={() => { setReplacing(null); invalidate(); }} />
      )}
      {timeline && (
        <TimelineDialog doc={timeline} allRows={rows} profiles={profiles} onClose={() => setTimeline(null)} />
      )}
    </section>
  );
}

/* ============================================================= */

function DocCard({
  doc, authorName, isTrash,
  onView, onDownload, onEdit, onReplace, onRemove, onRestore, onHardDelete, onTimeline,
}: {
  doc: Doc; authorName: string; isTrash: boolean;
  onView: () => void; onDownload: () => void; onEdit: () => void; onReplace: () => void;
  onRemove: () => void; onRestore: () => void; onHardDelete: () => void; onTimeline: () => void;
}) {
  const title = doc.custom_label || DOC_TYPE_LABEL[doc.doc_type];
  const trashRemaining = doc.deleted_at
    ? Math.max(0, TRASH_TTL_DAYS - Math.floor((Date.now() - +new Date(doc.deleted_at)) / 86_400_000))
    : null;

  return (
    <div className={cn(
      "surface-elevated flex flex-col rounded-2xl border border-border/70 p-4 transition hover:border-primary/40",
      isTrash && "opacity-90 border-dashed",
    )}>
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-lg">
          {DOC_TYPE_ICON[doc.doc_type]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold">{title}</div>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">v{doc.version}</span>
            {doc.is_current && !doc.deleted_at && (
              <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">Atual</span>
            )}
            {doc.sha256 && (
              <span title="Integridade verificada (SHA-256)" className="text-emerald-400"><ShieldCheck className="h-3.5 w-3.5" /></span>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {DOC_TYPE_LABEL[doc.doc_type]} · {formatBytes(doc.size_bytes)} · {formatDate(doc.updated_at)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            por <span className="text-foreground">{authorName}</span>
          </div>
          {doc.doc_type === "invoice" && (doc.doc_number || doc.issuer || doc.amount != null) && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              {doc.doc_number && <span>Nº {doc.doc_number}</span>}
              {doc.issuer && <span>{doc.issuer}</span>}
              {doc.amount != null && <span>{brl(Number(doc.amount))}</span>}
            </div>
          )}
        </div>
      </div>

      {isTrash && trashRemaining != null && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-amber-300">
          Será excluído definitivamente em {trashRemaining} dia(s).
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border/60 pt-2">
        {!isTrash ? (
          <>
            <IconBtn label="Visualizar" onClick={onView}><Eye className="h-4 w-4" /></IconBtn>
            <IconBtn label="Baixar" onClick={onDownload}><Download className="h-4 w-4" /></IconBtn>
            <IconBtn label="Editar dados" onClick={onEdit}><Pencil className="h-4 w-4" /></IconBtn>
            <IconBtn label="Substituir (nova versão)" onClick={onReplace}><Replace className="h-4 w-4" /></IconBtn>
            <IconBtn label="Linha do tempo" onClick={onTimeline}><History className="h-4 w-4" /></IconBtn>
            <Confirm
              trigger={<IconBtn label="Enviar para lixeira"><Trash2 className="h-4 w-4 text-destructive" /></IconBtn>}
              title={`Mover "${title}" para a lixeira?`}
              description="O documento fica na lixeira por 30 dias, com opção de restaurar."
              action="Mover para lixeira" onConfirm={onRemove}
            />
          </>
        ) : (
          <>
            <IconBtn label="Visualizar" onClick={onView}><Eye className="h-4 w-4" /></IconBtn>
            <IconBtn label="Restaurar" onClick={onRestore}><RotateCcw className="h-4 w-4" /></IconBtn>
            <IconBtn label="Linha do tempo" onClick={onTimeline}><History className="h-4 w-4" /></IconBtn>
            <Confirm
              trigger={<IconBtn label="Excluir definitivamente"><XCircle className="h-4 w-4 text-destructive" /></IconBtn>}
              title={`Excluir "${title}" definitivamente?`}
              description="Esta ação não pode ser desfeita. O arquivo é removido do storage e o histórico é preservado na auditoria."
              action="Excluir definitivamente" onConfirm={onHardDelete}
            />
          </>
        )}
      </div>
    </div>
  );
}

function IconBtn({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function Confirm({
  trigger, title, description, action, onConfirm,
}: { trigger: React.ReactNode; title: string; description: string; action: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EmptyState({ tab, onUpload }: { tab: "active" | "trash"; onUpload: () => void }) {
  if (tab === "trash") {
    return (
      <div className="surface-elevated grid place-items-center rounded-2xl p-10 text-center">
        <Trash2 className="h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">A lixeira está vazia.</p>
      </div>
    );
  }
  return (
    <div className="surface-elevated grid place-items-center rounded-2xl p-10 text-center">
      <FileText className="h-8 w-8 text-primary" />
      <div className="mt-3 font-display text-lg font-bold">Comece organizando seu cofre digital</div>
      <p className="mt-1 max-w-md text-xs text-muted-foreground">
        Anexe Nota Fiscal, manual, garantia, contratos, importação e outros documentos permanentes.
        Cada arquivo é versionado, auditado e permanece disponível para consulta futura.
      </p>
      <Button className="btn-glow mt-4" onClick={onUpload}><Upload className="h-4 w-4" /> Anexar Documentos</Button>
    </div>
  );
}

/* ==================== Upload múltiplo com classificação ==================== */

type PendingItem = {
  file: File;
  docType: DocType;
  customLabel: string;
  notes: string;
};

function UploadDialog({
  motorcycleId, initialFiles, onClose, onDone,
  originMode = false, suggestedOriginType = "bill_of_sale", userId = null,
}: {
  motorcycleId: string;
  initialFiles: File[];
  onClose: () => void;
  onDone: () => void;
  originMode?: boolean;
  suggestedOriginType?: OriginDocType;
  userId?: string | null;
}) {
  const [items, setItems] = useState<PendingItem[]>(
    initialFiles.map((f) => ({
      file: f,
      docType: originMode ? suggestedOriginType : guessType(f),
      customLabel: "",
      notes: "",
    })),
  );
  const [saving, setSaving] = useState(false);
  // No modo origem, o próximo arquivo entra já como documento de origem.
  const defaultTypeForNew: DocType = originMode ? suggestedOriginType : "other";

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: PendingItem[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE_BYTES) { toast.error(`"${f.name}" ultrapassa 25 MB e foi ignorado.`); continue; }
      if (!ACCEPTED_MIME.some((m) => f.type === m || f.type.startsWith("image/"))) {
        toast.error(`"${f.name}" tem formato não suportado.`); continue;
      }
      next.push({ file: f, docType: originMode ? defaultTypeForNew : guessType(f), customLabel: "", notes: "" });
    }
    // Origem exige exatamente um arquivo (NF ou Recibo).
    if (originMode) setItems(next.slice(0, 1));
    else setItems((p) => [...p, ...next]);
  }

  async function submit() {
    if (items.length === 0) { toast.error("Selecione ao menos um arquivo."); return; }
    if (originMode) {
      const it = items[0];
      if (!ORIGIN_DOC_TYPES.includes(it.docType as OriginDocType)) {
        toast.error("Selecione Nota Fiscal ou Recibo de Compra e Venda para comprovar a origem.");
        return;
      }
    }
    for (const it of items) {
      if (it.docType === "other" && !it.customLabel.trim()) {
        toast.error("Informe uma descrição para os documentos do tipo 'Outros'."); return;
      }
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      let ok = 0;
      for (const it of items) {
        const ext = it.file.name.split(".").pop() ?? "bin";
        const path = `${uid}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("documents").upload(path, it.file, { upsert: false });
        if (up.error) { toast.error(`${it.file.name}: ${up.error.message}`); continue; }
        const hash = await sha256Hex(it.file).catch(() => null);
        const isOrigin = originMode && ORIGIN_DOC_TYPES.includes(it.docType as OriginDocType);
        // Preservação de histórico (princípio TrailBook — Prontuário Digital):
        // NUNCA excluímos, sobrescrevemos ou removemos o arquivo do documento
        // de origem anterior. Apenas desmarcamos as flags de "atual" e "origem"
        // — o registro, o arquivo, o autor, a data e a auditoria permanecem
        // intactos e consultáveis na Central de Documentos / linha do tempo.
        if (isOrigin) {
          await supabase
            .from("motorcycle_documents" as never)
            .update({ is_origin_document: false, is_current: false } as never)
            .eq("motorcycle_id", motorcycleId)
            .eq("is_origin_document", true as never)
            .is("deleted_at", null);
        }
        const { error } = await supabase.from("motorcycle_documents" as never).insert({
          motorcycle_id: motorcycleId,
          doc_type: it.docType,
          bucket: "documents",
          storage_path: path,
          file_name: it.file.name,
          mime_type: it.file.type || null,
          size_bytes: it.file.size,
          sha256: hash,
          custom_label: it.docType === "other" ? it.customLabel : null,
          notes: it.notes || null,
          created_by: uid,
          version: 1,
          is_current: true,
          is_origin_document: isOrigin,
        } as never);
        if (error) { toast.error(`${it.file.name}: ${error.message}`); continue; }
        ok++;
      }
      if (ok > 0) {
        if (originMode) {
          clearOriginSnooze(userId, motorcycleId);
          toast.success("Documento de origem anexado com sucesso.", {
            description: "🟢 Origem comprovada — o histórico da motocicleta agora está mais confiável.",
          });
        } else {
          toast.success(`${ok} documento(s) anexado(s) com sucesso.`);
        }
      }
      onDone();
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{originMode ? "Anexar Documento de Origem" : "Anexar Documentos"}</DialogTitle>
          <DialogDescription>
            {originMode
              ? "Envie a Nota Fiscal ou o Recibo de Compra e Venda desta motocicleta. Qualquer um dos dois resolve a pendência."
              : "Selecione um ou vários arquivos. Depois classifique cada um. Tamanho máximo por arquivo: 25 MB."}
          </DialogDescription>
        </DialogHeader>

        {originMode && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-200/90">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
            <span>
              Após o envio, a pendência é resolvida automaticamente e a moto passa a exibir o selo
              <strong className="mx-1">Origem comprovada</strong>.
            </span>
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-card p-4 transition hover:border-primary/50">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Upload className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-medium">Selecionar arquivos</div>
            <div className="text-[11px] text-muted-foreground">PDF, JPG, PNG, WEBP · até 25 MB cada</div>
          </div>
          <input
            type="file"
            multiple={!originMode}
            accept="application/pdf,image/*"
            className="sr-only"
            onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }}
          />
        </label>

        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0 flex-1 truncate text-sm font-medium">{it.file.name}</div>
                <span className="text-[11px] text-muted-foreground">{formatBytes(it.file.size)}</span>
                <button className="text-muted-foreground hover:text-destructive" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} aria-label="Remover">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Select value={it.docType} onValueChange={(v) => setItems((p) => p.map((x, i) => i === idx ? { ...x, docType: v as DocType } : x))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(originMode
                      ? DOC_TYPES.filter((d) => (ORIGIN_DOC_TYPES as readonly string[]).includes(d.value))
                      : DOC_TYPES
                    ).map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.icon} {d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {it.docType === "other" && (
                  <Input placeholder="Descrição (obrigatória)" value={it.customLabel}
                         onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, customLabel: e.target.value } : x))} />
                )}
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              {originMode
                ? "Selecione o arquivo da Nota Fiscal ou do Recibo de Compra e Venda."
                : "Nenhum arquivo selecionado ainda."}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="btn-glow" onClick={submit} disabled={saving || items.length === 0}>
            {saving
              ? "Enviando…"
              : originMode
                ? "Anexar documento de origem"
                : `Enviar ${items.length || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function guessType(f: File): DocType {
  const n = f.name.toLowerCase();
  if (n.includes("nota") || n.includes("nf") || n.includes("invoice")) return "invoice";
  if (n.includes("manual")) return "manual";
  if (n.includes("garantia") || n.includes("warranty")) return "warranty";
  if (n.includes("import")) return "import";
  if (n.includes("contrato") || n.includes("contract")) return "contract";
  return "other";
}

/* ==================== Edit metadata ==================== */

function MetadataDialog({ doc, onClose, onSaved }: { doc: Doc; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<DocType>(doc.doc_type);
  const [customLabel, setCustomLabel] = useState(doc.custom_label ?? "");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (type === "other" && !customLabel.trim()) { toast.error("Informe a descrição."); return; }
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      const payload = {
        doc_type: type,
        custom_label: type === "other" ? customLabel : null,
        doc_number: String(fd.get("doc_number") || "") || null,
        doc_date: String(fd.get("doc_date") || "") || null,
        issuer: String(fd.get("issuer") || "") || null,
        amount: fd.get("amount") ? Number(fd.get("amount")) : null,
        notes: String(fd.get("notes") || "") || null,
      };
      const { error } = await supabase.from("motorcycle_documents" as never).update(payload as never).eq("id", doc.id);
      if (error) throw error;
      toast.success("Dados atualizados");
      onSaved();
    } catch (err: any) { toast.error(err.message ?? "Erro ao salvar"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Editar dados do documento</DialogTitle>
          <DialogDescription>Apenas metadados. Para trocar o arquivo, use "Substituir" (gera nova versão).</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Tipo" required>
            <Select value={type} onValueChange={(v) => setType(v as DocType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DOC_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.icon} {d.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {type === "other" && (
            <Field label="Descrição" required>
              <Input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="Nome do documento" />
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Número"><Input name="doc_number" defaultValue={doc.doc_number ?? ""} /></Field>
            <Field label="Data"><Input name="doc_date" type="date" defaultValue={doc.doc_date ?? ""} /></Field>
            <Field label="Emissor / Loja"><Input name="issuer" defaultValue={doc.issuer ?? ""} /></Field>
            <Field label="Valor (R$)"><Input name="amount" type="number" step="0.01" defaultValue={doc.amount ?? ""} /></Field>
          </div>
          <Field label="Observações"><Textarea name="notes" rows={3} defaultValue={doc.notes ?? ""} /></Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="btn-glow" disabled={saving}>{saving ? "Salvando…" : "Salvar alterações"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ==================== Substituir (nova versão) ==================== */

function ReplaceDialog({ doc, onClose, onSaved }: { doc: Doc; onClose: () => void; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!file) { toast.error("Selecione o novo arquivo."); return; }
    if (file.size > MAX_FILE_BYTES) { toast.error("Arquivo maior que 25 MB."); return; }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("documents").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const hash = await sha256Hex(file).catch(() => null);
      const parentId = doc.parent_id ?? doc.id;
      // desativar versão anterior como current
      const { error: e1 } = await supabase.from("motorcycle_documents" as never)
        .update({ is_current: false } as never).eq("id", doc.id);
      if (e1) throw e1;
      // inserir nova versão
      const { error: e2 } = await supabase.from("motorcycle_documents" as never).insert({
        motorcycle_id: doc.motorcycle_id,
        doc_type: doc.doc_type,
        bucket: "documents",
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        sha256: hash,
        custom_label: doc.custom_label,
        doc_number: doc.doc_number,
        doc_date: doc.doc_date,
        issuer: doc.issuer,
        amount: doc.amount,
        notes: doc.notes,
        created_by: uid,
        parent_id: parentId,
        version: doc.version + 1,
        is_current: true,
      } as never);
      if (e2) throw e2;
      toast.success(`Nova versão v${doc.version + 1} anexada. Versão anterior preservada.`);
      onSaved();
    } catch (err: any) { toast.error(err.message ?? "Erro ao substituir"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Substituir documento (nova versão)</DialogTitle>
          <DialogDescription>A versão atual (v{doc.version}) é preservada no histórico. A nova passa a ser a versão vigente.</DialogDescription></DialogHeader>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-card p-3 transition hover:border-primary/50">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Upload className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1 text-sm">
            {file ? <span className="font-medium">{file.name} · {formatBytes(file.size)}</span>
                  : <span className="text-muted-foreground">Escolher novo arquivo (PDF, JPG ou PNG)</span>}
          </div>
          <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="btn-glow" onClick={submit} disabled={saving || !file}>{saving ? "Enviando…" : "Salvar nova versão"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ==================== Linha do Tempo ==================== */

function TimelineDialog({
  doc, allRows, profiles, onClose,
}: { doc: Doc; allRows: Doc[]; profiles: Record<string, string>; onClose: () => void }) {
  const rootId = doc.parent_id ?? doc.id;
  const chain = allRows
    .filter((r) => r.id === rootId || r.parent_id === rootId)
    .sort((a, b) => a.version - b.version);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Linha do tempo do documento</DialogTitle>
          <DialogDescription>Todas as versões deste documento. O histórico nunca é apagado.</DialogDescription></DialogHeader>
        <ol className="relative space-y-4 border-l border-border pl-4">
          {chain.map((v) => (
            <li key={v.id} className="relative">
              <span className={cn(
                "absolute -left-[22px] top-1 grid h-4 w-4 place-items-center rounded-full ring-4 ring-background",
                v.is_current && !v.deleted_at ? "bg-primary" : v.deleted_at ? "bg-destructive" : "bg-muted-foreground",
              )}>
                {v.deleted_at ? <XCircle className="h-3 w-3 text-white" /> : <CheckCircle2 className="h-3 w-3 text-white" />}
              </span>
              <div className="text-xs">
                <div className="font-semibold">
                  v{v.version} {v.is_current && !v.deleted_at && "(atual)"} {v.deleted_at && "(na lixeira)"}
                </div>
                <div className="text-muted-foreground">
                  {formatDate(v.created_at)} · {new Date(v.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  {" · "}por {profiles[v.created_by ?? ""] ?? "—"}
                </div>
                <div className="text-muted-foreground">
                  {v.file_name ?? "arquivo"} · {formatBytes(v.size_bytes)}
                </div>
                {v.sha256 && (
                  <div className="mt-1 truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground" title={v.sha256}>
                    SHA-256: {v.sha256.slice(0, 16)}…
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}{required && <span className="text-primary"> *</span>}
      </Label>
      {children}
    </div>
  );
}