import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import policy from './public-policy.json';
import { sanitizePublicSnapshot, sanitizeFiscal, publicSections } from './public-payload';
import { buildFiscalPdf } from './fiscal-pdf';
import { ReportSnapshotView } from '@/components/health/reports/ReportSnapshotView';

// Explicit host/user/db: NEVER inherits a managed Cloud connection.
function sql(query: string) {
  return execFileSync('psql', ['-h','127.0.0.1','-p','55432','-U','lovable','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1','-c',query], {encoding:'utf8'}).trim();
}
const quote = (x: unknown) => `'${JSON.stringify(x).replaceAll("'", "''")}'::jsonb`;
function synth(shape: unknown): any {
  if (Array.isArray(shape)) return [synth(shape[0])];
  if (shape && typeof shape === 'object') return {...Object.fromEntries(Object.entries(shape).map(([k,v])=>[k,synth(v)])), privateExtra:'PRIVATE_SENTINEL'};
  return shape === 'number' ? 1 : shape === 'boolean' ? false : 'synthetic';
}
const snapshot = {...synth(policy), owner:{name:'PRIVATE_SENTINEL'}, issuedBy:{id:'PRIVATE_SENTINEL'}, dataSources:['PRIVATE_SENTINEL'], tilVersion:'PRIVATE_SENTINEL'};
snapshot.motorcycle.id='PRIVATE_SENTINEL'; snapshot.motorcycle.nickname='PRIVATE_SENTINEL'; snapshot.motorcycle.mainPhotoUrl='PRIVATE_SENTINEL';
snapshot.components[0].scheduleId='PRIVATE_SENTINEL'; snapshot.components[0].rulesFired=['PRIVATE_SENTINEL'];
snapshot.history.lastInspections[0].notes='PRIVATE_SENTINEL'; snapshot.history.lastMaintenances[0].title='PRIVATE_SENTINEL';
snapshot.history.incidents[0].title='PRIVATE_SENTINEL';
snapshot.issuedAt='2026-10-10T00:00:00Z'; snapshot.motorcycle.brand='Honda'; snapshot.motorcycle.model='CRF';
const all = ['identification','summary','components','action_plan','history','indices','reservations'];
const rid='00000000-0000-4000-8000-000000000001', mid='00000000-0000-4000-8000-000000000002', uid='00000000-0000-4000-8000-000000000003', did='00000000-0000-4000-8000-000000000004';
function rpc(token='synthetic-buyer', role='anon'): any {
  return JSON.parse(sql(`SET ROLE ${role}; SELECT public.get_public_health_report('${token}'); RESET ROLE;`));
}
function doc(token='synthetic-fiscal', docId=did): any {
  return JSON.parse(sql(`SET ROLE service_role; SELECT public.get_fiscal_document_url('${token}','${docId}'); RESET ROLE;`));
}
let before: string;
beforeAll(() => {
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE outsider;`);
  sql(`CREATE TABLE public.health_reports(id uuid,owner_id uuid,issued_by uuid,motorcycle_id uuid,code text,status text,issued_at timestamptz,valid_until timestamptz,valid_hours_limit numeric,valid_km_limit numeric,outdated_at timestamptz,outdated_reason text,snapshot_sha256 text,format_version text,revoked_at timestamptz);
  CREATE TABLE public.health_report_shares(id uuid,public_token text,report_id uuid,preset text,allowed_sections text[],expires_at timestamptz,revoked_at timestamptz);
  CREATE TABLE public.health_report_snapshots(report_id uuid,payload jsonb,sha256 text);
  CREATE TABLE public.profiles(id uuid,full_name text,cpf text);
  CREATE TABLE public.motorcycle_documents(id uuid,motorcycle_id uuid,doc_type text,file_name text,mime_type text,doc_number text,doc_date date,created_at timestamptz,bucket text,storage_path text);
  ALTER TABLE public.health_report_snapshots ENABLE ROW LEVEL SECURITY;
  GRANT SELECT ON public.health_report_snapshots TO anon,authenticated;
  INSERT INTO public.health_reports(id,owner_id,issued_by,motorcycle_id,code,status,issued_at,snapshot_sha256,format_version) VALUES('${rid}','${uid}','00000000-0000-4000-8000-000000000099','${mid}','TB-SYNTHETIC','valid',now(),'original-hash','1');
  INSERT INTO public.health_report_snapshots VALUES('${rid}',${quote(snapshot)},'original-hash');
  INSERT INTO public.profiles VALUES('${uid}','Synthetic Owner','12345678909');
  INSERT INTO public.motorcycle_documents VALUES('${did}','${mid}','invoice','synthetic.pdf','application/pdf','SYNTHETIC',current_date,now(),'synthetic-bucket','private-synthetic-path');
  INSERT INTO public.health_report_shares(public_token,report_id,preset,allowed_sections,expires_at) VALUES
  ('synthetic-buyer','${rid}','buyer',ARRAY['${all.join("','")}'],NULL),
  ('synthetic-fiscal','${rid}','fiscal',ARRAY['${all.join("','")}'],now()+interval '1 hour'),
  ('expired','${rid}','buyer',ARRAY['summary'],now()-interval '1 second'),
  ('boundary','${rid}','buyer',ARRAY['summary'],now()),
  ('missing-report','00000000-0000-4000-8000-000000000099','buyer',ARRAY['summary'],NULL),
  ('null-sections','${rid}','buyer',NULL,NULL),
  ('unknown-sections','${rid}','buyer',ARRAY['owner','fiscal'],NULL),
  ('fiscal-no-id','${rid}','fiscal',ARRAY['summary'],NULL);
  INSERT INTO public.health_report_shares(public_token,report_id,preset,allowed_sections,revoked_at) VALUES('revoked','${rid}','buyer',ARRAY['summary'],now());`);
  before=sql(`SELECT md5(string_agg(payload::text||sha256,'')) FROM public.health_report_snapshots;`);
  sql(readFileSync('supabase/migrations/20261010030000_health_report_public_privacy.sql','utf8'));
});

describe('Correção 01 — PostgreSQL isolado, RPC direta e defesa adicional', () => {
  it.each(['anon','authenticated'])('token válido diretamente como %s retorna somente campos permitidos', role => {
    const res=rpc('synthetic-buyer',role);
    expect(res.ok).toBe(true); expect(JSON.stringify(res)).not.toContain('PRIVATE_SENTINEL');
    expect(res).not.toHaveProperty('share_id'); expect(res.fiscal).toBeNull();
    expect(res.snapshot).toEqual(sanitizePublicSnapshot(snapshot,all));
  });
  it.each(['','invalid','expired','boundary','revoked','missing-report'])('nega token %s', token => expect(rpc(token).ok).toBe(false));
  it.each(all)('a seção %s é aplicada no banco antes da resposta', section => {
    const response=JSON.parse(sql(`SELECT public.health_public_snapshot(${quote(snapshot)},ARRAY['${section}']);`));
    expect(response).toEqual(sanitizePublicSnapshot(snapshot,[section]));
    expect(Object.keys(response).length).toBeGreaterThan(5);
  });
  it.each(['null-sections','unknown-sections'])('configuração %s não libera seções', token => {
    const res=rpc(token); expect(res.allowed_sections).toEqual([]); expect(res.snapshot).not.toHaveProperty('motorcycle'); expect(res.snapshot).not.toHaveProperty('components');
  });
  it('fiscal ignora tentativa de ampliar allowed_sections e usa o proprietário, não emissor', () => {
    const res=rpc('synthetic-fiscal'); expect(res.allowed_sections).toEqual(['identification','summary']);
    expect(res.snapshot).not.toHaveProperty('history'); expect(res.snapshot).not.toHaveProperty('components'); expect(res.snapshot).not.toHaveProperty('recommendations');
    expect(res.fiscal.owner_name).toBe('Synthetic Owner'); expect(res.fiscal.owner_cpf).toBe('123.456.789-09');
    expect(res.fiscal.origin_doc_id).toBe(did); expect(res.snapshot).not.toHaveProperty('owner');
  });
  it('fiscal sem identificação autorizada não obtém dados pessoais nem documento', () => {
    expect(rpc('fiscal-no-id').fiscal).toBeNull(); expect(doc('fiscal-no-id').ok).toBe(false);
  });
  it.each(['anon','authenticated','outsider'])('papel %s não acessa caminho documental', role => {
    expect(sql(`SELECT has_function_privilege('${role}','public.get_fiscal_document_url(text,uuid)','EXECUTE');`)).toBe('f');
    expect(()=>sql(`SET ROLE ${role}; SELECT public.get_fiscal_document_url('synthetic-fiscal','${did}');`)).toThrow();
  });
  it('PUBLIC não herda acesso e helpers não são RPCs públicas', () => {
    expect(sql(`SELECT has_function_privilege('outsider','public.get_public_health_report(text)','EXECUTE');`)).toBe('f');
    expect(sql(`SELECT has_function_privilege('anon','public.health_public_snapshot(jsonb,text[])','EXECUTE');`)).toBe('f');
    expect(sql(`SET ROLE anon; SELECT count(*) FROM public.health_report_snapshots; RESET ROLE;`)).toBe('0');
  });
  it('documento fiscal só por serviço, com TTL máximo 300 segundos', () => {
    const res=doc(); expect(res.ok).toBe(true); expect(res.ttl_seconds).toBe(300);
    expect(doc('synthetic-buyer').ok).toBe(false); expect(doc('synthetic-fiscal',mid).ok).toBe(false); expect(doc('expired').ok).toBe(false);
  });
  it('TTL não supera o tempo restante', () => {
    sql(`BEGIN; UPDATE public.health_report_shares SET expires_at=now()+interval '20 seconds' WHERE public_token='synthetic-fiscal';`);
    const res=doc(); expect(res.ttl_seconds).toBeGreaterThan(0); expect(res.ttl_seconds).toBeLessThanOrEqual(20);
    sql(`UPDATE public.health_report_shares SET expires_at=now()+interval '1 hour' WHERE public_token='synthetic-fiscal';`);
  });
  it('laudo revogado é negado pelo relatório e pelo documento', () => {
    sql(`UPDATE public.health_reports SET revoked_at=now() WHERE id='${rid}';`);
    expect(rpc().reason).toBe('report_revoked'); expect(doc().reason).toBe('report_revoked');
    sql(`UPDATE public.health_reports SET revoked_at=NULL WHERE id='${rid}';`);
  });
  it('snapshot ausente falha fechado', () => {
    sql(`UPDATE public.health_report_snapshots SET payload=NULL;`); expect(rpc().reason).toBe('snapshot_missing');
    sql(`UPDATE public.health_report_snapshots SET payload=${quote(snapshot)};`);
  });
  it('defesa adicional é idempotente e não confia em campos fiscais de share comum', () => {
    const res=rpc(); expect(sanitizePublicSnapshot(res.snapshot,res.allowed_sections)).toEqual(res.snapshot);
    expect(sanitizeFiscal({owner_cpf:'123.456.789-09'},all,'buyer')).toBeNull();
    expect(publicSections(null)).toEqual([]); expect(sanitizePublicSnapshot(null,null)).toEqual({});
  });
  it('consumidor público aceita snapshot parcial sem conteúdo privado', () => {
    const res=rpc(); const html=renderToStaticMarkup(createElement(ReportSnapshotView,{snapshot:res.snapshot,sections:res.allowed_sections}));
    expect(html).toContain('Honda'); expect(html).not.toContain('PRIVATE_SENTINEL');
  });
  it('PDF fiscal é gerado a partir da resposta pública sanitizada', async () => {
    const res=rpc('synthetic-fiscal'); const pdf=await buildFiscalPdf({snapshot:res.snapshot,code:res.code,issuedAt:res.issued_at,status:res.status,fiscal:res.fiscal});
    const content=await pdf.text(); expect(content.startsWith('%PDF')).toBe(true); expect(content).toContain('123.456.789-09'); expect(content).not.toContain('PRIVATE_SENTINEL');
  });
  it('snapshots e hashes mantêm integridade após migration e validações', () => {
    expect(sql(`SELECT md5(string_agg(payload::text||sha256,'')) FROM public.health_report_snapshots;`)).toBe(before);
    expect(sql(`SELECT snapshot_sha256 FROM public.health_reports WHERE id='${rid}';`)).toBe('original-hash');
  });
});
