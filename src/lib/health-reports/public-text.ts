/** Public prose only: private identity fields remain immutable and fiscal identity is separate. */
export function redactPublicText(value: unknown, identities: string[] = []): unknown {
  if (Array.isArray(value)) return value.map(item => redactPublicText(item, identities));
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, redactPublicText(child, identities)]),
  );
  if (typeof value !== 'string') return value;
  let text = value;
  for (const identity of identities.filter(name => name.trim().length >= 3)) {
    const escaped = identity.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(escaped, 'gi'), '[identificação protegida]');
  }
  return text
    .replace(/\b[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2}\b/g, '[CPF protegido]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[contato protegido]')
    .replace(/\(?[0-9]{2}\)?[ .-]+[0-9]{4,5}[ .-]+[0-9]{4}\b/g, '[contato protegido]');
}

export function snapshotIdentities(snapshot: unknown): string[] {
  if (!snapshot || typeof snapshot !== 'object') return [];
  const source = snapshot as Record<string, unknown>;
  return ['owner', 'issuedBy'].flatMap(key => {
    const person = source[key];
    if (!person || typeof person !== 'object') return [];
    const name = (person as Record<string, unknown>).name;
    return typeof name === 'string' ? [name] : [];
  });
}