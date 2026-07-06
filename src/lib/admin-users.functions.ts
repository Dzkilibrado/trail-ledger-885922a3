import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sends the standard "reset password" e-mail using the platform recovery flow.
 * Also records an admin_user_events row for auditability.
 */
export const adminSendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data as { userId: string })
  .handler(async ({ data, context }) => {
    // Admin check
    const { data: isAdmin, error: eAdmin } = await context.supabase.rpc(
      "is_user_admin" as any,
      { _user_id: context.userId },
    );
    if (eAdmin) throw new Error(eAdmin.message);
    if (isAdmin !== true) throw new Error("Forbidden");

    const { data: profile, error: ep } = await context.supabase
      .from("profiles")
      .select("email")
      .eq("id", data.userId)
      .maybeSingle();
    if (ep) throw new Error(ep.message);
    if (!profile?.email) throw new Error("Usuário sem e-mail cadastrado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const origin = process.env.APP_URL || process.env.PUBLIC_APP_URL || "https://trailbook.com.br";
    const redirectTo = `${origin.replace(/\/$/, "")}/reset-password`;

    const { data: linkData, error: eLink } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: profile.email,
      options: { redirectTo },
    });
    if (eLink) throw new Error(eLink.message);

    // Log audit + emit internal message (email may be disabled → falls back to simulated delivery inside emit_system_message)
    await supabaseAdmin.from("admin_user_events").insert({
      actor_id: context.userId,
      target_user_id: data.userId,
      action: "password_reset_link_sent",
      metadata: {
        email: profile.email,
        action_link_generated: !!linkData?.properties?.action_link,
      } as any,
    });

    await supabaseAdmin.rpc("emit_system_message" as any, {
      _user: data.userId,
      _type: "auth",
      _subject_key: "password_recovery",
      _subject_other: null,
      _body:
        "Foi enviado a você um link para redefinir sua senha. Se não solicitou, ignore esta mensagem.",
      _priority: "high",
    });

    return { ok: true };
  });

/**
 * Physically deletes a HOMOLOGATION motorcycle and all related rows (FKs
 * cascade), plus best-effort removal of files in Storage. Requires an admin
 * caller and a motorcycle explicitly marked as `is_homologation = true`.
 */
export const adminDeleteHomologMotorcycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: unknown) => data as { motorcycleId: string; reason: string; confirmation: string },
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: eAdmin } = await context.supabase.rpc(
      "is_user_admin" as any,
      { _user_id: context.userId },
    );
    if (eAdmin) throw new Error(eAdmin.message);
    if (isAdmin !== true) throw new Error("Forbidden");

    // Validate + snapshot + retire trailbook_id (throws on any rule violation)
    const { data: snapshot, error: ePrep } = await context.supabase.rpc(
      "admin_prepare_homolog_moto_deletion" as any,
      { _moto: data.motorcycleId, _reason: data.reason, _confirmation: data.confirmation },
    );
    if (ePrep) throw new Error(ePrep.message);

    const paths = (snapshot as any)?.storage_paths ?? {};
    const groups: Array<{ bucket: string; path: string }> = [
      ...((paths.documents as any[]) ?? []),
      ...((paths.photos as any[]) ?? []),
      ...((paths.event_attachments as any[]) ?? []),
    ].filter((r) => r && r.bucket && r.path);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const byBucket = new Map<string, string[]>();
    for (const r of groups) {
      const list = byBucket.get(r.bucket) ?? [];
      list.push(r.path);
      byBucket.set(r.bucket, list);
    }

    const removed: string[] = [];
    const missing: string[] = [];
    for (const [bucket, list] of byBucket) {
      // best-effort — never break the transaction on storage errors
      try {
        const { data: rem, error } = await supabaseAdmin.storage.from(bucket).remove(list);
        if (error) {
          missing.push(...list.map((p) => `${bucket}/${p}`));
        } else {
          removed.push(...(rem ?? []).map((f: any) => `${bucket}/${f.name ?? f.path ?? ""}`));
          const removedSet = new Set((rem ?? []).map((f: any) => f.name ?? f.path));
          for (const p of list) if (!removedSet.has(p)) missing.push(`${bucket}/${p}`);
        }
      } catch {
        missing.push(...list.map((p) => `${bucket}/${p}`));
      }
    }

    const storageReport = {
      removed_count: removed.length,
      missing_count: missing.length,
      removed,
      missing,
    };

    const { data: result, error: eDel } = await context.supabase.rpc(
      "admin_execute_homolog_moto_deletion" as any,
      { _moto: data.motorcycleId, _reason: data.reason, _storage_report: storageReport as any },
    );
    if (eDel) throw new Error(eDel.message);

    return { ok: true, storage: storageReport, result };
  });

/**
 * Physically deletes a HOMOLOGATION user. Requires admin_prepare_homolog_deletion
 * to have been called (which validates and stores a snapshot).
 */
export const adminDeleteHomologUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: unknown) => data as { userId: string; reason: string; confirmation: string },
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: eAdmin } = await context.supabase.rpc(
      "is_user_admin" as any,
      { _user_id: context.userId },
    );
    if (eAdmin) throw new Error(eAdmin.message);
    if (isAdmin !== true) throw new Error("Forbidden");

    // Validate + snapshot (throws on any rule violation)
    const { error: ePrep } = await context.supabase.rpc(
      "admin_prepare_homolog_deletion" as any,
      { _user: data.userId, _reason: data.reason, _confirmation: data.confirmation },
    );
    if (ePrep) throw new Error(ePrep.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Nullify FK references that don't cascade/SET NULL automatically so
    // auth.admin.deleteUser doesn't fail with a foreign key violation.
    // These columns are created_by-style audit fields — safe to null out.
    await supabaseAdmin
      .from("maintenance_inspections")
      .update({ created_by: null })
      .eq("created_by", data.userId);
    await supabaseAdmin
      .from("motorcycle_documents")
      .update({ created_by: null })
      .eq("created_by", data.userId);
    await supabaseAdmin
      .from("motorcycle_photos")
      .update({ created_by: null })
      .eq("created_by", data.userId);

    // Delete the auth user. Application tables reference auth.users via ON DELETE
    // CASCADE on public.profiles (id), so cascading removes user-owned data.
    const { error: eDel } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (eDel) {
      const msg =
        (eDel as any)?.message ||
        (typeof eDel === "string" ? eDel : "") ||
        JSON.stringify(eDel) ||
        "Falha ao excluir usuário no provedor de autenticação";
      throw new Error(msg);
    }

    await supabaseAdmin.from("admin_user_events").insert({
      actor_id: context.userId,
      target_user_id: data.userId,
      action: "homolog_user_deleted",
      reason: data.reason,
      metadata: { confirmation: data.confirmation } as any,
    });

    return { ok: true };
  });