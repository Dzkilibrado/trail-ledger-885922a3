/**
 * Enriquecimento do Ambiente Permanente de Homologação (APH).
 *
 * Idempotente por design:
 *  - events → marcados via metadata.homolog_tag = '<slug>:<n>'; skip se já existir.
 *  - ownership_history → marcados via notes = '[HOMOLOG]<slug>:<n>'.
 *  - smart_receipts → code prefixado `TB-RCV-HOMOLOG-<slug>-<n>` (UNIQUE).
 *  - motorcycle_documents → notes = '[HOMOLOG]<slug>:<n>'.
 *  - certificates → allowed_sections marker.
 *  - maintenance_schedules → notes com prefixo [HOMOLOG].
 *
 * Reexecutar seedHomologEnvironment → nenhuma duplicidade.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type UserMap = Record<"A" | "B" | "C" | "D" | "E", string>;
type MotoMap = Record<string, string>; // slug -> motorcycle id

type Admin = SupabaseClient<any, "public", any>;

function daysAgo(n: number, hour = 10): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

async function tagExists(admin: Admin, motoId: string, tag: string): Promise<boolean> {
  const { data } = await admin
    .from("events")
    .select("id")
    .eq("motorcycle_id", motoId)
    .filter("metadata->>homolog_tag", "eq", tag)
    .maybeSingle();
  return !!data;
}

async function ensureEvent(
  admin: Admin,
  moto: { id: string; slug: string; ownerId: string },
  seq: number,
  data: {
    type: string;
    title: string;
    description?: string;
    occurred_at: string;
    cost?: number;
    km_at_event?: number;
    hours_at_event?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<string | null> {
  const tag = `${moto.slug}:${seq}`;
  if (await tagExists(admin, moto.id, tag)) return null;
  const { data: row, error } = await admin
    .from("events")
    .insert({
      motorcycle_id: moto.id,
      created_by: moto.ownerId,
      type: data.type as never,
      title: data.title,
      description: data.description ?? null,
      occurred_at: data.occurred_at,
      cost: data.cost ?? null,
      km_at_event: data.km_at_event ?? null,
      hours_at_event: data.hours_at_event ?? null,
      metadata: { ...(data.metadata ?? {}), homolog_tag: tag },
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(`event ${tag}: ${error.message}`);
  return row.id;
}

async function ensureOwnershipEntry(
  admin: Admin,
  motoId: string,
  ownerId: string,
  method: "creation" | "transfer",
  started_at: string,
  ended_at: string | null,
  marker: string,
) {
  const notesMarker = `[HOMOLOG]${marker}`;
  const { data: existing } = await admin
    .from("ownership_history")
    .select("id")
    .eq("motorcycle_id", motoId)
    .eq("notes", notesMarker)
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await admin
    .from("ownership_history")
    .insert({
      motorcycle_id: motoId,
      owner_id: ownerId,
      method: method as never,
      started_at,
      ended_at,
      notes: notesMarker,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(`ownership ${marker}: ${error.message}`);
  return data.id;
}

async function ensureDocument(
  admin: Admin,
  moto: { id: string; slug: string; ownerId: string },
  seq: number,
  data: {
    doc_type: string;
    doc_number?: string;
    doc_date?: string;
    issuer?: string;
    amount?: number;
    is_origin_document?: boolean;
    file_name?: string;
  },
): Promise<string | null> {
  const marker = `${moto.slug}:doc:${seq}`;
  const notesMarker = `[HOMOLOG]${marker}`;
  const { data: existing } = await admin
    .from("motorcycle_documents")
    .select("id")
    .eq("motorcycle_id", moto.id)
    .eq("notes", notesMarker)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: row, error } = await admin
    .from("motorcycle_documents")
    .insert({
      motorcycle_id: moto.id,
      created_by: moto.ownerId,
      doc_type: data.doc_type as never,
      bucket: "documents",
      storage_path: `homolog/${moto.slug}/${marker}.pdf`,
      file_name: data.file_name ?? `${marker}.pdf`,
      mime_type: "application/pdf",
      doc_number: data.doc_number ?? null,
      doc_date: data.doc_date ?? null,
      issuer: data.issuer ?? null,
      amount: data.amount ?? null,
      is_origin_document: !!data.is_origin_document,
      notes: notesMarker,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(`doc ${marker}: ${error.message}`);
  return row.id;
}

async function ensureReceipt(
  admin: Admin,
  moto: { id: string; slug: string },
  seq: number,
  input: {
    status: "draft" | "issued" | "awaiting_acceptance" | "completed" | "cancelled" | "superseded" | "revoked";
    seller_id: string;
    buyer_id: string | null;
    external_buyer: boolean;
    seller_snapshot: Record<string, unknown>;
    buyer_snapshot: Record<string, unknown>;
    motorcycle_snapshot: Record<string, unknown>;
    negotiation: Record<string, unknown>;
    created_by: string;
    issued_at?: string;
    seller_accepted_at?: string;
    buyer_accepted_at?: string;
    completed_at?: string;
    cancelled_at?: string;
    cancelled_reason?: string;
    revoked_at?: string;
    revoked_reason?: string;
    previous_receipt_id?: string | null;
  },
): Promise<{ id: string; code: string; created: boolean }> {
  const code = `TB-RCV-HOMOLOG-${moto.slug}-${seq}`;
  const { data: existing } = await admin
    .from("smart_receipts")
    .select("id, code")
    .eq("code", code)
    .maybeSingle();
  if (existing) return { id: existing.id, code, created: false };
  const { data: row, error } = await admin
    .from("smart_receipts")
    .insert({
      motorcycle_id: moto.id,
      code,
      status: input.status,
      seller_id: input.seller_id,
      buyer_id: input.buyer_id,
      external_buyer: input.external_buyer,
      seller_snapshot: input.seller_snapshot,
      buyer_snapshot: input.buyer_snapshot,
      motorcycle_snapshot: input.motorcycle_snapshot,
      negotiation: input.negotiation,
      created_by: input.created_by,
      issued_at: input.issued_at ?? null,
      seller_accepted_at: input.seller_accepted_at ?? null,
      buyer_accepted_at: input.buyer_accepted_at ?? null,
      completed_at: input.completed_at ?? null,
      cancelled_at: input.cancelled_at ?? null,
      cancelled_reason: input.cancelled_reason ?? null,
      revoked_at: input.revoked_at ?? null,
      revoked_reason: input.revoked_reason ?? null,
      previous_receipt_id: input.previous_receipt_id ?? null,
    } as never)
    .select("id, code")
    .single();
  if (error) throw new Error(`receipt ${code}: ${error.message}`);
  return { id: row.id, code, created: true };
}

async function ensureCertificate(admin: Admin, motoId: string, marker: string) {
  const { data: existing } = await admin
    .from("certificates")
    .select("id")
    .eq("motorcycle_id", motoId)
    .contains("allowed_sections", [marker] as never)
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await admin
    .from("certificates")
    .insert({
      motorcycle_id: motoId,
      allowed_sections: [
        "basic", "photo", "usage", "conservation", "health", "upcoming", "history", "workshop", "photos", marker,
      ] as never,
      status: "active",
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(`certificate: ${error.message}`);
  return data.id;
}

async function ensureSchedule(
  admin: Admin,
  motoId: string,
  data: {
    name: string;
    category: string;
    interval_km?: number;
    interval_hours?: number;
    interval_days?: number;
    last_done_km?: number;
    last_done_hours?: number;
    last_done_at?: string;
    status?: string;
  },
) {
  const marker = `[HOMOLOG] ${data.name}`;
  const { data: existing } = await admin
    .from("maintenance_schedules")
    .select("id")
    .eq("motorcycle_id", motoId)
    .eq("notes", marker)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: row, error } = await admin
    .from("maintenance_schedules")
    .insert({
      motorcycle_id: motoId,
      name: data.name,
      category: data.category as never,
      interval_km: data.interval_km ?? null,
      interval_hours: data.interval_hours ?? null,
      interval_days: data.interval_days ?? null,
      last_done_km: data.last_done_km ?? null,
      last_done_hours: data.last_done_hours ?? null,
      last_done_at: data.last_done_at ?? null,
      status: (data.status ?? "active") as never,
      is_custom: true,
      notes: marker,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(`schedule ${data.name}: ${error.message}`);
  return row.id;
}

async function setOwner(admin: Admin, motoId: string, ownerId: string) {
  await admin.from("motorcycles").update({ owner_id: ownerId } as never).eq("id", motoId);
}

// ---------------------------------------------------------------------------

export async function enrichHomologEnvironment(
  admin: Admin,
  users: UserMap,
  motos: MotoMap,
): Promise<{ warnings: string[] }> {
  const warnings: string[] = [];

  const snap = (label: string, id: string, email?: string) => ({
    id, label, email: email ?? null, source: "HOMOLOG",
  });

  const motoSnap = (slug: string) => ({ slug, source: "HOMOLOG" });

  // =====================================================================
  // M2 — Histórico completo, 1 proprietário (A), draft receipt
  // =====================================================================
  if (motos.M2) {
    const m = { id: motos.M2, slug: "M2", ownerId: users.A };
    await setOwner(admin, m.id, users.A);
    await ensureOwnershipEntry(admin, m.id, users.A, "creation", daysAgo(1500), null, "M2:1");
    await ensureDocument(admin, m, 1, { doc_type: "invoice", is_origin_document: true, doc_number: "NF-HOM-M2-0001", doc_date: daysAgo(1500).slice(0, 10), issuer: "Concessionária Fictícia", amount: 18500 });
    await ensureDocument(admin, m, 2, { doc_type: "manual", file_name: "manual.pdf" });
    await ensureDocument(admin, m, 3, { doc_type: "warranty", file_name: "garantia.pdf", doc_date: daysAgo(1400).slice(0, 10) });

    await ensureEvent(admin, m, 1, { type: "purchase", title: "Compra da moto", occurred_at: daysAgo(1500), cost: 18500 });
    await ensureEvent(admin, m, 2, { type: "maintenance", title: "Primeira revisão (1.000 km)", occurred_at: daysAgo(1450), km_at_event: 1000, cost: 320 });
    await ensureEvent(admin, m, 3, { type: "maintenance", title: "Troca de óleo + filtro", occurred_at: daysAgo(1100), km_at_event: 8000, cost: 180 });
    await ensureEvent(admin, m, 4, { type: "revision", title: "Revisão dos 10.000 km", occurred_at: daysAgo(1000), km_at_event: 10000, cost: 650 });
    await ensureEvent(admin, m, 5, { type: "maintenance", title: "Troca de pastilhas de freio", occurred_at: daysAgo(700), km_at_event: 22000, cost: 240 });
    await ensureEvent(admin, m, 6, { type: "accessory", title: "Instalação de protetor de motor", occurred_at: daysAgo(600), cost: 480 });
    await ensureEvent(admin, m, 7, { type: "maintenance", title: "Troca de pneus", occurred_at: daysAgo(300), km_at_event: 32000, cost: 1200 });
    await ensureEvent(admin, m, 8, { type: "revision", title: "Revisão preventiva anual", occurred_at: daysAgo(60), km_at_event: 37800, cost: 420 });
    await ensureEvent(admin, m, 9, { type: "note", title: "Moto em ótimo estado", occurred_at: daysAgo(10) });

    await ensureSchedule(admin, m.id, { name: "Troca de óleo", category: "engine", interval_km: 3000, last_done_km: 37800, last_done_at: daysAgo(60), status: "active" });
    await ensureSchedule(admin, m.id, { name: "Filtro de ar", category: "engine", interval_km: 10000, last_done_km: 32000, last_done_at: daysAgo(300) });
    await ensureSchedule(admin, m.id, { name: "Corrente e coroa", category: "transmission", interval_km: 15000, last_done_km: 32000, last_done_at: daysAgo(300) });

    await ensureCertificate(admin, m.id, "homolog:M2");

    // Draft de recibo (moto ainda em nome de A) — apenas rascunho, sem alterar owner_id
    await ensureReceipt(admin, m, 1, {
      status: "draft",
      seller_id: users.A, buyer_id: users.B, external_buyer: false,
      seller_snapshot: snap("Vendedor A", users.A, "vendedor.a@homolog.trailbook.test"),
      buyer_snapshot: snap("Comprador B", users.B, "comprador.b@homolog.trailbook.test"),
      motorcycle_snapshot: motoSnap("M2"),
      negotiation: { amount: 16500, payment_method: "PIX", date: daysAgo(1).slice(0, 10), notes: "Rascunho de homologação" },
      created_by: users.A,
    });
  }

  // =====================================================================
  // M5 — Múltiplos proprietários (A → B → D), 2 completed + 1 superseded
  // =====================================================================
  if (motos.M5) {
    const m = { id: motos.M5, slug: "M5", ownerId: users.D };
    await setOwner(admin, m.id, users.D);
    await ensureOwnershipEntry(admin, m.id, users.A, "creation", daysAgo(2000), daysAgo(1200), "M5:1");
    await ensureOwnershipEntry(admin, m.id, users.B, "transfer", daysAgo(1200), daysAgo(400), "M5:2");
    await ensureOwnershipEntry(admin, m.id, users.D, "transfer", daysAgo(400), null, "M5:3");

    await ensureDocument(admin, m, 1, { doc_type: "invoice", is_origin_document: true, doc_number: "NF-HOM-M5-0001", doc_date: daysAgo(2000).slice(0, 10), issuer: "KTM Brasil (fictício)", amount: 42000 });
    await ensureDocument(admin, m, 2, { doc_type: "bill_of_sale", doc_number: "RCV-M5-2022", doc_date: daysAgo(1200).slice(0, 10), amount: 32000 });
    await ensureDocument(admin, m, 3, { doc_type: "bill_of_sale", doc_number: "RCV-M5-2024", doc_date: daysAgo(400).slice(0, 10), amount: 28000 });

    // Recibo superseded (v1) → substituído (v2 completed)
    const rSup = await ensureReceipt(admin, m, 1, {
      status: "superseded",
      seller_id: users.A, buyer_id: users.B, external_buyer: false,
      seller_snapshot: snap("Vendedor A", users.A), buyer_snapshot: snap("Comprador B", users.B),
      motorcycle_snapshot: motoSnap("M5"),
      negotiation: { amount: 33000, payment_method: "Transferência", date: daysAgo(1210).slice(0, 10), notes: "Substituído por correção de valor" },
      created_by: users.A,
      issued_at: daysAgo(1210), cancelled_at: daysAgo(1205), cancelled_reason: "Substituído",
    });
    await ensureReceipt(admin, m, 2, {
      status: "completed",
      seller_id: users.A, buyer_id: users.B, external_buyer: false,
      seller_snapshot: snap("Vendedor A", users.A), buyer_snapshot: snap("Comprador B", users.B),
      motorcycle_snapshot: motoSnap("M5"),
      negotiation: { amount: 32000, payment_method: "Transferência", date: daysAgo(1200).slice(0, 10) },
      created_by: users.A,
      issued_at: daysAgo(1201), seller_accepted_at: daysAgo(1200), buyer_accepted_at: daysAgo(1200), completed_at: daysAgo(1200),
      previous_receipt_id: rSup.id,
    });
    await ensureReceipt(admin, m, 3, {
      status: "completed",
      seller_id: users.B, buyer_id: users.D, external_buyer: false,
      seller_snapshot: snap("Vendedor B", users.B), buyer_snapshot: snap("Comprador D", users.D),
      motorcycle_snapshot: motoSnap("M5"),
      negotiation: { amount: 28000, payment_method: "PIX", date: daysAgo(400).slice(0, 10) },
      created_by: users.B,
      issued_at: daysAgo(401), seller_accepted_at: daysAgo(400), buyer_accepted_at: daysAgo(400), completed_at: daysAgo(400),
    });

    await ensureEvent(admin, m, 1, { type: "purchase", title: "Compra original", occurred_at: daysAgo(2000), cost: 42000 });
    await ensureEvent(admin, m, 2, { type: "maintenance", title: "Revisão dos 20h", occurred_at: daysAgo(1800), hours_at_event: 20 });
    await ensureEvent(admin, m, 3, { type: "sale", title: "Venda para novo proprietário", occurred_at: daysAgo(1200), cost: 32000 });
    await ensureEvent(admin, m, 4, { type: "ownership_transfer", title: "Transferência de propriedade (A → B)", occurred_at: daysAgo(1200), metadata: { receipt_code: "TB-RCV-HOMOLOG-M5-2" } });
    await ensureEvent(admin, m, 5, { type: "maintenance", title: "Manutenção completa", occurred_at: daysAgo(800), hours_at_event: 220, cost: 1450 });
    await ensureEvent(admin, m, 6, { type: "sale", title: "Nova venda", occurred_at: daysAgo(400), cost: 28000 });
    await ensureEvent(admin, m, 7, { type: "ownership_transfer", title: "Transferência de propriedade (B → D)", occurred_at: daysAgo(400), metadata: { receipt_code: "TB-RCV-HOMOLOG-M5-3" } });
    await ensureEvent(admin, m, 8, { type: "maintenance", title: "Revisão pós-compra", occurred_at: daysAgo(380), hours_at_event: 400, cost: 620 });
    await ensureEvent(admin, m, 9, { type: "revision", title: "Revisão dos 450h", occurred_at: daysAgo(30), hours_at_event: 470, cost: 890 });

    await ensureSchedule(admin, m.id, { name: "Óleo motor", category: "engine", interval_hours: 15, last_done_hours: 470, last_done_at: daysAgo(30) });
    await ensureSchedule(admin, m.id, { name: "Válvulas", category: "engine", interval_hours: 90, last_done_hours: 400, last_done_at: daysAgo(380) });
    await ensureCertificate(admin, m.id, "homolog:M5");
  }

  // =====================================================================
  // M6 — Em negociação: awaiting_acceptance (A → B)
  // =====================================================================
  if (motos.M6) {
    const m = { id: motos.M6, slug: "M6", ownerId: users.A };
    await setOwner(admin, m.id, users.A);
    await ensureOwnershipEntry(admin, m.id, users.A, "creation", daysAgo(800), null, "M6:1");
    await ensureDocument(admin, m, 1, { doc_type: "invoice", is_origin_document: true, doc_number: "NF-HOM-M6-0001", doc_date: daysAgo(800).slice(0, 10), amount: 39000 });

    await ensureEvent(admin, m, 1, { type: "purchase", title: "Compra", occurred_at: daysAgo(800), cost: 39000 });
    await ensureEvent(admin, m, 2, { type: "maintenance", title: "Revisão 30h", occurred_at: daysAgo(600), hours_at_event: 30, cost: 380 });
    await ensureEvent(admin, m, 3, { type: "maintenance", title: "Troca de pneus", occurred_at: daysAgo(200), hours_at_event: 120, cost: 980 });
    await ensureEvent(admin, m, 4, { type: "note", title: "Anúncio publicado — em negociação com Comprador B", occurred_at: daysAgo(5) });

    await ensureSchedule(admin, m.id, { name: "Óleo motor", category: "engine", interval_hours: 15, last_done_hours: 120, last_done_at: daysAgo(200) });

    await ensureReceipt(admin, m, 1, {
      status: "awaiting_acceptance",
      seller_id: users.A, buyer_id: users.B, external_buyer: false,
      seller_snapshot: snap("Vendedor A", users.A, "vendedor.a@homolog.trailbook.test"),
      buyer_snapshot: snap("Comprador B", users.B, "comprador.b@homolog.trailbook.test"),
      motorcycle_snapshot: motoSnap("M6"),
      negotiation: { amount: 34000, payment_method: "PIX", date: daysAgo(2).slice(0, 10), location: "São Paulo" },
      created_by: users.A,
      issued_at: daysAgo(3), seller_accepted_at: daysAgo(2),
    });
  }

  // =====================================================================
  // M7 — Venda concluída (A → B completed)
  // =====================================================================
  if (motos.M7) {
    const m = { id: motos.M7, slug: "M7", ownerId: users.B };
    await setOwner(admin, m.id, users.B);
    await ensureOwnershipEntry(admin, m.id, users.A, "creation", daysAgo(1800), daysAgo(200), "M7:1");
    await ensureOwnershipEntry(admin, m.id, users.B, "transfer", daysAgo(200), null, "M7:2");

    await ensureDocument(admin, m, 1, { doc_type: "invoice", is_origin_document: true, doc_number: "NF-HOM-M7-0001", doc_date: daysAgo(1800).slice(0, 10), amount: 38000 });
    await ensureDocument(admin, m, 2, { doc_type: "bill_of_sale", doc_number: "RCV-M7", doc_date: daysAgo(200).slice(0, 10), amount: 26000 });

    await ensureReceipt(admin, m, 1, {
      status: "completed",
      seller_id: users.A, buyer_id: users.B, external_buyer: false,
      seller_snapshot: snap("Vendedor A", users.A), buyer_snapshot: snap("Comprador B", users.B),
      motorcycle_snapshot: motoSnap("M7"),
      negotiation: { amount: 26000, payment_method: "Transferência", date: daysAgo(200).slice(0, 10) },
      created_by: users.A,
      issued_at: daysAgo(202), seller_accepted_at: daysAgo(201), buyer_accepted_at: daysAgo(200), completed_at: daysAgo(200),
    });

    await ensureEvent(admin, m, 1, { type: "purchase", title: "Compra original", occurred_at: daysAgo(1800), cost: 38000 });
    await ensureEvent(admin, m, 2, { type: "maintenance", title: "Manutenções preventivas", occurred_at: daysAgo(1000), hours_at_event: 300 });
    await ensureEvent(admin, m, 3, { type: "sale", title: "Venda para Comprador B", occurred_at: daysAgo(200), cost: 26000 });
    await ensureEvent(admin, m, 4, { type: "ownership_transfer", title: "Transferência de propriedade (A → B)", occurred_at: daysAgo(200), metadata: { receipt_code: "TB-RCV-HOMOLOG-M7-1" } });
    await ensureEvent(admin, m, 5, { type: "revision", title: "Revisão pós-compra", occurred_at: daysAgo(180), hours_at_event: 610, cost: 720 });
    await ensureEvent(admin, m, 6, { type: "maintenance", title: "Troca de óleo", occurred_at: daysAgo(30), hours_at_event: 640, cost: 240 });

    await ensureCertificate(admin, m.id, "homolog:M7");
  }

  // =====================================================================
  // M10 — Crítica: pendências + issued + cancelled + revoked
  // =====================================================================
  if (motos.M10) {
    const m = { id: motos.M10, slug: "M10", ownerId: users.D };
    await setOwner(admin, m.id, users.D);
    await ensureOwnershipEntry(admin, m.id, users.D, "creation", daysAgo(1600), null, "M10:1");
    // Sem documento de origem — pendência intencional
    await ensureDocument(admin, m, 1, { doc_type: "other", doc_number: "NOTA-INFORMAL", doc_date: daysAgo(1600).slice(0, 10) });

    // Recibo issued (aguardando assinatura)
    await ensureReceipt(admin, m, 1, {
      status: "issued",
      seller_id: users.D, buyer_id: null, external_buyer: true,
      seller_snapshot: snap("Vendedor D", users.D), buyer_snapshot: { label: "Comprador externo simulado", full_name: "Externo C", source: "HOMOLOG" },
      motorcycle_snapshot: motoSnap("M10"),
      negotiation: { amount: 12000, payment_method: "Dinheiro", date: daysAgo(1).slice(0, 10) },
      created_by: users.D,
      issued_at: daysAgo(1),
    });

    // Recibo cancelled
    await ensureReceipt(admin, m, 2, {
      status: "cancelled",
      seller_id: users.D, buyer_id: users.B, external_buyer: false,
      seller_snapshot: snap("Vendedor D", users.D), buyer_snapshot: snap("Comprador B", users.B),
      motorcycle_snapshot: motoSnap("M10"),
      negotiation: { amount: 15000, payment_method: "PIX", date: daysAgo(60).slice(0, 10) },
      created_by: users.D,
      issued_at: daysAgo(60), cancelled_at: daysAgo(55), cancelled_reason: "Comprador desistiu",
    });

    // Recibo revoked (após completed) — mantido no histórico
    await ensureReceipt(admin, m, 3, {
      status: "revoked",
      seller_id: users.D, buyer_id: users.B, external_buyer: false,
      seller_snapshot: snap("Vendedor D", users.D), buyer_snapshot: snap("Comprador B", users.B),
      motorcycle_snapshot: motoSnap("M10"),
      negotiation: { amount: 14000, payment_method: "PIX", date: daysAgo(120).slice(0, 10) },
      created_by: users.D,
      issued_at: daysAgo(120), seller_accepted_at: daysAgo(119), buyer_accepted_at: daysAgo(118), completed_at: daysAgo(118),
      revoked_at: daysAgo(100), revoked_reason: "Desfeita por acordo entre as partes (fictício)",
    });

    await ensureEvent(admin, m, 1, { type: "purchase", title: "Aquisição informal (sem NF)", occurred_at: daysAgo(1600), cost: 8000 });
    await ensureEvent(admin, m, 2, { type: "incident", title: "Queda em trilha", occurred_at: daysAgo(1100), hours_at_event: 450 });
    await ensureEvent(admin, m, 3, { type: "maintenance", title: "Retífica parcial", occurred_at: daysAgo(1000), hours_at_event: 460, cost: 3200 });
    await ensureEvent(admin, m, 4, { type: "note", title: "Documento de origem pendente — regularizar", occurred_at: daysAgo(900) });
    await ensureEvent(admin, m, 5, { type: "maintenance", title: "Troca completa de suspensão", occurred_at: daysAgo(500), hours_at_event: 720, cost: 5400 });
    await ensureEvent(admin, m, 6, { type: "revision", title: "Revisão intensiva", occurred_at: daysAgo(200), hours_at_event: 900, cost: 2100 });
    await ensureEvent(admin, m, 7, { type: "note", title: "Venda cancelada (Recibo 2)", occurred_at: daysAgo(55) });
    await ensureEvent(admin, m, 8, { type: "warranty", title: "Chamado de garantia negado", occurred_at: daysAgo(30) });

    await ensureSchedule(admin, m.id, { name: "Óleo motor (vencido)", category: "engine", interval_hours: 15, last_done_hours: 900, last_done_at: daysAgo(200) });
    await ensureSchedule(admin, m.id, { name: "Pastilhas de freio", category: "brakes", interval_hours: 40, last_done_hours: 720, last_done_at: daysAgo(500) });
    await ensureSchedule(admin, m.id, { name: "Corrente/coroa/pinhão", category: "transmission", interval_hours: 60, last_done_hours: 720, last_done_at: daysAgo(500) });
    await ensureSchedule(admin, m.id, { name: "Válvulas", category: "engine", interval_hours: 90, last_done_hours: 460, last_done_at: daysAgo(1000) });
    // Sem certificado — moto crítica
  }

  return { warnings };
}

/** Normaliza a senha de todas as contas APH para o valor de HOMOLOG_PASSWORD, se definido. */
export async function normalizeHomologPasswords(
  admin: Admin,
  users: UserMap,
): Promise<{ updated: number; skipped: boolean }> {
  const pwd = process.env.HOMOLOG_PASSWORD;
  if (!pwd || pwd.length < 8) return { updated: 0, skipped: true };
  let updated = 0;
  for (const uid of Object.values(users)) {
    const { error } = await admin.auth.admin.updateUserById(uid, { password: pwd });
    if (!error) updated++;
  }
  return { updated, skipped: false };
}