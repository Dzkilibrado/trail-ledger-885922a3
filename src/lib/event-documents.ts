/**
 * Vínculo N:N entre atividades (events) e documentos (motorcycle_documents).
 *
 * Regras oficiais (aprovadas na homologação v1.7.9):
 * - Um documento pode estar vinculado a várias atividades e vice-versa.
 * - Se um arquivo com o mesmo sha256 já existir para a mesma moto e não
 *   estiver na lixeira, REUSAMOS o registro original — sem novo upload,
 *   sem alterar o vínculo anterior, apenas criando uma nova linha em
 *   event_documents.
 * - "Desvincular" remove apenas o registro em event_documents.
 * - Nunca criamos registros documentais sem arquivo confirmado no storage.
 */
import { supabase } from "@/integrations/supabase/client";
import { sha256Hex, MAX_FILE_BYTES, ACCEPTED_MIME, type DocType } from "@/lib/motorcycle-documents";

const BUCKET = "moto-docs";

/** Extensões documentais aceitas em atividades (imagens/vídeos vão em event_attachments). */
export const DOC_ACCEPTED_MIME = [
  ...ACCEPTED_MIME,
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

export type AttachResult = {
  file: string;
  ok: boolean;
  reused: boolean;
  documentId?: string;
  error?: string;
};

export function isDocumentFile(f: File): boolean {
  if (f.type.startsWith("image/") || f.type.startsWith("video/")) return false;
  return true;
}

/**
 * Anexa arquivos documentais a uma atividade existente.
 * Retorna um resultado por arquivo — o chamador decide o que exibir na UI
 * (sucesso, reaproveitamento, falha parcial). Nenhum erro individual
 * derruba o loop; o evento não é revertido em caso de falha de anexo.
 */
export async function attachDocumentsToEvent(params: {
  motorcycleId: string;
  eventId: string;
  userId: string;
  files: File[];
  docType?: DocType;
}): Promise<AttachResult[]> {
  const { motorcycleId, eventId, userId, files } = params;
  const docType: DocType = params.docType ?? "other";
  const results: AttachResult[] = [];

  for (const file of files) {
    const label = file.name || "arquivo";
    try {
      if (!file.size) { results.push({ file: label, ok: false, reused: false, error: "Arquivo vazio." }); continue; }
      if (file.size > MAX_FILE_BYTES) {
        results.push({ file: label, ok: false, reused: false, error: "Arquivo excede 25 MB." });
        continue;
      }
      const sha = await sha256Hex(file);

      // 1) Reaproveitamento: mesmo sha, mesma moto, não excluído, versão atual.
      const { data: existing, error: existingErr } = await supabase
        .from("motorcycle_documents" as never)
        .select("id")
        .eq("motorcycle_id", motorcycleId)
        .eq("sha256", sha)
        .is("deleted_at", null)
        .eq("is_current", true)
        .maybeSingle();
      if (existingErr) throw existingErr;

      let documentId: string | null = (existing as any)?.id ?? null;
      let reused = false;

      if (documentId) {
        reused = true;
      } else {
        // 2) Upload + INSERT do documento.
        const ext = (file.name.split(".").pop() || "bin").toLowerCase();
        const storagePath = `${userId}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from(BUCKET).upload(storagePath, file, { upsert: false });
        if (up.error) throw up.error;

        const { data: inserted, error: insErr } = await supabase
          .from("motorcycle_documents" as never)
          .insert({
            motorcycle_id: motorcycleId,
            doc_type: docType,
            bucket: BUCKET,
            storage_path: storagePath,
            file_name: file.name,
            mime_type: file.type || null,
            sha256: sha,
            size_bytes: file.size,
            created_by: userId,
            is_current: true,
          } as never)
          .select("id")
          .single();
        if (insErr) {
          // Rollback do arquivo para evitar órfão.
          await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => undefined);
          throw insErr;
        }
        documentId = (inserted as any).id;
      }

      // 3) Vínculo em event_documents (idempotente pela UNIQUE constraint).
      const { error: linkErr } = await supabase
        .from("event_documents" as never)
        .insert({ event_id: eventId, document_id: documentId, created_by: userId } as never);
      if (linkErr && !/duplicate key|unique/i.test(linkErr.message)) throw linkErr;

      results.push({ file: label, ok: true, reused, documentId: documentId! });
    } catch (err: any) {
      results.push({ file: label, ok: false, reused: false, error: err?.message ?? "Falha desconhecida" });
    }
  }

  return results;
}

/** Remove apenas o vínculo (mantém o documento na Central). */
export async function unlinkDocumentFromEvent(eventId: string, documentId: string) {
  const { error } = await supabase
    .from("event_documents" as never)
    .delete()
    .eq("event_id", eventId)
    .eq("document_id", documentId);
  if (error) throw error;
}

/** Lista documentos vinculados a uma atividade. */
export async function listEventDocuments(eventId: string) {
  const { data, error } = await supabase
    .from("event_documents" as never)
    .select("document_id, created_at, motorcycle_documents:document_id(id, file_name, mime_type, doc_type, bucket, storage_path, size_bytes, deleted_at)")
    .eq("event_id", eventId);
  if (error) throw error;
  return (data ?? []) as any[];
}

/** Conta quantas atividades usam um documento. */
export async function countEventLinks(documentId: string): Promise<number> {
  const { count, error } = await supabase
    .from("event_documents" as never)
    .select("id", { count: "exact", head: true })
    .eq("document_id", documentId);
  if (error) return 0;
  return count ?? 0;
}