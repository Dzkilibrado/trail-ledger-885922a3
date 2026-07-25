import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Central de Transferências — leitura consolidada.
 *
 * Une, no servidor e respeitando RLS de cada tabela, os processos em que o
 * usuário participa como vendedor/comprador/proprietário/destinatário:
 *
 *  - `smart_receipts` (Compra e Venda / Recibo Inteligente)
 *  - `ownership_transfers` (Transferência por convite — fluxo por e-mail)
 *
 * NÃO cria vínculo por escrita entre as duas tabelas. Cada modelo continua
 * sendo a fonte de verdade do próprio processo; a Central apenas interpreta
 * e apresenta.
 */

export type ProcessType = "receipt" | "invite";
export type ProcessRole = "seller" | "buyer";
export type ProcessBucket =
  | "awaiting_me"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface ProcessItem {
  key: string; // uid único (type + id) para React key
  id: string;
  type: ProcessType;
  type_label: string;
  motorcycle_id: string;
  motorcycle_name: string;
  motorcycle_photo: string | null;
  trailbook_id: string | null;
  receipt_code: string | null;
  role: ProcessRole;
  role_label: string;
  status: string;
  display_status: string;
  status_bucket: ProcessBucket;
  started_at: string;
  updated_at: string;
  counterparty_name: string | null;
  requires_user_action: boolean;
  action_owner_label: string; // "Aguardando sua ação" | "Aguardando comprador" | ...
  next_action_label: string | null;
  detail_url: string;
}

const RECEIPT_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  issued: "Aguardando andamento",
  awaiting_acceptance: "Aguardando aceite",
  completed: "Concluído",
  cancelled: "Cancelado",
  superseded: "Substituído",
  revoked: "Revogado",
};

const INVITE_STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando resposta",
  approved: "Concluído",
  rejected: "Recusado",
  cancelled: "Cancelado",
};

function motoName(m: {
  brand?: string | null;
  model?: string | null;
  nickname?: string | null;
  year_model?: number | null;
}): string {
  const primary = m.nickname?.trim() || [m.brand, m.model].filter(Boolean).join(" ").trim();
  return primary || "Motocicleta";
}

export const listUserProcesses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProcessItem[]> => {
    const { supabase, userId } = context;

    // 1) Recibos onde o usuário é vendedor OU comprador (RLS já garante isso,
    //    mas filtramos explicitamente para não trazer recibos onde ele é
    //    apenas admin/owner sem papel na negociação).
    const receiptsPromise = supabase
      .from("smart_receipts")
      .select(
        "id, code, status, version, seller_id, buyer_id, external_buyer, " +
          "buyer_snapshot, seller_snapshot, negotiation, " +
          "created_at, updated_at, issued_at, signed_at, completed_at, cancelled_at, " +
          "signed_pdf_path, original_pdf_path, seller_accepted_at, buyer_accepted_at, " +
          "motorcycle_id, " +
          "motorcycles!inner(id, brand, model, nickname, year_model, trailbook_id, main_photo_url)",
      )
      .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`)
      .order("updated_at", { ascending: false })
      .limit(200);

    // 2) Convites de transferência (view mascarada já filtra por from/to = uid).
    const invitesPromise = supabase
      .from("my_ownership_transfers")
      .select(
        "id, motorcycle_id, from_user_id, to_user_id, to_email, status, message, " +
          "requested_at, resolved_at, created_at, updated_at, " +
          "motorcycles!inner(id, brand, model, nickname, year_model, trailbook_id, main_photo_url)",
      )
      .order("updated_at", { ascending: false })
      .limit(200);

    const [receiptsRes, invitesRes] = await Promise.all([receiptsPromise, invitesPromise]);
    if (receiptsRes.error) throw new Error(receiptsRes.error.message);
    if (invitesRes.error) throw new Error(invitesRes.error.message);

    const items: ProcessItem[] = [];

    // ---- Recibos ----
    for (const r of (receiptsRes.data ?? []) as Array<Record<string, unknown>>) {
      const moto = (r.motorcycles ?? {}) as Record<string, unknown>;
      const role: ProcessRole = r.seller_id === userId ? "seller" : "buyer";
      const isSeller = role === "seller";
      const status = String(r.status);
      const buyerSnap = (r.buyer_snapshot ?? {}) as { full_name?: string };
      const sellerSnap = (r.seller_snapshot ?? {}) as { full_name?: string };
      const counterparty = isSeller
        ? (buyerSnap.full_name ?? "Comprador")
        : (sellerSnap.full_name ?? "Vendedor");

      let bucket: ProcessBucket = "in_progress";
      let requiresMe = false;
      let actionOwner = "";
      let nextAction: string | null = null;
      let detail = `/recibos/${String(r.code)}/visualizar`;

      switch (status) {
        case "draft":
          if (isSeller) {
            bucket = "awaiting_me";
            requiresMe = true;
            actionOwner = "Aguardando sua ação";
            nextAction = "Continuar rascunho";
            detail = `/motorcycles/${String(r.motorcycle_id)}/control`;
          } else {
            bucket = "in_progress";
            actionOwner = "Aguardando vendedor";
            nextAction = "Ver detalhes";
          }
          break;
        case "issued":
        case "awaiting_acceptance": {
          const sellerAccepted = Boolean(r.seller_accepted_at);
          const buyerAccepted = Boolean(r.buyer_accepted_at);
          const hasSigned = Boolean(r.signed_pdf_path);
          if (isSeller) {
            if (!hasSigned) {
              bucket = "awaiting_me";
              requiresMe = true;
              actionOwner = "Aguardando sua ação";
              nextAction = "Enviar documento assinado";
            } else if (!sellerAccepted) {
              bucket = "awaiting_me";
              requiresMe = true;
              actionOwner = "Aguardando sua ação";
              nextAction = "Confirmar aceite";
            } else if (!buyerAccepted) {
              bucket = "in_progress";
              actionOwner = "Aguardando comprador";
              nextAction = "Ver documento";
            } else {
              bucket = "in_progress";
              actionOwner = "Aguardando conclusão";
              nextAction = "Ver documento";
            }
          } else {
            if (!buyerAccepted) {
              bucket = "awaiting_me";
              requiresMe = true;
              actionOwner = "Aguardando sua ação";
              nextAction = "Aceitar recibo";
            } else if (!sellerAccepted) {
              bucket = "in_progress";
              actionOwner = "Aguardando vendedor";
              nextAction = "Ver documento";
            } else {
              bucket = "in_progress";
              actionOwner = "Aguardando conclusão";
              nextAction = "Ver documento";
            }
          }
          break;
        }
        case "completed":
          bucket = "completed";
          actionOwner = "Nenhuma ação pendente";
          nextAction = "Ver documento";
          break;
        case "cancelled":
        case "revoked":
        case "superseded":
          bucket = "cancelled";
          actionOwner = "Nenhuma ação pendente";
          nextAction = "Ver detalhes";
          break;
        default:
          actionOwner = "";
      }

      const started = String(r.created_at);
      const updated = String(r.updated_at ?? r.created_at);

      items.push({
        key: `receipt:${String(r.id)}`,
        id: String(r.id),
        type: "receipt",
        type_label: "Compra e Venda",
        motorcycle_id: String(r.motorcycle_id),
        motorcycle_name: motoName(moto as never),
        motorcycle_photo: (moto.main_photo_url as string | null) ?? null,
        trailbook_id: (moto.trailbook_id as string | null) ?? null,
        receipt_code: String(r.code),
        role,
        role_label: isSeller ? "Você está vendendo" : "Você está comprando",
        status,
        display_status: RECEIPT_STATUS_LABEL[status] ?? status,
        status_bucket: bucket,
        started_at: started,
        updated_at: updated,
        counterparty_name: counterparty,
        requires_user_action: requiresMe,
        action_owner_label: actionOwner,
        next_action_label: nextAction,
        detail_url: detail,
      });
    }

    // ---- Convites de transferência ----
    for (const t of (invitesRes.data ?? []) as Array<Record<string, unknown>>) {
      const moto = (t.motorcycles ?? {}) as Record<string, unknown>;
      const role: ProcessRole = t.from_user_id === userId ? "seller" : "buyer";
      const isSender = role === "seller";
      const status = String(t.status);

      let bucket: ProcessBucket = "in_progress";
      let requiresMe = false;
      let actionOwner = "";
      let nextAction: string | null = null;

      switch (status) {
        case "pending":
          if (isSender) {
            bucket = "in_progress";
            actionOwner = "Aguardando comprador";
            nextAction = "Ver detalhes";
          } else {
            bucket = "awaiting_me";
            requiresMe = true;
            actionOwner = "Aguardando sua ação";
            nextAction = "Aceitar ou recusar";
          }
          break;
        case "approved":
          bucket = "completed";
          actionOwner = "Nenhuma ação pendente";
          nextAction = "Ver detalhes";
          break;
        case "rejected":
        case "cancelled":
          bucket = "cancelled";
          actionOwner = "Nenhuma ação pendente";
          nextAction = "Ver histórico";
          break;
      }

      const counterparty = isSender
        ? ((t.to_email as string | null) ?? "Destinatário")
        : "Proprietário anterior";

      const started = String(t.requested_at ?? t.created_at);
      const updated = String(t.updated_at ?? t.resolved_at ?? started);

      items.push({
        key: `invite:${String(t.id)}`,
        id: String(t.id),
        type: "invite",
        type_label: "Transferência por convite",
        motorcycle_id: String(t.motorcycle_id),
        motorcycle_name: motoName(moto as never),
        motorcycle_photo: (moto.main_photo_url as string | null) ?? null,
        trailbook_id: (moto.trailbook_id as string | null) ?? null,
        receipt_code: null,
        role,
        role_label: isSender ? "Você está vendendo" : "Você está comprando",
        status,
        display_status: INVITE_STATUS_LABEL[status] ?? status,
        status_bucket: bucket,
        started_at: started,
        updated_at: updated,
        counterparty_name: counterparty,
        requires_user_action: requiresMe,
        action_owner_label: actionOwner,
        next_action_label: nextAction,
        detail_url: `/transfers?invite=${String(t.id)}`,
      });
    }

    // Ordenar por atualização (mais recente primeiro).
    items.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    return items;
  });