/**
 * Server functions para compartilhamento público do cofre de documentos.
 * Requer que a migration 20261104_motorcycle_document_shares.sql
 * tenha sido aplicada via Lovable.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { shareUrl } from "@/lib/external-links";

/** Tipos de documentos exibidos na view pública (sem dados internos). */
export interface PublicDocRow {
  id: string;
  doc_type: string;
  doc_type_label: string;
  doc_date: string | null;
  issuer: string | null;
  custom_label: string | null;
  file_name: string | null;
  mime_type: string | null;
  is_origin_document: boolean;
}

export interface DocumentShareResult {
  shareId: string;
  token: string;
  publicUrl: string;
  expiresAt: string | null;
}

/**
 * Gera um token de compartilhamento do cofre de documentos.
 * Chamado pelo CheckupWizard quando includeDocsQr = true.
 * Se já existir um token válido para o mesmo laudo, reutiliza.
 */
export const createDocumentShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      motorcycleId: string;
      reportId: string;
      /** Validade em dias. 0 = sem expiração. */
      validityDays: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    // Verifica propriedade da moto
    const moto = await sb
      .from("motorcycles")
      .select("id, owner_id")
      .eq("id", data.motorcycleId)
      .eq("owner_id", context.userId)
      .single();
    if (moto.error || !moto.data) throw new Error("Motocicleta não encontrada ou sem permissão.");

    // Reutiliza token existente válido para o mesmo laudo
    const existing = await sb
      .from("motorcycle_document_shares" as never)
      .select("id, token, expires_at")
      .eq("motorcycle_id", data.motorcycleId)
      .eq("report_id", data.reportId)
      .is("revoked_at", null)
      .maybeSingle();

    const row = (existing.data ?? null) as {
      id: string;
      token: string;
      expires_at: string | null;
    } | null;

    if (row) {
      return {
        shareId: row.id,
        token: row.token,
        publicUrl: shareUrl(`/d/${row.token}`),
        expiresAt: row.expires_at,
      } satisfies DocumentShareResult;
    }

    // Calcula expiração
    const expiresAt =
      data.validityDays > 0
        ? new Date(Date.now() + data.validityDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const ins = await sb
      .from("motorcycle_document_shares" as never)
      .insert({
        motorcycle_id: data.motorcycleId,
        report_id: data.reportId,
        created_by: context.userId,
        expires_at: expiresAt,
      } as never)
      .select("id, token, expires_at")
      .single();

    if (ins.error) throw new Error(ins.error.message);

    const inserted = ins.data as { id: string; token: string; expires_at: string | null };

    return {
      shareId: inserted.id,
      token: inserted.token,
      publicUrl: shareUrl(`/d/${inserted.token}`),
      expiresAt: inserted.expires_at,
    } satisfies DocumentShareResult;
  });

/**
 * Leitura pública dos documentos via token — sem autenticação.
 * Usa service role para gerar signed URLs temporárias (5 min).
 */
export const getPublicDocumentShare = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => {
    if (!data.token || data.token.length < 8) throw new Error("Token inválido.");
    return data;
  })
  .handler(async ({ data }) => {
    const sb = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    // Valida token via RPC (atualiza access_count)
    const rpc = await sb.rpc("resolve_document_share" as never, {
      p_token: data.token,
    } as never);

    if (rpc.error) throw new Error("Erro ao validar o token de compartilhamento.");

    const rows = rpc.data as Array<{
      share_id: string;
      motorcycle_id: string;
      motorcycle_label: string;
      is_valid: boolean;
      invalid_reason: string | null;
    }>;

    const resolved = rows?.[0];
    if (!resolved?.is_valid) {
      return {
        ok: false as const,
        reason: resolved?.invalid_reason ?? "Token inválido ou expirado.",
      };
    }

    // Busca documentos da moto (apenas correntes, não excluídos)
    const docs = await sb
      .from("motorcycle_documents" as never)
      .select(
        "id, doc_type, doc_date, issuer, custom_label, file_name, mime_type, is_origin_document, bucket, storage_path",
      )
      .eq("motorcycle_id", resolved.motorcycle_id)
      .is("deleted_at", null)
      .eq("is_current", true)
      .order("doc_date", { ascending: false });

    if (docs.error) throw new Error("Erro ao carregar documentos.");

    const DOC_TYPE_LABELS: Record<string, string> = {
      bill_of_sale: "Recibo de Compra e Venda",
      invoice: "Nota Fiscal",
      manual: "Manual do Proprietário",
      warranty: "Certificado de Garantia",
      import: "Documento de Importação",
      certificate: "Certificado",
      workshop_receipt: "NF / Comprovante de Manutenção",
      inspection_report: "Laudo",
      photo: "Foto",
      contract: "Contrato",
      other: "Outro documento",
    };

    const rawDocs = (docs.data ?? []) as Array<{
      id: string;
      doc_type: string;
      doc_date: string | null;
      issuer: string | null;
      custom_label: string | null;
      file_name: string | null;
      mime_type: string | null;
      is_origin_document: boolean | null;
      bucket: string;
      storage_path: string;
    }>;

    // Gera signed URLs temporárias (5 min) para cada documento
    const publicDocs: Array<PublicDocRow & { signedUrl: string | null }> = await Promise.all(
      rawDocs.map(async (d) => {
        let signedUrl: string | null = null;
        try {
          const signed = await sb.storage
            .from(d.bucket)
            .createSignedUrl(d.storage_path, 300); // 5 minutos
          signedUrl = signed.data?.signedUrl ?? null;
        } catch {
          /* signed URL opcional — não bloqueia listagem */
        }
        return {
          id: d.id,
          doc_type: d.doc_type,
          doc_type_label: DOC_TYPE_LABELS[d.doc_type] ?? "Documento",
          doc_date: d.doc_date,
          issuer: d.issuer,
          custom_label: d.custom_label,
          file_name: d.file_name,
          mime_type: d.mime_type,
          is_origin_document: d.is_origin_document ?? false,
          signedUrl,
        };
      }),
    );

    return {
      ok: true as const,
      shareId: resolved.share_id,
      motorcycleId: resolved.motorcycle_id,
      motorcycleLabel: resolved.motorcycle_label,
      docs: publicDocs,
    };
  });

/**
 * Lista tokens de compartilhamento de documentos para um laudo.
 * Usado para exibir e gerenciar compartilhamentos ativos.
 */
export const listDocumentShares = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { motorcycleId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("motorcycle_document_shares" as never)
      .select("id, token, created_at, expires_at, revoked_at, access_count, report_id")
      .eq("motorcycle_id", data.motorcycleId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { shares: (rows ?? []) as Array<{
      id: string;
      token: string;
      created_at: string;
      expires_at: string | null;
      revoked_at: string | null;
      access_count: number;
      report_id: string | null;
    }> };
  });

/**
 * Revoga um token de compartilhamento.
 */
export const revokeDocumentShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { shareId: string; motorcycleId: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("motorcycle_document_shares" as never)
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: context.context?.userId,
      } as never)
      .eq("id", data.shareId)
      .eq("motorcycle_id", data.motorcycleId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
