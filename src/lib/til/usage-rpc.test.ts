import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execFileSync, execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { computeStatuses, computeNextMaintenance } from "./schedule";
import { computeNextAlert } from "./alerts";
import type { Moto, Schedule } from "./types";
const uid = "00000000-0000-4000-8000-000000000003", mid = "00000000-0000-4000-8000-000000000002";
function sql(q: string, db = "trailbook_usage_test") {
  return execFileSync("psql", ["-h","127.0.0.1","-p","55432","-U","lovable","-d",db,"-X","-qAt","-v","ON_ERROR_STOP=1","-c",q], {encoding:"utf8", env:{PATH:process.env.PATH,PGSSLMODE:"disable"},stdio:["pipe","pipe","pipe"]}).trim();
}
const asUser = (q: string, user = uid) => sql(`SET ROLE authenticated; SET request.jwt.claim.sub='${user}'; ${q}`);
const register = (reading = 13, date = "current_date", key = "00000000-0000-4000-8000-000000000009", place = "") => asUser(`SELECT row_to_json(r) FROM public.commit_usage_reading('${mid}',${date},${reading},'${place}','${key}') r;`);
beforeAll(() => {
  execFileSync("python3", ["scripts/security/start-isolated-postgres.py"], {stdio:"pipe"});
  if (sql("SELECT count(*) FROM pg_database WHERE datname='trailbook_usage_test'", "postgres") === "0") sql("CREATE DATABASE trailbook_usage_test", "postgres");
  sql(`DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT USAGE ON SCHEMA public TO PUBLIC;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO PUBLIC;
    DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; END $$;
    CREATE TABLE profiles(id uuid PRIMARY KEY, home_shortcuts text[]);
    GRANT SELECT,UPDATE ON profiles TO authenticated;
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_profile ON profiles TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
    CREATE TYPE event_type AS ENUM ('usage','maintenance');
    CREATE TABLE motorcycles(id uuid PRIMARY KEY, owner_id uuid, status text, control_type text, hours_initial numeric, km_initial numeric, hours_total numeric, km_total numeric, created_at timestamptz DEFAULT now()-interval '10 days');
    CREATE TABLE events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), motorcycle_id uuid, created_by uuid, type event_type, occurred_at timestamptz, created_at timestamptz DEFAULT now(), title text, description text, location text, hours_delta numeric, km_delta numeric, hours_at_event numeric, km_at_event numeric, cost numeric, workshop_id uuid, metadata jsonb);
    CREATE TABLE maintenance_items(event_id uuid, schedule_id uuid);
    CREATE TABLE maintenance_schedules(id uuid, motorcycle_id uuid, last_done_at timestamptz, last_done_hours numeric, last_done_km numeric, last_completed_event_id uuid);
    CREATE FUNCTION is_moto_owner(m uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT FROM motorcycles WHERE id=m AND owner_id=auth.uid()) $$;
    CREATE FUNCTION is_user_admin(u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;`);
  const official = readFileSync("supabase/migrations/20260722172504_9c21fba2-d019-4eea-8c4d-072f80c90918.sql","utf8");
  sql(official.slice(0, official.indexOf("CREATE OR REPLACE FUNCTION public.update_event_and_recompose")));
  sql(readFileSync("docs/security/migrations/20261010041000_register_usage.sql","utf8"));
});
beforeEach(() => {
  sql(`TRUNCATE profiles, motorcycles, events, maintenance_schedules, maintenance_items;
    INSERT INTO profiles(id) VALUES('${uid}');
    INSERT INTO motorcycles(id,owner_id,status,control_type,hours_initial,km_initial,hours_total,km_total) VALUES('${mid}','${uid}','active','hours',10,10000,10,10000);`);
});
describe("usage RPC and initial preferences — isolated PostgreSQL", () => {
  it("serializes competing accumulated readings", async () => {
    function submit() { return new Promise<boolean>(resolve => execFile("psql", ["-h","127.0.0.1","-p","55432","-U","lovable","-d","trailbook_usage_test","-X","-qAt","-v","ON_ERROR_STOP=1","-c",`SET ROLE authenticated; SET request.jwt.claim.sub='${uid}'; SELECT * FROM commit_usage_reading('${mid}',current_date,13,'',gen_random_uuid());`], {env:{PATH:process.env.PATH,PGSSLMODE:"disable"}}, error => resolve(!error))); }
    const outcomes = await Promise.all([submit(),submit()]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    expect(sql("SELECT count(*) FROM events")).toBe("1");
    expect(sql("SELECT hours_total FROM motorcycles")).toBe("13");
  });
  it("updates official TIL maintenance and alerts from the persisted reading", () => {
    const before = JSON.parse(sql("SELECT row_to_json(m) FROM motorcycles m")) as Moto;
    const schedule = { id:"synthetic-oil", name:"Synthetic Oil", category:"engine", active:true, status:"active", interval_hours:3, last_done_hours:10 } as Schedule;
    expect(computeStatuses(before,[schedule],[])[0].status).toBe("ok");
    register();
    const after = JSON.parse(sql("SELECT row_to_json(m) FROM motorcycles m")) as Moto;
    const statuses = computeStatuses(after,[schedule],[]);
    expect(statuses[0].status).toBe("overdue");
    expect(statuses[0].remaining.hours).toBe(0);
    expect(computeNextMaintenance(statuses)?.scheduleId).toBe("synthetic-oil");
    expect(computeNextAlert(statuses)?.tone).toBe("bad");
  });
  it("does not rewrite a prior maintenance snapshot", () => {
    const eid="00000000-0000-4000-8000-000000000020", sid="00000000-0000-4000-8000-000000000021";
    sql(`INSERT INTO events(id,motorcycle_id,created_by,type,occurred_at,title,hours_delta,hours_at_event,km_at_event) VALUES('${eid}','${mid}','${uid}','maintenance',now()-interval '1 day','Synthetic maintenance',0,10,10000);
      INSERT INTO maintenance_schedules(id,motorcycle_id,last_done_hours,last_done_km,last_done_at,last_completed_event_id) VALUES('${sid}','${mid}',10,10000,now()-interval '1 day','${eid}'); INSERT INTO maintenance_items VALUES('${eid}','${sid}');`);
    register();
    expect(sql(`SELECT hours_at_event FROM events WHERE id='${eid}'`)).toBe("10");
    expect(sql(`SELECT last_done_hours FROM maintenance_schedules WHERE id='${sid}'`)).toBe("10");
  });
  it("rejects excessive precision server-side", () => expect(() => register(13.501)).toThrow());
  it("rejects fractional km server-side", () => {sql("UPDATE motorcycles SET control_type='km'"); expect(() => register(12500.5)).toThrow();});
  it("rejects archived motorcycles", () => {sql("UPDATE motorcycles SET status='archived'"); expect(() => register()).toThrow();});
  it("initializes defaults once", () => { expect(asUser("SELECT initialize_usage_shortcut()" )).toBe("{registrar-uso,passaporte,documentos,recibo,selos,saude,manutencoes,cockpit}"); expect(asUser("SELECT initialize_usage_shortcut()" )).toBe("{registrar-uso,passaporte,documentos,recibo,selos,saude,manutencoes,cockpit}"); });
  it("preserves personalized order", () => { sql(`UPDATE profiles SET home_shortcuts=ARRAY['agenda','cockpit']`); expect(asUser("SELECT initialize_usage_shortcut()")).toBe("{registrar-uso,agenda,cockpit}"); });
  it("preserves nine existing shortcuts", () => { sql(`UPDATE profiles SET home_shortcuts=ARRAY['passaporte','documentos','recibo','selos','saude','manutencoes','cockpit','agenda','financeiro']`); expect(asUser("SELECT cardinality(initialize_usage_shortcut())")).toBe("10"); });
  it("does not duplicate usage", () => { sql(`UPDATE profiles SET home_shortcuts=ARRAY['cockpit','registrar-uso','registrar-uso']`); expect(asUser("SELECT initialize_usage_shortcut()")).toBe("{registrar-uso,cockpit}"); });
  it("respects removal in a new session", () => { asUser("SELECT initialize_usage_shortcut()"); asUser("UPDATE profiles SET home_shortcuts=ARRAY[]::text[]"); expect(asUser("SELECT initialize_usage_shortcut()")).toBe("{}"); });
  it("respects reordering in a new session", () => { asUser("SELECT initialize_usage_shortcut()"); asUser("UPDATE profiles SET home_shortcuts=ARRAY['cockpit','registrar-uso']"); expect(asUser("SELECT initialize_usage_shortcut()")).toBe("{cockpit,registrar-uso}"); });
  it("records 13h as total and 3h delta", () => { const r=JSON.parse(register()); expect(r.hours_total).toBe(13); expect(sql("SELECT hours_delta FROM events")).toBe("3"); });
  it("records km using the official total", () => { sql("UPDATE motorcycles SET control_type='km'"); expect(JSON.parse(register(12500)).km_total).toBe(12500); expect(sql("SELECT km_delta FROM events")).toBe("2500"); });
  it("stores optional location", () => { register(13,"current_date",undefined,"Trilha sintética"); expect(sql("SELECT location FROM events")).toBe("Trilha sintética"); });
  it("permits empty location", () => { register(); expect(sql("SELECT location IS NULL FROM events")).toBe("t"); });
  it("idempotent retry creates only one activity", () => { register(); register(); expect(sql("SELECT count(*) FROM events")).toBe("1"); });
  it("rejects a duplicate reading with a new request", () => { register(); expect(() => register(13,"current_date","00000000-0000-4000-8000-000000000010")).toThrow(); });
  it("rejects a reading below current", () => expect(() => register(9)).toThrow());
  it("rejects negative values", () => expect(() => register(-1)).toThrow());
  it("rejects future dates without writes", () => { expect(() => register(13,"current_date+1")).toThrow(); expect(sql("SELECT count(*) FROM events")).toBe("0"); });
  it("permits retroactive dates after the last reading", () => { expect(JSON.parse(register(13,"current_date-1")).hours_total).toBe(13); });
  it("rejects a retroactive date before the latest reading", () => { register(); expect(() => register(14,"current_date-1","00000000-0000-4000-8000-000000000010")).toThrow(); expect(sql("SELECT count(*) FROM events")).toBe("1"); });
  it("rejects ambiguous measurement", () => { sql("UPDATE motorcycles SET control_type='both'"); expect(() => register()).toThrow(); });
  it("denies other owners", () => expect(() => asUser(`SELECT * FROM commit_usage_reading('${mid}',current_date,13,'',gen_random_uuid())`,"00000000-0000-4000-8000-000000000099")).toThrow());
  it("denies anonymous calls", () => expect(() => sql(`SET ROLE anon; SELECT * FROM commit_usage_reading('${mid}',current_date,13,'',gen_random_uuid())`)).toThrow());
  it("rolls back event and totals on failure", () => { sql(`CREATE FUNCTION test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$; CREATE TRIGGER synthetic_failure BEFORE UPDATE ON motorcycles FOR EACH ROW EXECUTE FUNCTION test_fail();`); try { expect(() => register()).toThrow(); expect(sql("SELECT count(*) FROM events")).toBe("0"); expect(sql("SELECT hours_total FROM motorcycles")).toBe("10"); } finally {sql("DROP TRIGGER synthetic_failure ON motorcycles; DROP FUNCTION test_fail()");} });
});