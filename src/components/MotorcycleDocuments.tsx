import { useState } from "react";
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
import { FileText, Upload, Eye, Replace, Trash2, CheckCircle2, ShieldCheck, Plus } from "lucide-react";
import { toast } from "sonner";
import { DOC_TYPES, DOC_TYPE_LABEL, type DocType } from "@/lib/motorcycle-documents";
import { uploadFile, brl, formatDate } from "@/lib/trailbook";

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
};

export function MotorcycleDocuments({ motorcycleId }: { motorcycleId: string }) {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ mode: "create" | "replace"; docType: DocType; existing?: Doc } | null>(null);

  const docs = useQuery({
    queryKey: ["motorcycle-documents", motorcycleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorcycle_documents" as never)
        .select("*")
        .eq("motorcycle_id", motorcycleId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Doc[];
    },
  });

  async function openFile(doc: Doc) {
    const { data, error } = await supabase.storage.from(doc.bucket).createSignedUrl(doc.storage_path, 300);
    if (error || !data) { toast.error("Não foi possível gerar o link"); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function removeDoc(doc: Doc) {
    await supabase.storage.from(doc.bucket).remove([doc.storage_path]);
    const { error } = await supabase.from("motorcycle_documents" as never).delete().eq("id", doc.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Documento removido");
    qc.invalidateQueries({ queryKey: ["motorcycle-documents", motorcycleId] });
    qc.invalidateQueries({ queryKey: ["audit", motorcycleId] });
  }

  const invoice = docs.data?.find((d) => d.doc_type === "invoice");
  const others = docs.data?.filter((d) => d.doc_type !== "invoice") ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Documentação da motocicleta
          </h2>
          <p className="text-xs text-muted-foreground">
            Documentos permanentes e privados. Não são exibidos em oficinas, certificado público ou compradores.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Armazenamento privado com URL assinada
        </div>
      </div>

      {/* Card Nota Fiscal */}
      <InvoiceCard
        doc={invoice}
        onCreate={() => setDialog({ mode: "create", docType: "invoice" })}
        onReplace={(d) => setDialog({ mode: "replace", docType: "invoice", existing: d })}
        onView={openFile}
        onRemove={removeDoc}
      />

      {/* Outros documentos */}
      <div className="surface-elevated rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">Outros documentos permanentes</div>
          <Button size="sm" variant="outline" onClick={() => setDialog({ mode: "create", docType: "manual" })}>
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
        {others.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum documento adicional. Você pode anexar manual do proprietário, garantia, contratos, importação, etc.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {others.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{d.custom_label || DOC_TYPE_LABEL[d.doc_type]}</div>
                  <div className="text-[11px] text-muted-foreground">{DOC_TYPE_LABEL[d.doc_type]} · {formatDate(d.created_at)}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openFile(d)}><Eye className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setDialog({ mode: "replace", docType: d.doc_type, existing: d })}><Replace className="h-4 w-4" /></Button>
                  <ConfirmRemove onConfirm={() => removeDoc(d)} label={d.custom_label || DOC_TYPE_LABEL[d.doc_type]} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {dialog && (
        <DocumentDialog
          motorcycleId={motorcycleId}
          mode={dialog.mode}
          docType={dialog.docType}
          existing={dialog.existing}
          onClose={() => setDialog(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["motorcycle-documents", motorcycleId] });
            qc.invalidateQueries({ queryKey: ["audit", motorcycleId] });
            setDialog(null);
          }}
        />
      )}
    </section>
  );
}

function InvoiceCard({
  doc, onCreate, onReplace, onView, onRemove,
}: {
  doc: Doc | undefined;
  onCreate: () => void;
  onReplace: (d: Doc) => void;
  onView: (d: Doc) => Promise<void>;
  onRemove: (d: Doc) => Promise<void>;
}) {
  if (!doc) {
    return (
      <div className="surface-elevated rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500/15 text-amber-400"><FileText className="h-5 w-5" /></div>
            <div>
              <div className="text-sm font-semibold">📄 Nenhuma Nota Fiscal cadastrada</div>
              <p className="mt-1 max-w-lg text-xs text-muted-foreground">
                Motos de competição normalmente utilizam a Nota Fiscal como principal documento de origem.
                Mantenha esse documento armazenado no TrailBook para facilitar consultas futuras.
              </p>
            </div>
          </div>
          <Button className="btn-glow" onClick={onCreate}><Upload className="h-4 w-4" /> Anexar Nota Fiscal</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="surface-elevated rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400"><CheckCircle2 className="h-5 w-5" /></div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">✅ Nota Fiscal cadastrada</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              {doc.doc_number && <span>Nº <strong className="text-foreground">{doc.doc_number}</strong></span>}
              {doc.doc_date && <span>Data: {formatDate(doc.doc_date)}</span>}
              {doc.issuer && <span>Loja: {doc.issuer}</span>}
              {doc.amount != null && <span>Valor: {brl(Number(doc.amount))}</span>}
            </div>
            {doc.notes && <p className="mt-1 text-xs text-muted-foreground">{doc.notes}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => onView(doc)}><Eye className="h-4 w-4" /> Visualizar</Button>
          <Button size="sm" variant="outline" onClick={() => onReplace(doc)}><Replace className="h-4 w-4" /> Substituir</Button>
          <ConfirmRemove onConfirm={() => onRemove(doc)} label="Nota Fiscal" />
        </div>
      </div>
    </div>
  );
}

function ConfirmRemove({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            O arquivo será excluído permanentemente do TrailBook. Essa ação é registrada no histórico de alterações.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DocumentDialog({
  motorcycleId, mode, docType, existing, onClose, onSaved,
}: {
  motorcycleId: string;
  mode: "create" | "replace";
  docType: DocType;
  existing?: Doc;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<DocType>(docType);
  const [customLabel, setCustomLabel] = useState(existing?.custom_label ?? "");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mode === "create" && !file) { toast.error("Selecione um arquivo"); return; }
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const fd = new FormData(e.currentTarget);
      let storage_path = existing?.storage_path ?? "";
      let bucket = existing?.bucket ?? "documents";
      let mime_type = existing?.mime_type ?? null;
      let file_name = existing?.file_name ?? null;

      if (file) {
        // sobe novo arquivo; se substituição, remove o antigo depois
        const up = await uploadFile("documents", file, uid);
        if (existing && existing.storage_path) {
          await supabase.storage.from(existing.bucket).remove([existing.storage_path]);
        }
        storage_path = up.path;
        bucket = up.bucket;
        mime_type = file.type;
        file_name = file.name;
      }

      const payload = {
        motorcycle_id: motorcycleId,
        doc_type: type,
        bucket, storage_path, file_name, mime_type,
        doc_number: String(fd.get("doc_number") || "") || null,
        doc_date: String(fd.get("doc_date") || "") || null,
        issuer: String(fd.get("issuer") || "") || null,
        amount: fd.get("amount") ? Number(fd.get("amount")) : null,
        notes: String(fd.get("notes") || "") || null,
        custom_label: type === "other" ? (customLabel || null) : null,
        created_by: uid,
      };

      if (existing) {
        const { error } = await supabase.from("motorcycle_documents" as never)
          .update(payload as never).eq("id", existing.id);
        if (error) throw error;
        toast.success("Documento atualizado");
      } else {
        const { error } = await supabase.from("motorcycle_documents" as never).insert(payload as never);
        if (error) throw error;
        toast.success("Documento anexado");
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar documento");
    } finally { setLoading(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Substituir documento" : "Anexar documento"}</DialogTitle>
          <DialogDescription>
            Documento privado. Apenas você (proprietário atual) pode visualizar, substituir ou remover.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Tipo de documento" required>
            <Select value={type} onValueChange={(v) => setType(v as DocType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.icon} {d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {type === "other" && (
            <Field label="Nome do documento" required>
              <Input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="ex: Termo de doação" />
            </Field>
          )}
          <Field label={existing ? "Novo arquivo (opcional)" : "Arquivo"} required={!existing}>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-card p-3 transition hover:border-primary/50">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Upload className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 text-sm">
                {file ? <span className="font-medium">{file.name}</span>
                      : existing ? <span className="text-muted-foreground">Manter arquivo atual ({existing.file_name || "documento"})</span>
                                 : <span className="text-muted-foreground">Escolher arquivo (PDF, JPG ou PNG)</span>}
              </div>
              <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </Field>
          {(type === "invoice" || type === "contract" || type === "warranty") && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Número"><Input name="doc_number" defaultValue={existing?.doc_number ?? ""} placeholder="ex: 000123456" /></Field>
              <Field label="Data"><Input name="doc_date" type="date" defaultValue={existing?.doc_date ?? ""} /></Field>
              <Field label={type === "invoice" ? "Loja / Revenda" : "Emissor"}>
                <Input name="issuer" defaultValue={existing?.issuer ?? ""} placeholder="ex: Honda Uirapuru" />
              </Field>
              <Field label="Valor (R$)">
                <Input name="amount" type="number" step="0.01" defaultValue={existing?.amount ?? ""} placeholder="0,00" />
              </Field>
            </div>
          )}
          <Field label="Observações"><Textarea name="notes" rows={3} defaultValue={existing?.notes ?? ""} /></Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="btn-glow" disabled={loading}>{loading ? "Salvando…" : existing ? "Salvar alterações" : "Anexar documento"}</Button>
          </DialogFooter>
        </form>
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