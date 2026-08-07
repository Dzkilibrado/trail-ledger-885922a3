import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip, Download, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { signedUrl } from "@/lib/trailbook";

const BUCKET = "ticket-attachments";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPT = "image/*,application/pdf";

type Row = {
  id: string;
  ticket_id: string;
  message_id: string | null;
  file_name: string | null;
  mime_type: string | null;
  storage_path: string;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
};

export function TicketAttachments({ ticketId }: { ticketId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["ticket-attachments", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_attachments")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) throw new Error("Sessão expirada");
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name}: máximo 10 MB`);
          continue;
        }
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${uid}/${ticketId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
        if (upErr) {
          toast.error(upErr.message);
          continue;
        }
        const { error: insErr } = await supabase.from("ticket_attachments").insert({
          ticket_id: ticketId,
          uploaded_by: uid,
          bucket: BUCKET,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
        });
        if (insErr) toast.error(insErr.message);
      }
      qc.invalidateQueries({ queryKey: ["ticket-attachments", ticketId] });
    } finally {
      setUploading(false);
    }
  }

  async function open(row: Row) {
    const url = await signedUrl(BUCKET, row.storage_path, 600);
    if (url) window.open(url, "_blank");
  }
  async function remove(row: Row) {
    if (!confirm(`Remover "${row.file_name ?? "anexo"}"?`)) return;
    await supabase.storage.from(BUCKET).remove([row.storage_path]);
    const { error } = await supabase.from("ticket_attachments").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["ticket-attachments", ticketId] });
  }

  const rows = q.data ?? [];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip className="h-4 w-4" /> Anexos ({rows.length})
        </div>
        <label className="inline-flex">
          <input
            type="file"
            className="hidden"
            multiple
            accept={ACCEPT}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.currentTarget.value = "";
            }}
          />
          <Button asChild size="sm" variant="outline" disabled={uploading}>
            <span>
              <Upload className="h-4 w-4" /> {uploading ? "Enviando…" : "Adicionar arquivo"}
            </span>
          </Button>
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum anexo. Envie prints, PDFs ou fotos (até 10 MB).
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5 text-xs"
            >
              <button
                onClick={() => open(r)}
                className="min-w-0 flex-1 truncate text-left hover:text-primary"
              >
                {r.file_name ?? r.storage_path.split("/").pop()}
              </button>
              <button
                onClick={() => open(r)}
                className="text-muted-foreground hover:text-foreground"
                title="Abrir"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => remove(r)}
                className="text-muted-foreground hover:text-destructive"
                title="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
