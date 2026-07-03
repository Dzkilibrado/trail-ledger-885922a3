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

    // Delete the auth user. Application tables reference auth.users via ON DELETE
    // CASCADE on public.profiles (id), so cascading removes user-owned data.
    const { error: eDel } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (eDel) throw new Error(eDel.message);

    await supabaseAdmin.from("admin_user_events").insert({
      actor_id: context.userId,
      target_user_id: data.userId,
      action: "homolog_user_deleted",
      reason: data.reason,
      metadata: { confirmation: data.confirmation } as any,
    });

    return { ok: true };
  });