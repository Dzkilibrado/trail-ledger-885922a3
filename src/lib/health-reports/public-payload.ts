import policy from './public-policy.json';
import type { ReportSection } from './types';
import type { PublicHealthReportSnapshot } from './public-types';
import { redactPublicText, snapshotIdentities } from './public-text';

const sections: Record<ReportSection, string[]> = {
  identification: ['motorcycle'], summary: ['overall', 'rideAnswer', 'nextMaintenance'],
  components: ['components'], action_plan: ['recommendations'], history: ['history'],
  indices: ['indices'], reservations: ['reservations', 'conflicts', 'missingData'],
};
export function publicSections(allowed: unknown, preset = 'custom'): ReportSection[] {
  if (!Array.isArray(allowed)) return [];
  return [...new Set(allowed.filter((s): s is ReportSection =>
    typeof s === 'string' && Object.hasOwn(sections, s) &&
    (preset !== 'fiscal' || s === 'identification' || s === 'summary')))].sort();
}

/** Recursive allowlist; neither arrays nor nested objects pass through verbatim. */
function project(value: unknown, shape: unknown): unknown {
  if (Array.isArray(shape)) {
    if (!Array.isArray(value)) return [];
    return value.map(v => project(v, shape[0])).filter(v => v !== undefined);
  }
  if (shape && typeof shape === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(shape)) {
      if (!Object.hasOwn(source, key)) continue;
      const projected = project(source[key], child);
      if (projected !== undefined) out[key] = projected;
    }
    return out;
  }
  return value === null || typeof value === shape ? value : undefined;
}

export function sanitizePublicSnapshot(snapshot: unknown, allowed: unknown, preset = 'custom'): PublicHealthReportSnapshot {
  const keys = ['issuedAt', 'timezone', 'formatVersion', 'disclaimer', 'validity',
    ...publicSections(allowed, preset).flatMap(s => sections[s])];
  const source = policy as Record<string, unknown>;
  const shape = Object.fromEntries(keys.map(k => [k, source[k]]));
  return redactPublicText(project(snapshot, shape) ?? {}, snapshotIdentities(snapshot)) as PublicHealthReportSnapshot;
}

export function sanitizeFiscal(value: unknown, allowed: unknown, preset: string) {
  if (preset !== 'fiscal' || !publicSections(allowed, preset).includes('identification')) return null;
  return (project(value, {
    owner_name: 'string', owner_cpf: 'string', origin_doc_id: 'string', origin_doc_type: 'string',
    origin_doc_name: 'string', origin_doc_number: 'string', origin_doc_mime: 'string',
  }) ?? null) as {
    owner_name: string | null; owner_cpf: string | null; origin_doc_id: string | null;
    origin_doc_type: string | null; origin_doc_name: string | null; origin_doc_number: string | null;
    origin_doc_mime: string | null;
  } | null;
}