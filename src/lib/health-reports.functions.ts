import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { snapshotHash } from "@/lib/health-reports/snapshot";
import { sanitizePublicSnapshot } from "@/lib/health-reports/public-payload";
import type { HealthReportSnapshot, ReportSection } from "@/lib/health-reports/types";

/** Abre um Check-up (run). O run é a chave de idempotência da emissão. */
export const startCheckRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { motorcycleId: string }) => ({ motorcycleId: String(data.motorcycleId) }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("health_check_runs")
      .insert({ motorcycle_id: data.motorcycleId, user_id: context.userId, status: "started" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { runId: row.id as string };
  });

/** Atualiza o andamento do Check-up (processando, bloqueado, prévia, falha). */
export const updateCheckRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      runId: string;
      status: "collecting" | "processing" | "previewed" | "blocked" | "failed";
      blockers?: unknown;
      warnings?: unknown;
      error?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("health_check_runs")
      .update({
        status: data.status,
        blockers: (data.blockers ?? []) as never,
        warnings: (data.warnings ?? []) as never,
        error: data.error ?? null,
      })
      .eq("id", data.runId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Emissão do Laudo Inteligente.
 * Idempotente por `runId` (índice único) e com hash recalculado no servidor.
 */
export const issueHealthReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      runId: string;
      motorcycleId: string;
      snapshot: HealthReportSnapshot;
      confidenceLevel: string;
      reservations: string[];
      validity: { validUntil: string | null; hoursLimit: number | null; kmLimit: number | null; reason: string };
      accepted: boolean;
    }) => {
      if (!data.accepted) throw new Error("É necessário confirmar a declaração antes de emitir o laudo.");
      if (!data.snapshot) throw new Error("Análise indisponível para emissão.");
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    const existing = await sb
      .from("health_reports")
      .select("id, code, issued_at, valid_until, snapshot_sha256, status")
      .eq("run_id", data.runId)
      .maybeSingle();
    if (existing.data) return { report: existing.data, reused: true as const };

    const moto = await sb
      .from("motorcycles")
      .select("id, owner_id, hours_total, km_total")
      .eq("id", data.motorcycleId)
      .single();
    if (moto.error || !moto.data) throw new Error("Motocicleta não encontrada ou sem permissão.");

    const s = data.snapshot;
    const sha = await snapshotHash(s);
    const counts = s.rideAnswer.counts;

    const insert = await sb
      .from("health_reports")
      .insert({
        motorcycle_id: data.motorcycleId,
        owner_id: moto.data.owner_id as string,
        issued_by: context.userId,
        run_id: data.runId,
        issued_at: s.issuedAt,
        timezone: s.timezone,
        format_version: s.formatVersion,
        til_version: s.tilVersion,
        rule_version: s.ruleVersion,
        snapshot_sha256: sha,
        overall_status: s.overall.status,
        conservation_index: s.indices.conservation,
        confidence_level: data.confidenceLevel,
        critical_count: counts.critical,
        attention_count: counts.attention,
        ok_count: counts.ok,
        unknown_count: counts.unknown,
        hours_at_issue: Number(moto.data.hours_total ?? 0),
        km_at_issue: Number(moto.data.km_total ?? 0),
        has_reservations: data.reservations.length > 0,
        reservations: data.reservations as never,
        valid_until: data.validity.validUntil,
        valid_hours_limit: data.validity.hoursLimit,
        valid_km_limit: data.validity.kmLimit,
        validity_reason: data.validity.reason,
        status: "valid",
      })
      .select("id, code, issued_at, valid_until, snapshot_sha256, status")
      .single();

    if (insert.error) {
      // Corrida de clique duplo: o índice único do run devolve o laudo já emitido.
      const retry = await sb
        .from("health_reports")
        .select("id, code, issued_at, valid_until, snapshot_sha256, status")
        .eq("run_id", data.runId)
        .maybeSingle();
      if (retry.data) return { report: retry.data, reused: true as const };
      throw new Error(insert.error.message);
    }

    const reportId = insert.data.id as string;

    const snapIns = await sb
      .from("health_report_snapshots")
      .insert({ report_id: reportId, payload: s as never, sha256: sha, format_version: s.formatVersion });
    if (snapIns.error) throw new Error(snapIns.error.message);

    if (s.components.length) {
      await sb.from("health_report_components").insert(
        s.components.map((c) => ({
          report_id: reportId,
          schedule_id: c.scheduleId || null,
          name: c.name,
          category: c.category,
          status: c.status,
          severity: c.severity,
          conclusion: c.conclusion,
          reasons: c.reasons as never,
          trend: c.trend,
          next_action: c.nextAction,
          confidence_level: c.confidenceLevel,
          missing_data: c.missingData as never,
          remaining_label: c.remainingLabel,
          is_safety_item: c.isSafetyItem,
        })),
      );
    }
    if (s.recommendations.length) {
      await sb.from("health_report_recommendations").insert(
        s.recommendations.map((r) => ({
          report_id: reportId,
          schedule_id: r.scheduleId || null,
          action_group: r.group,
          title: r.title,
          recommendation: r.recommendation,
          status_at_issue: r.status,
          lifecycle_at_issue: r.lifecycle,
          due_estimate_label: r.dueEstimateLabel,
          is_safety_item: r.isSafetyItem,
        })),
      );
    }

    await sb
      .from("health_check_runs")
      .update({ status: "emitted", completed_at: new Date().toISOString() })
      .eq("id", data.runId);

    return { report: insert.data, reused: false as const };
  });

/** Leitura pública do laudo compartilhado — sanitizada e registrada. */
export const getPublicHealthReport = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => ({ token: String(data?.token ?? "").trim() }))
  .handler(async ({ data }) => {
    if (!data.token || data.token.length < 16) return { ok: false as const, reason: "not_found" };
    const supabase = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: json, error } = await supabase.rpc("get_public_health_report" as never, {
      _token: data.token,
    } as never);
    if (error) throw new Error(error.message);
    const res = json as Record<string, unknown> | null;
    if (!res || res.ok !== true) {
      await supabase.rpc("log_health_report_access" as never, {
        _token: data.token,
        _result: String((res?.reason as string) ?? "denied"),
      } as never);
      return { ok: false as const, reason: String((res?.reason as string) ?? "not_found") };
    }
    await supabase.rpc("log_health_report_access" as never, { _token: data.token, _result: "ok" } as never);

    const allowed = (res.allowed_sections as ReportSection[]) ?? [];
    const snapshot = sanitizePublicSnapshot(res.snapshot as HealthReportSnapshot, allowed);
    return {
      ok: true as const,
      code: String(res.code ?? ""),
      status: String(res.status ?? ""),
      issuedAt: String(res.issued_at ?? ""),
      validUntil: (res.valid_until as string | null) ?? null,
      outdatedReason: (res.outdated_reason as string | null) ?? null,
      sha256: String(res.sha256 ?? ""),
      preset: String(res.preset ?? "custom"),
      allowedSections: allowed,
      snapshot,
    };
  });

/** Validação pública por código (QR / conferência) — não expõe conteúdo. */
export const validateHealthReportPublic = createServerFn({ method: "GET" })
  .inputValidator((data: { code: string }) => ({ code: String(data?.code ?? "").trim().toUpperCase() }))
  .handler(async ({ data }) => {
    const supabase = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: json, error } = await supabase.rpc("validate_health_report" as never, {
      _code: data.code,
    } as never);
    if (error) throw new Error(error.message);
    const res = (json ?? {}) as {
      ok?: boolean;
      status?: string;
      issued_at?: string;
      valid_until?: string | null;
      motorcycle?: string;
    };
    return {
      ok: res.ok === true,
      status: String(res.status ?? "not_found"),
      issuedAt: res.issued_at ?? null,
      validUntil: res.valid_until ?? null,
      motorcycle: res.motorcycle ?? null,
    };
  });