import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// ── Tipos derivados do schema real ────────────────────────────────────────────

type Row = Database["public"]["Tables"]["user_item_library"]["Row"];
type Insert = Database["public"]["Tables"]["user_item_library"]["Insert"];

export type UserItemLibraryEntry = Row;

export type NewUserItemLibraryEntry = Pick<Insert, "description" | "category" | "item_kind">;

export type UpdateUserItemLibraryEntry = Partial<NewUserItemLibraryEntry> & { id: string };

const TABLE = "user_item_library" as const;
const QK = ["user_item_library"] as const;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useUserItemLibrary(search?: string) {
  const qc = useQueryClient();

  const items = useQuery({
    queryKey: [...QK, search ?? ""],
    queryFn: async () => {
      let q = supabase
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

      const { data, error } = await supabase
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
      const { data, error } = await supabase
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

  // softDelete: UPDATE deleted_at = now() — não executa DELETE físico
  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(TABLE)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  return { items, create, update, softDelete };
}
