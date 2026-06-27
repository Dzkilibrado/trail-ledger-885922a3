export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          created_at: string
          id: string
          motorcycle_id: string | null
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          created_at?: string
          id?: string
          motorcycle_id?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          created_at?: string
          id?: string
          motorcycle_id?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          allowed_sections: Json
          created_at: string
          expires_at: string | null
          id: string
          motorcycle_id: string
          public_token: string
          status: string
        }
        Insert: {
          allowed_sections?: Json
          created_at?: string
          expires_at?: string | null
          id?: string
          motorcycle_id: string
          public_token?: string
          status?: string
        }
        Update: {
          allowed_sections?: Json
          created_at?: string
          expires_at?: string | null
          id?: string
          motorcycle_id?: string
          public_token?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attachments: {
        Row: {
          bucket: string
          caption: string | null
          created_at: string
          event_id: string
          id: string
          kind: Database["public"]["Enums"]["attachment_kind"]
          storage_path: string
        }
        Insert: {
          bucket: string
          caption?: string | null
          created_at?: string
          event_id: string
          id?: string
          kind: Database["public"]["Enums"]["attachment_kind"]
          storage_path: string
        }
        Update: {
          bucket?: string
          caption?: string | null
          created_at?: string
          event_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["attachment_kind"]
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attachments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string
          description: string | null
          hours_at_event: number | null
          hours_delta: number | null
          id: string
          km_at_event: number | null
          km_delta: number | null
          location: string | null
          metadata: Json
          motorcycle_id: string
          occurred_at: string
          signed_at: string | null
          signed_by: string | null
          title: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at: string
          workshop_id: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by: string
          description?: string | null
          hours_at_event?: number | null
          hours_delta?: number | null
          id?: string
          km_at_event?: number | null
          km_delta?: number | null
          location?: string | null
          metadata?: Json
          motorcycle_id: string
          occurred_at?: string
          signed_at?: string | null
          signed_by?: string | null
          title: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at?: string
          workshop_id?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string
          description?: string | null
          hours_at_event?: number | null
          hours_delta?: number | null
          id?: string
          km_at_event?: number | null
          km_delta?: number | null
          location?: string | null
          metadata?: Json
          motorcycle_id?: string
          occurred_at?: string
          signed_at?: string | null
          signed_by?: string | null
          title?: string
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_items: {
        Row: {
          brand: string | null
          category: Database["public"]["Enums"]["maintenance_category"]
          created_at: string
          event_id: string
          id: string
          product: string | null
          qty: number | null
          service: string
          unit_value: number | null
          warranty_months: number | null
        }
        Insert: {
          brand?: string | null
          category: Database["public"]["Enums"]["maintenance_category"]
          created_at?: string
          event_id: string
          id?: string
          product?: string | null
          qty?: number | null
          service: string
          unit_value?: number | null
          warranty_months?: number | null
        }
        Update: {
          brand?: string | null
          category?: Database["public"]["Enums"]["maintenance_category"]
          created_at?: string
          event_id?: string
          id?: string
          product?: string | null
          qty?: number | null
          service?: string
          unit_value?: number | null
          warranty_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_schedules: {
        Row: {
          active: boolean
          category: Database["public"]["Enums"]["maintenance_category"]
          created_at: string
          id: string
          interval_days: number | null
          interval_hours: number | null
          interval_km: number | null
          last_completed_event_id: string | null
          last_done_at: string | null
          last_done_hours: number | null
          last_done_km: number | null
          motorcycle_id: string
          name: string
          snoozed_until: string | null
          status: Database["public"]["Enums"]["schedule_status"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: Database["public"]["Enums"]["maintenance_category"]
          created_at?: string
          id?: string
          interval_days?: number | null
          interval_hours?: number | null
          interval_km?: number | null
          last_completed_event_id?: string | null
          last_done_at?: string | null
          last_done_hours?: number | null
          last_done_km?: number | null
          motorcycle_id: string
          name: string
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["maintenance_category"]
          created_at?: string
          id?: string
          interval_days?: number | null
          interval_hours?: number | null
          interval_km?: number | null
          last_completed_event_id?: string | null
          last_done_at?: string | null
          last_done_hours?: number | null
          last_done_km?: number | null
          motorcycle_id?: string
          name?: string
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedules_last_completed_event_id_fkey"
            columns: ["last_completed_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedules_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      motorcycles: {
        Row: {
          brand: string
          chassis: string | null
          conservation_score: number
          control_type: Database["public"]["Enums"]["control_type"]
          created_at: string
          displacement: number | null
          engine_number: string | null
          hours_total: number
          id: string
          incident_declaration: Json | null
          km_total: number
          main_photo_url: string | null
          model: string
          nickname: string | null
          owner_id: string
          plate: string | null
          renavam: string | null
          trailbook_id: string
          updated_at: string
          year_make: number | null
          year_model: number | null
        }
        Insert: {
          brand: string
          chassis?: string | null
          conservation_score?: number
          control_type?: Database["public"]["Enums"]["control_type"]
          created_at?: string
          displacement?: number | null
          engine_number?: string | null
          hours_total?: number
          id?: string
          incident_declaration?: Json | null
          km_total?: number
          main_photo_url?: string | null
          model: string
          nickname?: string | null
          owner_id: string
          plate?: string | null
          renavam?: string | null
          trailbook_id: string
          updated_at?: string
          year_make?: number | null
          year_model?: number | null
        }
        Update: {
          brand?: string
          chassis?: string | null
          conservation_score?: number
          control_type?: Database["public"]["Enums"]["control_type"]
          created_at?: string
          displacement?: number | null
          engine_number?: string | null
          hours_total?: number
          id?: string
          incident_declaration?: Json | null
          km_total?: number
          main_photo_url?: string | null
          model?: string
          nickname?: string | null
          owner_id?: string
          plate?: string | null
          renavam?: string | null
          trailbook_id?: string
          updated_at?: string
          year_make?: number | null
          year_model?: number | null
        }
        Relationships: []
      }
      ownership_history: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          method: Database["public"]["Enums"]["ownership_method"]
          motorcycle_id: string
          notes: string | null
          owner_id: string
          started_at: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          method?: Database["public"]["Enums"]["ownership_method"]
          motorcycle_id: string
          notes?: string | null
          owner_id: string
          started_at?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          method?: Database["public"]["Enums"]["ownership_method"]
          motorcycle_id?: string
          notes?: string | null
          owner_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ownership_history_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      ownership_transfers: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          message: string | null
          motorcycle_id: string
          requested_at: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["transfer_status"]
          to_email: string
          to_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          message?: string | null
          motorcycle_id: string
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_email: string
          to_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          message?: string | null
          motorcycle_id?: string
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_email?: string
          to_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ownership_transfers_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          plan_since: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          plan_since?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          plan_since?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workshops: {
        Row: {
          city: string | null
          cnpj: string | null
          created_at: string
          id: string
          name: string
          owner_user_id: string | null
          phone: string | null
          state: string | null
          updated_at: string
          verified: boolean
          verified_at: string | null
          verified_label: string | null
        }
        Insert: {
          city?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          name: string
          owner_user_id?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
          verified_label?: string | null
        }
        Update: {
          city?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
          verified_label?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_ownership_transfer: {
        Args: { _transfer_id: string }
        Returns: undefined
      }
      get_public_certificate: { Args: { _token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_moto_owner: { Args: { _moto_id: string }; Returns: boolean }
      request_ownership_transfer: {
        Args: { _message: string; _moto_id: string; _to_email: string }
        Returns: string
      }
      respond_ownership_transfer: {
        Args: { _approve: boolean; _transfer_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "mechanic" | "admin"
      attachment_kind: "photo" | "video" | "document" | "invoice"
      audit_action: "insert" | "update" | "delete"
      control_type: "hours" | "km" | "both"
      event_type:
        | "usage"
        | "maintenance"
        | "revision"
        | "accessory"
        | "photo"
        | "video"
        | "document"
        | "purchase"
        | "sale"
        | "ownership_transfer"
        | "recall"
        | "warranty"
        | "note"
        | "incident"
        | "declaration"
      maintenance_category:
        | "engine"
        | "suspension"
        | "brakes"
        | "transmission"
        | "wheels"
        | "electrical"
        | "cooling"
        | "other"
      ownership_method: "creation" | "transfer" | "import"
      plan_tier: "free" | "premium" | "workshop"
      schedule_status: "active" | "snoozed" | "ignored" | "done"
      transfer_status: "pending" | "approved" | "rejected" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "mechanic", "admin"],
      attachment_kind: ["photo", "video", "document", "invoice"],
      audit_action: ["insert", "update", "delete"],
      control_type: ["hours", "km", "both"],
      event_type: [
        "usage",
        "maintenance",
        "revision",
        "accessory",
        "photo",
        "video",
        "document",
        "purchase",
        "sale",
        "ownership_transfer",
        "recall",
        "warranty",
        "note",
        "incident",
        "declaration",
      ],
      maintenance_category: [
        "engine",
        "suspension",
        "brakes",
        "transmission",
        "wheels",
        "electrical",
        "cooling",
        "other",
      ],
      ownership_method: ["creation", "transfer", "import"],
      plan_tier: ["free", "premium", "workshop"],
      schedule_status: ["active", "snoozed", "ignored", "done"],
      transfer_status: ["pending", "approved", "rejected", "cancelled"],
    },
  },
} as const
