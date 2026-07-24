import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  errorDiagnostics,
  makeRequestId,
  makeSupportCode,
  maskUserId,
  sanitizeReceiptPayloadForLog,
  type IssueStage,
} from "./smart-receipts-diagnostics";

/** Fetch pública (sem auth) do recibo pelo código — usado pela página /r/$code. */
export const validateReceiptPublic = createServerFn({ method: "GET" })
  .inputValidator((data: { code: string }) => {
    if (!data?.code || typeof data.code !== "string") throw new Error("Código inválido");
    return { code: data.code.trim().toUpperCase() };
  })
  .handler(async ({ data }) => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: rows, error } = await supabase.rpc("get_public_receipt" as never, { _code: data.code } as never);
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return { found: false as const };
    return { found: true as const, receipt: row };
  });

/** URL assinada de 60s para download do PDF (original ou assinado) — só partes/admin. */
export const getReceiptSignedUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string; variant?: "signed" | "original" }) => ({
    code: String(data.code).toUpperCase(),
    variant: data.variant === "original" ? ("original" as const) : ("signed" as const),
  }))
  .handler(async ({ data, context }) => {
    const preferSigned = data.variant === "signed";
    const { data: path, error } = await context.supabase.rpc(
      "get_receipt_pdf_path" as never,
      { _code: data.code, _prefer_signed: preferSigned } as never,
    );
    if (error) throw new Error(error.message);
    if (!path) return { url: null as string | null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("smart-receipts").createSignedUrl(String(path), 60);
    if (sErr) throw new Error(sErr.message);
    return { url: signed?.signedUrl ?? null };
  });

// ============================================================================
// LIFECYCLE
// draft → issued → awaiting_acceptance → completed
// Alt: cancelled | superseded | revoked
// ============================================================================

export interface DraftInput {
  motorcycle_id: string;
  buyer: { user_id?: string | null; full_name: string; cpf?: string | null; email?: string | null };
  external_buyer?: boolean;
  negotiation: {
    amount: number;
    payment_method: string;
    date: string;
    location?: string | null;
    notes?: string | null;
  };
  lgpd_consent: boolean;
  previous_receipt_id?: string | null;
}

interface ReceiptIssueInput {
  id: string;
  request_id?: string | null;
}

function validateDraftInput(data: DraftInput): DraftInput {
  if (!data?.motorcycle_id) throw new Error("motorcycle_id obrigatório");
  if (!data?.buyer?.full_name?.trim()) throw new Error("Nome do comprador obrigatório");
  if (!data?.negotiation?.amount || data.negotiation.amount <= 0) throw new Error("Valor da negociação inválido");
  if (!data?.negotiation?.payment_method) throw new Error("Forma de pagamento obrigatória");
  if (!data?.negotiation?.date) throw new Error("Data da negociação obrigatória");
  if (!data?.lgpd_consent) throw new Error("É necessário aceitar o consentimento LGPD");
  return data;
}

/** Cria um rascunho de recibo (não emite PDF, não transfere propriedade). */
export const createReceiptDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateDraftInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: moto, error: mErr } = await supabase
      .from("motorcycles")
      .select("id, brand, model, year_model, chassis, plate, hours_total, km_total, owner_id")
      .eq("id", data.motorcycle_id).single();
    if (mErr || !moto) throw new Error("Motocicleta não encontrada ou sem permissão");
    if (moto.owner_id !== userId) throw new Error("Apenas o proprietário atual pode iniciar o recibo");

    const { data: sellerProfile } = await supabase
      .from("profiles").select("full_name, cpf, email").eq("id", userId).single();
    if (!sellerProfile?.full_name) throw new Error("Complete seu perfil (nome) antes de iniciar o recibo");

    // Idempotência: se já existe rascunho ativo do MESMO vendedor para esta moto,
    // reutiliza em vez de criar novo. Evita múltiplos recibos por negociação e
    // torna cliques repetidos em "Emitir PDF" seguros mesmo em cenários de
    // dupla submissão / retry após erro transitório.
    if (!data.previous_receipt_id) {
      const { data: existingDraft } = await supabase
        .from("smart_receipts")
        .select("id, code, version, status")
        .eq("motorcycle_id", moto.id)
        .eq("seller_id", userId)
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingDraft) {
        return { ok: true as const, receipt: existingDraft, reused: true as const };
      }
    }

    let version = 1;
    if (data.previous_receipt_id) {
      const { data: prev } = await supabase
        .from("smart_receipts").select("version").eq("id", data.previous_receipt_id).maybeSingle();
      if (prev?.version) version = prev.version + 1;
    }

    const isExternal = data.external_buyer === true || !data.buyer.user_id;

    // Enriquecimento server-side do snapshot do comprador TrailBook.
    // O cliente NÃO envia mais e-mail/CPF cru quando um usuário TB é selecionado
    // (a busca devolve apenas dados mascarados). Aqui buscamos os valores
    // autoritativos pelo buyer_id usando o admin client, com RLS bypass
    // controlado — o dado é gravado dentro do próprio snapshot do recibo,
    // sem ser exposto ao vendedor antes da emissão.
    let buyerFullName = data.buyer.full_name.trim();
    let buyerCpf: string | null = data.buyer.cpf ?? null;
    let buyerEmail: string | null = data.buyer.email ?? null;
    if (!isExternal && data.buyer.user_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: buyerProfile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, cpf, email, status")
        .eq("id", data.buyer.user_id)
        .maybeSingle();
      if (!buyerProfile || buyerProfile.status !== "active") {
        throw new Error("Comprador TrailBook indisponível");
      }
      buyerFullName = buyerProfile.full_name?.trim() || buyerFullName;
      buyerCpf = buyerProfile.cpf ?? null;
      buyerEmail = buyerProfile.email ?? null;
    }

    // O código (TB-RCV-YYYY-NNNNNN) é gerado por trigger BEFORE INSERT no banco
    // usando uma sequence dedicada — serializa concorrência e elimina a race
    // condition que causava "duplicate key ... smart_receipts_code_key".
    // NÃO enviar `code` a partir do cliente.
    const insertPayload = {
        motorcycle_id: moto.id,
        seller_id: userId,
        buyer_id: data.buyer.user_id ?? null,
        seller_snapshot: sellerProfile,
        buyer_snapshot: {
          full_name: buyerFullName,
          cpf: buyerCpf,
          email: buyerEmail,
        },
        motorcycle_snapshot: moto,
        negotiation: {
          amount: data.negotiation.amount,
          payment_method: data.negotiation.payment_method,
          date: data.negotiation.date,
          location: data.negotiation.location ?? null,
          notes: data.negotiation.notes ?? null,
          lgpd_consent_at: new Date().toISOString(),
        },
        status: "draft",
        version,
        previous_receipt_id: data.previous_receipt_id ?? null,
        external_buyer: isExternal,
        created_by: userId,
    };

    // Safety-net: mesmo com a trigger serializando, retry uma vez em caso
    // improvável de colisão (23505) — nunca propagar esse erro para a UI.
    let inserted: { id: string; code: string; version: number; status: string } | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data: row, error: iErr } = await supabase
        .from("smart_receipts")
        .insert(insertPayload as never)
        .select("id, code, version, status")
        .single();
      if (!iErr && row) { inserted = row; break; }
      const code = (iErr as { code?: string } | null)?.code;
      if (code !== "23505" || attempt === 1) throw new Error(iErr?.message ?? "Falha ao criar rascunho");
    }
    return { ok: true as const, receipt: inserted!, reused: false as const };
  });

/** Atualiza dados do rascunho (só enquanto draft). */
export const updateReceiptDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; patch: Partial<DraftInput> }) => {
    if (!data?.id) throw new Error("id obrigatório");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: current, error: cErr } = await supabase
      .from("smart_receipts").select("id, status, seller_id, buyer_snapshot, negotiation")
      .eq("id", data.id).single();
    if (cErr || !current) throw new Error("Recibo não encontrado");
    if (current.seller_id !== userId) throw new Error("Apenas o vendedor pode editar");
    if (current.status !== "draft") throw new Error("Recibo já emitido — edição bloqueada");

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.patch.buyer) {
      patch.buyer_snapshot = {
        ...(current.buyer_snapshot as object),
        full_name: data.patch.buyer.full_name ?? (current.buyer_snapshot as { full_name?: string }).full_name,
        cpf: data.patch.buyer.cpf ?? null,
        email: data.patch.buyer.email ?? null,
      };
      patch.buyer_id = data.patch.buyer.user_id ?? null;
      if (data.patch.external_buyer !== undefined) patch.external_buyer = data.patch.external_buyer;
    }
    if (data.patch.negotiation) {
      patch.negotiation = {
        ...(current.negotiation as object),
        ...data.patch.negotiation,
      };
    }
    const { error } = await supabase.from("smart_receipts").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Gera o PDF do recibo a partir do rascunho e transiciona para 'issued'. */
export const generateReceiptPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ReceiptIssueInput) => ({
    id: String(data.id),
    request_id: data.request_id ? String(data.request_id) : null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const requestId = data.request_id || makeRequestId();
    const supportCode = makeSupportCode(requestId);
    const timestamp = new Date().toISOString();
    let stage: IssueStage = "load_receipt";
    let receiptForLog: Record<string, unknown> | null = null;

    try {
      const { data: r, error: rErr } = await supabase
        .from("smart_receipts")
        .select("*")
        .eq("id", data.id).single();
      receiptForLog = (r ?? null) as Record<string, unknown> | null;
      if (rErr || !r) throw new Error("Recibo não encontrado");

      stage = "authorize";
      if (r.seller_id !== userId) throw new Error("Apenas o vendedor pode emitir o PDF");

      if (r.status !== "draft") {
        if (r.status === "issued" && r.original_pdf_path) {
          console.info(`[SmartReceipt][${supportCode}] retry_idempotent`, JSON.stringify({
            request_id: requestId,
            support_code: supportCode,
            receipt_id: r.id,
            motorcycle_id: r.motorcycle_id,
            user: maskUserId(userId),
            stage,
            timestamp,
            status: r.status,
          }));
          return { ok: true as const, code: r.code, url: `/r/${r.code}`, request_id: requestId, support_code: supportCode };
        }
        throw new Error(`Recibo em estado '${r.status}' — PDF já emitido`);
      }

      stage = "import_pdf_builder";
      const { buildReceiptPdf } = await import("./smart-receipts.server");
      const originHeader = getRequestHeader("origin") || getRequestHeader("host") || "trailbook.com.br";
      const origin = originHeader.startsWith("http") ? originHeader : `https://${originHeader}`;
      const issuedAt = new Date().toISOString();

      stage = "prepare_payload";
      const moto = r.motorcycle_snapshot as {
        brand: string; model: string; year_model?: number | null; chassis?: string | null;
        plate?: string | null; hours_total?: number | null; km_total?: number | null;
      };
      const seller = r.seller_snapshot as { full_name: string; cpf?: string | null; email?: string | null };
      const buyer = r.buyer_snapshot as { full_name: string; cpf?: string | null; email?: string | null };
      const neg = r.negotiation as {
        amount: number; payment_method: string; date: string; location?: string | null; notes?: string | null;
      };

      stage = "generate_pdf_bytes";
      const { pdfBytes, sha256 } = await buildReceiptPdf({
        code: r.code, version: r.version, issuedAt,
        motorcycle: moto, seller, buyer, negotiation: neg,
      }, origin);

      stage = "upload_pdf";
      const pdfPath = `motorcycles/${r.motorcycle_id}/${r.code}-v${r.version}-original.pdf`;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: upErr } = await supabaseAdmin.storage
        .from("smart-receipts")
        .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });
      if (upErr) throw new Error(`Falha no upload do PDF: ${upErr.message}`);

      stage = "update_receipt_status";
      const { error: uErr } = await supabase
        .from("smart_receipts")
        .update({
          status: "issued",
          sha256,
          pdf_path: pdfPath,
          original_pdf_path: pdfPath,
          issued_at: issuedAt,
        } as never)
        .eq("id", r.id)
        .eq("status", "draft");
      if (uErr) throw new Error(uErr.message);

      stage = "done";
      console.info(`[SmartReceipt][${supportCode}] issued`, JSON.stringify({
        request_id: requestId,
        support_code: supportCode,
        receipt_id: r.id,
        motorcycle_id: r.motorcycle_id,
        user: maskUserId(userId),
        stage,
        timestamp,
        status_before: "draft",
        status_after: "issued",
        pdf_bytes: pdfBytes.byteLength,
        sha256_present: Boolean(sha256),
      }));

      return { ok: true as const, code: r.code, url: `/r/${r.code}`, request_id: requestId, support_code: supportCode };
    } catch (error) {
      const details = errorDiagnostics(error);
      console.error(`[SmartReceipt][${supportCode}] issue_failed`, JSON.stringify({
        request_id: requestId,
        support_code: supportCode,
        receipt_id: data.id,
        motorcycle_id: receiptForLog?.motorcycle_id ?? null,
        user: maskUserId(userId),
        stage,
        timestamp,
        error: details,
        payload: sanitizeReceiptPayloadForLog(receiptForLog),
      }));
      throw new Error(`Não foi possível gerar o PDF. Código: ${supportCode}`);
    }
  });

/** Anexa o PDF assinado (base64) e transiciona para 'awaiting_acceptance'. */
export const attachSignedReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; pdf_base64: string }) => {
    if (!data?.id) throw new Error("id obrigatório");
    if (!data?.pdf_base64) throw new Error("Arquivo assinado ausente");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r, error: rErr } = await supabase
      .from("smart_receipts")
      .select("id, code, status, seller_id, buyer_id, motorcycle_id, version")
      .eq("id", data.id).single();
    if (rErr || !r) throw new Error("Recibo não encontrado");
    if (r.seller_id !== userId && r.buyer_id !== userId)
      throw new Error("Apenas vendedor ou comprador podem anexar o documento assinado");
    if (!["issued", "awaiting_acceptance"].includes(r.status))
      throw new Error(`Não é possível anexar no estado '${r.status}'`);

    // decode base64
    const b64 = data.pdf_base64.replace(/^data:application\/pdf;base64,/, "");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 15 * 1024 * 1024) throw new Error("PDF assinado excede 15 MB");

    const path = `motorcycles/${r.motorcycle_id}/signed/${r.code}-v${r.version}-signed.pdf`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.storage
      .from("smart-receipts")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(`Falha no upload do assinado: ${upErr.message}`);

    const { data: updated, error: uErr } = await supabase
      .from("smart_receipts")
      .update({
        signed_pdf_path: path,
        signed_at: new Date().toISOString(),
        status: r.status === "issued" ? "awaiting_acceptance" : r.status,
        // reset accepts se re-anexar
        seller_accepted_at: null,
        buyer_accepted_at: null,
      } as never)
      .eq("id", r.id)
      .select("id, code, status, version, buyer_id, seller_id, external_buyer, buyer_snapshot, negotiation, signed_pdf_path, seller_accepted_at, buyer_accepted_at")
      .single();
    if (uErr) throw new Error(uErr.message);
    if (!updated) throw new Error("STALE_STATE: O recibo mudou de estado antes do anexo ser registrado.");
    return { ok: true as const, receipt: updated };
  });

/** Registra aceite do vendedor OU comprador (a função identifica pelo userId). */
export const acceptSignedReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => ({ id: String(data.id) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r, error: rErr } = await supabase
      .from("smart_receipts")
      .select("id, status, seller_id, buyer_id, signed_pdf_path")
      .eq("id", data.id).single();
    if (rErr || !r) throw new Error("Recibo não encontrado");
    if (r.status !== "awaiting_acceptance")
      throw new Error(`Aceite indisponível no estado '${r.status}'`);
    if (!r.signed_pdf_path) throw new Error("Anexe o documento assinado antes de aceitar");

    const patch: Record<string, unknown> = {};
    if (userId === r.seller_id) patch.seller_accepted_at = new Date().toISOString();
    else if (userId === r.buyer_id) patch.buyer_accepted_at = new Date().toISOString();
    else throw new Error("Apenas as partes envolvidas podem aceitar");

    // Governança (princípio v1.6): confirmar persistência lendo a linha
    // atualizada. Sem .select().single(), a RLS pode filtrar 0 linhas sem
    // gerar erro — o cliente exibiria "sucesso" com estado inalterado.
    const { data: updated, error } = await supabase
      .from("smart_receipts")
      .update(patch as never)
      .eq("id", data.id)
      .eq("status", "awaiting_acceptance")
      .select("id, code, status, version, buyer_id, seller_id, external_buyer, buyer_snapshot, negotiation, signed_pdf_path, seller_accepted_at, buyer_accepted_at")
      .single();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("STALE_STATE: Este recibo já foi atualizado por outra ação.");
    return { ok: true as const, receipt: updated };
  });

/** Conclui a transferência quando todas as condições estiverem satisfeitas. */
export const completeReceiptTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => ({ id: String(data.id) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r, error: rErr } = await supabase
      .from("smart_receipts")
      .select("id, status, seller_id, buyer_id, signed_pdf_path, seller_accepted_at, buyer_accepted_at, external_buyer")
      .eq("id", data.id).single();
    if (rErr || !r) throw new Error("Recibo não encontrado");
    if (r.seller_id !== userId && r.buyer_id !== userId)
      throw new Error("Apenas partes envolvidas podem concluir");
    if (r.status !== "awaiting_acceptance")
      throw new Error(`Conclusão indisponível no estado '${r.status}'`);
    if (!r.signed_pdf_path) throw new Error("Documento assinado não anexado");
    if (!r.seller_accepted_at) throw new Error("Aguardando aceite do vendedor");
    if (r.buyer_id && !r.buyer_accepted_at) throw new Error("Aguardando aceite do comprador");

    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from("smart_receipts")
      .update({ status: "completed", completed_at: now } as never)
      .eq("id", data.id)
      .eq("status", "awaiting_acceptance") // idempotência otimista
      .select("id, code, status, version, buyer_id, seller_id, external_buyer, buyer_snapshot, negotiation, signed_pdf_path, seller_accepted_at, buyer_accepted_at")
      .single();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("STALE_STATE: A negociação foi alterada antes da conclusão.");
    return { ok: true as const, receipt: updated };
  });

/** Cancela um recibo aberto (draft/issued/awaiting_acceptance). Só vendedor. */
export const cancelDraftReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; reason?: string | null }) => ({
    id: String(data.id), reason: (data.reason ?? "").trim() || null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r, error: rErr } = await supabase
      .from("smart_receipts").select("id, status, seller_id").eq("id", data.id).single();
    if (rErr || !r) throw new Error("Recibo não encontrado");
    if (r.seller_id !== userId) throw new Error("Apenas o vendedor pode cancelar");
    if (!["draft", "issued", "awaiting_acceptance"].includes(r.status))
      throw new Error(`Não é possível cancelar no estado '${r.status}'`);

    const { error } = await supabase
      .from("smart_receipts")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_reason: data.reason,
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Revoga um recibo já emitido/concluído. Preserva histórico. Só vendedor ou admin. */
export const revokeSmartReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; reason: string }) => {
    if (!data?.id) throw new Error("id obrigatório");
    if (!data?.reason?.trim()) throw new Error("Informe o motivo da revogação");
    return { id: data.id, reason: data.reason.trim() };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r } = await supabase
      .from("smart_receipts").select("seller_id, status").eq("id", data.id).single();
    if (!r) throw new Error("Recibo não encontrado");
    const { data: isAdmin } = await supabase.rpc("has_role" as never, { _user_id: userId, _role: "admin" } as never);
    if (r.seller_id !== userId && !isAdmin) throw new Error("Apenas vendedor ou admin podem revogar");
    if (!["issued", "awaiting_acceptance", "completed"].includes(r.status))
      throw new Error(`Estado '${r.status}' não é revogável`);

    const { error } = await supabase
      .from("smart_receipts")
      .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_reason: data.reason } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Contexto autenticado do recibo — usado por /r/$code para saber se o viewer é parte. */
export const getReceiptContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => ({ code: String(data.code).toUpperCase() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r, error } = await supabase
      .from("smart_receipts")
      .select("id, code, status, seller_id, buyer_id, external_buyer, signed_pdf_path, seller_accepted_at, buyer_accepted_at, motorcycle_id")
      .eq("code", data.code).maybeSingle();
    if (error) throw new Error(error.message);
    if (!r) return { role: "none" as const };
    const role = r.seller_id === userId ? "seller"
               : r.buyer_id === userId ? "buyer"
               : "none";
    return {
      role,
      receipt: {
        id: r.id, code: r.code, status: r.status,
        external_buyer: r.external_buyer,
        has_signed: !!r.signed_pdf_path,
        seller_accepted: !!r.seller_accepted_at,
        buyer_accepted: !!r.buyer_accepted_at,
        has_buyer_user: !!r.buyer_id,
        motorcycle_id: r.motorcycle_id,
      },
    };
  });

/** Lista recibos de uma moto para o vendedor/comprador (RLS aplica). */
export const listReceiptsForMotorcycle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { motorcycle_id: string }) => ({ motorcycle_id: String(data.motorcycle_id) }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("smart_receipts")
      .select("id, code, version, status, issued_at, completed_at, sha256, previous_receipt_id, buyer_snapshot, seller_snapshot, negotiation, signed_pdf_path")
      .eq("motorcycle_id", data.motorcycle_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });