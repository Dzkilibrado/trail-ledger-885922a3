import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ambiente Permanente de Homologação (APH)
 * -----------------------------------------
 * Server functions administrativas para criar/atualizar/limpar o ambiente
 * de homologação do TrailBook.
 *
 * Convenções:
 *  - Contas: e-mails @homolog.trailbook.test, sempre `is_homologation = true`.
 *  - Motos: prefixo "[HOMOLOG] " no nickname, `is_homologation = true`.
 *  - Idempotente: reexecutar não duplica. Reset apaga apenas dados de homologação.
 */

const HOMOLOG_DOMAIN = "homolog.trailbook.test";

type SeedUser = {
  key: "A" | "B" | "C" | "D" | "E";
  email: string;
  full_name: string;
  role: string;
  plan: "free" | "premium" | "workshop";
};

const SEED_USERS: SeedUser[] = [
  { key: "A", email: `vendedor.a@${HOMOLOG_DOMAIN}`, full_name: "[HOMOLOG] Vendedor A", role: "Vendedor TrailBook", plan: "premium" },
  { key: "B", email: `comprador.b@${HOMOLOG_DOMAIN}`, full_name: "[HOMOLOG] Comprador B", role: "Comprador TrailBook", plan: "premium" },
  { key: "C", email: `externo.c@${HOMOLOG_DOMAIN}`, full_name: "[HOMOLOG] Externo C", role: "Comprador externo simulado", plan: "free" },
  { key: "D", email: `frota.d@${HOMOLOG_DOMAIN}`, full_name: "[HOMOLOG] Frota D", role: "Usuário com múltiplas motos", plan: "premium" },
  { key: "E", email: `novo.e@${HOMOLOG_DOMAIN}`, full_name: "[HOMOLOG] Novo E", role: "Usuário novo (onboarding)", plan: "free" },
];

type SeedMoto = {
  slug: string;
  ownerKey: SeedUser["key"];
  brand: string;
  model: string;
  year_model: number;
  nickname: string;
  status: "active" | "archived";
  km_total?: number;
  hours_total?: number;
  condition: "new" | "used";
  scenario: string;
};

const SEED_MOTOS: SeedMoto[] = [
  { slug: "M1",  ownerKey: "A", brand: "Honda", model: "XR 250 Tornado", year_model: 2024, nickname: "[HOMOLOG] M1 · Moto nova",              status: "active",   km_total: 120,    condition: "new",  scenario: "Nova, sem histórico" },
  { slug: "M2",  ownerKey: "A", brand: "Yamaha", model: "Lander 250",   year_model: 2020, nickname: "[HOMOLOG] M2 · Histórico completo",      status: "active",   km_total: 38400,  condition: "used", scenario: "Manutenções + docs + certificado" },
  { slug: "M3",  ownerKey: "A", brand: "Honda", model: "NXR 160 Bros",  year_model: 2019, nickname: "[HOMOLOG] M3 · Arquivada",               status: "archived", km_total: 54000,  condition: "used", scenario: "Já transferida (externo)" },
  { slug: "M4",  ownerKey: "A", brand: "Honda", model: "CRF 250F",      year_model: 2022, nickname: "[HOMOLOG] M4 · Pendências",              status: "active",   hours_total: 210, condition: "used", scenario: "Sem documento de origem" },
  { slug: "M5",  ownerKey: "D", brand: "KTM", model: "350 EXC-F",       year_model: 2018, nickname: "[HOMOLOG] M5 · Múltiplos proprietários", status: "active",   hours_total: 480, condition: "used", scenario: "3 entradas em ownership_history" },
  { slug: "M6",  ownerKey: "A", brand: "Yamaha", model: "WR 250F",      year_model: 2021, nickname: "[HOMOLOG] M6 · Em negociação",           status: "active",   hours_total: 150, condition: "used", scenario: "Receipt awaiting_acceptance" },
  { slug: "M7",  ownerKey: "B", brand: "Honda", model: "CRF 450X",      year_model: 2017, nickname: "[HOMOLOG] M7 · Venda concluída",         status: "active",   hours_total: 610, condition: "used", scenario: "Receipt completed (histórico)" },
  { slug: "M8",  ownerKey: "D", brand: "Kawasaki", model: "KLX 300",    year_model: 2016, nickname: "[HOMOLOG] M8 · Manutenção vencida",      status: "active",   km_total: 71200,  condition: "used", scenario: "Plano vencido" },
  { slug: "M9",  ownerKey: "D", brand: "Sherco", model: "300 SE Factory", year_model: 2025, nickname: "[HOMOLOG] M9 · Recém cadastrada",      status: "active",   hours_total: 3,   condition: "new",  scenario: "Cadastro recente" },
  { slug: "M10", ownerKey: "D", brand: "GasGas", model: "EC 300",       year_model: 2015, nickname: "[HOMOLOG] M10 · Crítica",                status: "active",   hours_total: 980, condition: "used", scenario: "Muitas pendências + timeline densa" },
];

function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let out = "Hg1!";
  for (let i = 0; i < 24; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function randomChassis(seed: string): string {
  // "HOMOLOG" + 10 dígitos, não colide com VIN real (17)
  const digits = Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0).toString().padStart(10, "0").slice(-10);
  return `HOMOLOG${digits}`;
}

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_user_admin", { _user_id: context.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden — apenas administradores podem operar o Ambiente de Homologação");
}

export const seedHomologEnvironment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const report: {
      users: Array<{ key: string; email: string; user_id: string; created: boolean }>;
      motorcycles: Array<{ slug: string; id: string; owner_key: string; created: boolean; scenario: string }>;
      warnings: string[];
    } = { users: [], motorcycles: [], warnings: [] };

    // 1) Usuários — listUsers para buscar por email (idempotente)
    // Nota: a Auth Admin API não expõe getUserByEmail; usamos listUsers paginado.
    const emailToUser = new Map<string, string>();
    let page = 1;
    while (page < 20) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(`listUsers: ${error.message}`);
      for (const u of data.users) if (u.email) emailToUser.set(u.email.toLowerCase(), u.id);
      if (data.users.length < 200) break;
      page++;
    }

    const keyToId: Record<string, string> = {};
    for (const u of SEED_USERS) {
      const existing = emailToUser.get(u.email);
      let userId = existing;
      let created = false;
      if (!userId) {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: u.email,
          password: randomPassword(),
          email_confirm: true,
          user_metadata: { full_name: u.full_name, homolog: true, role: u.role },
        });
        if (error) throw new Error(`createUser ${u.email}: ${error.message}`);
        userId = data.user!.id;
        created = true;
      }
      keyToId[u.key] = userId!;

      // Perfil: garantir flag + nome + plano
      const { error: pErr } = await supabaseAdmin
        .from("profiles")
        .update({ full_name: u.full_name, is_homologation: true, plan: u.plan, status: "active" })
        .eq("id", userId!);
      if (pErr) report.warnings.push(`profile update ${u.email}: ${pErr.message}`);

      report.users.push({ key: u.key, email: u.email, user_id: userId!, created });
    }

    // 2) Motos — busca por (owner_id + nickname prefixado) para idempotência
    for (const m of SEED_MOTOS) {
      const ownerId = keyToId[m.ownerKey];
      const { data: existing } = await supabaseAdmin
        .from("motorcycles")
        .select("id")
        .eq("owner_id", ownerId)
        .eq("nickname", m.nickname)
        .maybeSingle();

      let id = existing?.id as string | undefined;
      let created = false;
      if (!id) {
        const { data, error } = await supabaseAdmin
          .from("motorcycles")
          .insert({
            owner_id: ownerId,
            nickname: m.nickname,
            brand: m.brand,
            model: m.model,
            year_model: m.year_model,
            year_make: m.year_model,
            chassis: randomChassis(m.slug + m.nickname),
            plate: `HOM${m.slug.padStart(4, "0")}`.slice(0, 8),
            control_type: m.km_total ? "km" : "hours",
            km_total: m.km_total ?? 0,
            hours_total: m.hours_total ?? 0,
            condition: m.condition,
            status: m.status,
            is_homologation: true,
          } as never)
          .select("id")
          .single();
        if (error) throw new Error(`insert moto ${m.slug}: ${error.message}`);
        id = data.id;
        created = true;
      }
      report.motorcycles.push({ slug: m.slug, id: id!, owner_key: m.ownerKey, created, scenario: m.scenario });
    }

    return { ok: true as const, report };
  });

export const resetHomologEnvironment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { confirmation: string }) => {
    if (data?.confirmation !== "RESETAR HOMOLOG") throw new Error("Confirmação inválida. Digite exatamente: RESETAR HOMOLOG");
    return data;
  })
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Apaga TODAS as motos de homologação. Cascade limpa dependências (events, docs, receipts, etc.)
    const { data: motos, error: mErr } = await supabaseAdmin
      .from("motorcycles")
      .select("id")
      .eq("is_homologation", true);
    if (mErr) throw new Error(mErr.message);
    let deletedMotos = 0;
    if (motos && motos.length > 0) {
      const ids = motos.map((r) => r.id);
      const { error } = await supabaseAdmin.from("motorcycles").delete().in("id", ids);
      if (error) throw new Error(`delete motos: ${error.message}`);
      deletedMotos = ids.length;
    }
    // Nota: as CONTAS de homologação são preservadas (podem ser reutilizadas em novo seed).
    return { ok: true as const, deleted_motos: deletedMotos };
  });

export const listHomologSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: users } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, plan, status")
      .eq("is_homologation", true)
      .order("email", { ascending: true });

    const { data: motos } = await supabaseAdmin
      .from("motorcycles")
      .select("id, nickname, brand, model, year_model, status, owner_id, km_total, hours_total")
      .eq("is_homologation", true)
      .order("nickname", { ascending: true });

    return {
      users: users ?? [],
      motorcycles: motos ?? [],
    };
  });