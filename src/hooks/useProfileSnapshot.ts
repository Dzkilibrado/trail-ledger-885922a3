import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fonte única do perfil do usuário logado para reutilização automática
 * em módulos operacionais (Smart Receipt, Certificados, Transferências, etc.).
 *
 * Princípio: "Informar uma vez. Reutilizar sempre."
 *
 * - Cacheado por 5 minutos.
 * - Chave única `["profile-snapshot", uid]` compartilhada entre módulos.
 * - Invalidado automaticamente no `onAuthStateChange` do root
 *   (SIGNED_IN / SIGNED_OUT / USER_UPDATED) e sempre que o wizard concluir.
 * - Módulos NUNCA escrevem de volta no perfil a partir deste snapshot;
 *   edições locais só valem para a operação corrente.
 */
export type ProfileSnapshot = {
  uid: string;
  full_name: string;
  display_name: string;
  cpf: string | null;
  birth_date: string | null;
  email: string;
  phone: string;
  whatsapp: string;
  whatsapp_same_as_phone: boolean;
  uf: string | null;
  city: string | null;
  cep: string | null;
  bairro: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  /** "Cidade / UF" pronto para o campo de local de negociação. */
  location: string;
  /** WhatsApp efetivo: se marcado "igual ao celular", devolve `phone`. */
  whatsappResolved: string;
  /** Endereço completo em uma linha, para exibição. */
  addressLine: string;
  /** Todos os campos essenciais preenchidos. */
  isComplete: boolean;
};

async function fetchSnapshot(): Promise<ProfileSnapshot | null> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return null;
  const { data: p } = await supabase
    .from("profiles")
    .select(
      "full_name,display_name,cpf,birth_date,email,phone,whatsapp,whatsapp_same_as_phone,uf,city,cep,bairro,logradouro,numero,complemento",
    )
    .eq("id", uid)
    .maybeSingle();
  if (!p) return null;
  const full_name = p.full_name ?? "";
  const display_name = p.display_name ?? "";
  const email = p.email ?? u.user?.email ?? "";
  const phone = p.phone ?? "";
  const waSame = !!p.whatsapp_same_as_phone;
  const whatsapp = p.whatsapp ?? "";
  const whatsappResolved = waSame ? phone : whatsapp;
  const location = p.city && p.uf ? `${p.city} / ${p.uf}` : "";
  const addressLine = [p.logradouro, p.numero, p.complemento, p.bairro, p.cep]
    .filter((s) => s && String(s).trim())
    .join(", ");
  const isComplete = !!(
    full_name && p.cpf && p.birth_date && email && phone && whatsappResolved && p.uf && p.city
  );
  return {
    uid,
    full_name,
    display_name,
    cpf: p.cpf ?? null,
    birth_date: p.birth_date ?? null,
    email,
    phone,
    whatsapp,
    whatsapp_same_as_phone: waSame,
    uf: p.uf ?? null,
    city: p.city ?? null,
    cep: p.cep ?? null,
    bairro: p.bairro ?? null,
    logradouro: p.logradouro ?? null,
    numero: p.numero ?? null,
    complemento: p.complemento ?? null,
    location,
    whatsappResolved,
    addressLine,
    isComplete,
  };
}

export function useProfileSnapshot() {
  return useQuery({
    queryKey: ["profile-snapshot"],
    queryFn: fetchSnapshot,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

/** Invalidação manual — usar após o wizard concluir ou ao editar o perfil. */
export function useInvalidateProfileSnapshot() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["profile-snapshot"] });
}