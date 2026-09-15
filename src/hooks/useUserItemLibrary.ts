import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MaintenanceCategory } from "@/lib/trailbook";
import type { ItemKind } from "@/components/types-registrar";

// ── Tipos ─────────────────────────────────────────────────────────────────────
// A tabela user_item_library é nova — os tipos gerados pelo Supabase ainda
// não a contêm. Usando tipos locais até a próxima geração de types.

export interface UserItemLibraryEntry {
  id: string;
  user_id: string;
  description: string;
  category: MaintenanceCategory;
  item_kind: ItemKind;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type NewUserItemLibraryEntry = Pick<
  UserItemLibraryEntry,
  "description" | "category" | "item_kind"
>;

export type UpdateUserItemLibraryEntry = Partial<NewUserItemLibraryEntry> & { id: string };

const TABLE = "user_item_library";
const QK = ["user_item_library"] as const;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useUserItemLibrary(search?: string) {
  const qc = useQueryClient();

  const items = useQuery({
    queryKey: [...QK, search ?? ""],
    queryFn: async () => {
      let q = (supabase as any)
        .from(TABLE)
        .select("*")
        .order("created_at", { ascending: false });

      if (search?.trim()) {
        q = q.ilike("description", `%${search.trim()}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as UserItemLibraryEntry[];
    },
  });

  const create = useMutation({
    mutationFn: async (entry: NewUserItemLibraryEntry) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data, error } = await (supabase as any)
        .from(TABLE)
        .insert({ ...entry, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as UserItemLibraryEntry;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: UpdateUserItemLibraryEntry) => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as UserItemLibraryEntry;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from(TABLE)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  return { items, create, update, softDelete };
}
