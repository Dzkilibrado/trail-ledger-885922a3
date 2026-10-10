/** Public authenticity metadata: identification is intentional, not snapshot access. */
export function publicValidationResult(value: unknown) {
  const res = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const exists = res.exists === true || (res.exists === undefined && res.ok === true);
  return {
    ok: exists,
    exists,
    code: typeof res.code === 'string' ? res.code : null,
    status: exists && typeof res.status === 'string' ? res.status : 'not_found',
    issuedAt: typeof res.issued_at === 'string' ? res.issued_at : null,
    validUntil: typeof res.valid_until === 'string' ? res.valid_until : null,
    sha256: typeof res.sha256 === 'string' ? res.sha256 : null,
    formatVersion: typeof res.format_version === 'string' ? res.format_version : null,
    outdatedAt: typeof res.outdated_at === 'string' ? res.outdated_at : null,
    revoked: res.revoked === true,
    motorcycle: typeof res.motorcycle === 'string' ? res.motorcycle : null,
  };
}