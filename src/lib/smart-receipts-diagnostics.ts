type IssueStage =
  | "load_receipt"
  | "authorize"
  | "prepare_payload"
  | "import_pdf_builder"
  | "generate_pdf_bytes"
  | "upload_pdf"
  | "update_receipt_status"
  | "done";

export type { IssueStage };

export function makeRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeSupportCode(requestId: string): string {
  const compact = requestId.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `SR-${compact.slice(0, 8).padEnd(8, "0")}`;
}

export function maskUserId(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return `${userId.slice(0, 4)}…${userId.slice(-4)}`;
}

function maskEmail(value: unknown): string | null {
  if (typeof value !== "string" || !value.includes("@")) return null;
  const [name, domain] = value.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskCpf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const d = value.replace(/\D/g, "");
  if (d.length < 4) return "***";
  return `***${d.slice(-4)}`;
}

function maskPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const d = value.replace(/\D/g, "");
  if (!d) return null;
  return `***${d.slice(-4)}`;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function sanitizeReceiptPayloadForLog(receipt: Record<string, unknown> | null | undefined) {
  const negotiation = (receipt?.negotiation ?? {}) as Record<string, unknown>;
  const buyer = (receipt?.buyer_snapshot ?? {}) as Record<string, unknown>;
  const seller = (receipt?.seller_snapshot ?? {}) as Record<string, unknown>;
  const motorcycle = (receipt?.motorcycle_snapshot ?? {}) as Record<string, unknown>;
  const location = getString(negotiation.location);
  const locationMatch = location?.match(/^\s*(.+?)\s*\/\s*([A-Za-z]{2})\s*$/);

  return {
    receipt: {
      id: receipt?.id,
      code: receipt?.code,
      status: receipt?.status,
      version: receipt?.version,
      motorcycle_id: receipt?.motorcycle_id,
      seller_id: maskUserId(getString(receipt?.seller_id)),
      buyer_id: maskUserId(getString(receipt?.buyer_id)),
      external_buyer: receipt?.external_buyer,
      has_pdf_path: Boolean(receipt?.pdf_path),
      has_original_pdf_path: Boolean(receipt?.original_pdf_path),
      has_sha256: Boolean(receipt?.sha256),
    },
    location: {
      raw: location,
      city_name: locationMatch?.[1] ?? null,
      state_code: locationMatch?.[2]?.toUpperCase() ?? null,
      ibge_code: null,
      legacy_negotiation_location: location,
    },
    negotiation: {
      amount: negotiation.amount,
      payment_method: negotiation.payment_method,
      date: negotiation.date,
      has_notes: Boolean(negotiation.notes),
      lgpd_consent_at: Boolean(negotiation.lgpd_consent_at),
    },
    buyer: {
      has_full_name: Boolean(buyer.full_name),
      email: maskEmail(buyer.email),
      cpf: maskCpf(buyer.cpf),
      uf: getString(buyer.uf) ?? getString(buyer.state_code),
      city: getString(buyer.city) ?? getString(buyer.city_name),
      phone: maskPhone(buyer.phone),
      whatsapp: maskPhone(buyer.whatsapp),
      nullish_fields: ["full_name", "cpf", "email", "uf", "city", "phone", "whatsapp"]
        .filter((key) => buyer[key] == null),
    },
    seller: {
      has_full_name: Boolean(seller.full_name),
      email: maskEmail(seller.email),
      cpf: maskCpf(seller.cpf),
    },
    motorcycle: {
      has_brand: Boolean(motorcycle.brand),
      has_model: Boolean(motorcycle.model),
      year_model: motorcycle.year_model,
      has_chassis: Boolean(motorcycle.chassis),
      has_plate: Boolean(motorcycle.plate),
      has_hours_total: motorcycle.hours_total != null,
      has_km_total: motorcycle.km_total != null,
    },
  };
}

export function errorDiagnostics(error: unknown) {
  if (error instanceof Error) {
    const stack = error.stack ?? null;
    const firstFrame = stack?.split("\n").find((line) => /:\d+:\d+\)?$/.test(line.trim()))?.trim() ?? null;
    return {
      name: error.name,
      message: error.message,
      stack,
      first_frame: firstFrame,
    };
  }
  return { name: typeof error, message: String(error), stack: null, first_frame: null };
}