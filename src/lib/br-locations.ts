/**
 * Base oficial de UFs e municípios do Brasil.
 *
 * UFs: lista fixa (27 itens, imutável).
 * Municípios: consulta on-demand à API pública do IBGE (Localidades),
 *   com cache em memória por UF.
 *
 * Docs: https://servicodados.ibge.gov.br/api/docs/localidades
 */

export interface UF {
  sigla: string;
  nome: string;
}

/** Normaliza texto para busca: minúsculas e sem acentos/diacríticos. */
export function normalizeSearch(v: string): string {
  return (v ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export const BR_UFS: readonly UF[] = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
] as const;

const cityCache = new Map<string, string[]>();
const inflight = new Map<string, Promise<string[]>>();

/** Busca a lista oficial de municípios de uma UF (IBGE), com cache em memória. */
export async function fetchMunicipiosByUF(uf: string): Promise<string[]> {
  const key = uf.toUpperCase();
  const cached = cityCache.get(key);
  if (cached) return cached;
  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(key)}/municipios?orderBy=nome`,
    );
    if (!res.ok) throw new Error(`IBGE: ${res.status}`);
    const rows = (await res.json()) as Array<{ nome: string }>;
    const list = rows.map((r) => r.nome).filter(Boolean);
    cityCache.set(key, list);
    inflight.delete(key);
    return list;
  })();

  inflight.set(key, p);
  return p;
}

/** Formato canônico armazenado: "Cidade / UF". */
export function formatLocation(city: string | null | undefined, uf: string | null | undefined): string {
  const c = (city ?? "").trim();
  const u = (uf ?? "").trim().toUpperCase();
  if (c && u) return `${c} / ${u}`;
  return c || u || "";
}

/** Faz o parse de um valor persistido "Cidade / UF" (ou variações antigas). */
export function parseLocation(value: string | null | undefined): { city: string; uf: string } {
  const raw = (value ?? "").trim();
  if (!raw) return { city: "", uf: "" };
  const m = raw.match(/^\s*(.+?)\s*[\/,-]\s*([A-Za-z]{2})\s*$/);
  if (m) return { city: m[1].trim(), uf: m[2].toUpperCase() };
  return { city: raw, uf: "" };
}
