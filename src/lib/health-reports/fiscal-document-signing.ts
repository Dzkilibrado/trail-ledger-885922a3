export interface FiscalDocumentAuthorization {
  ok: boolean;
  reason?: string;
  bucket?: string;
  storage_path?: string;
  ttl_seconds?: number;
  file_name?: string;
  mime_type?: string;
}

/** Accepts service-RPC authorization, never client-supplied storage paths or TTL. */
export async function signAuthorizedFiscalDocument(
  authorization: FiscalDocumentAuthorization | null,
  sign: (bucket: string, path: string, ttl: number) => Promise<string | null>,
) {
  if (!authorization?.ok) return { ok: false as const, reason: authorization?.reason ?? 'denied' };
  const { bucket, storage_path: path, ttl_seconds: ttl } = authorization;
  if (!bucket || !path || typeof ttl !== 'number' || !Number.isInteger(ttl) || ttl <= 0 || ttl > 300) {
    return { ok: false as const, reason: 'invalid_authorization' };
  }
  const signedUrl = await sign(bucket, path, ttl);
  if (!signedUrl) return { ok: false as const, reason: 'storage_error' };
  return { ok: true as const, signedUrl, fileName: authorization.file_name ?? 'documento',
    mimeType: authorization.mime_type ?? 'application/octet-stream', ttlSeconds: ttl };
}