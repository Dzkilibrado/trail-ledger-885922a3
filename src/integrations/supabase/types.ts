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
      maintenance_inspections: {
        Row: {
          created_at: string
          created_by: string | null
          decision: Database["public"]["Enums"]["inspection_decision"]
          event_id: string | null
          hours_at: number | null
          id: string
          km_at: number | null
          motorcycle_id: string
          notes: string | null
          schedule_id: string | null
          signs: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decision: Database["public"]["Enums"]["inspection_decision"]
          event_id?: string | null
          hours_at?: number | null
          id?: string
          km_at?: number | null
          motorcycle_id: string
          notes?: string | null
          schedule_id?: string | null
          signs?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decision?: Database["public"]["Enums"]["inspection_decision"]
          event_id?: string | null
          hours_at?: number | null
          id?: string
          km_at?: number | null
          motorcycle_id?: string
          notes?: string | null
          schedule_id?: string | null
          signs?: Json
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_inspections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_inspections_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_inspections_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "maintenance_schedules"
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
      maintenance_plan_items: {
        Row: {
          action: Database["public"]["Enums"]["plan_item_action"]
          category: Database["public"]["Enums"]["maintenance_category"]
          created_at: string
          id: string
          interval_days: number | null
          interval_hours: number | null
          interval_km: number | null
          item_name: string
          notes: string | null
          replace_days: number | null
          replace_hours: number | null
          replace_km: number | null
          severity: Database["public"]["Enums"]["plan_severity"]
          sort_order: number
          template_id: string
          updated_at: string
        }
        Insert: {
          action?: Database["public"]["Enums"]["plan_item_action"]
          category: Database["public"]["Enums"]["maintenance_category"]
          created_at?: string
          id?: string
          interval_days?: number | null
          interval_hours?: number | null
          interval_km?: number | null
          item_name: string
          notes?: string | null
          replace_days?: number | null
          replace_hours?: number | null
          replace_km?: number | null
          severity?: Database["public"]["Enums"]["plan_severity"]
          sort_order?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["plan_item_action"]
          category?: Database["public"]["Enums"]["maintenance_category"]
          created_at?: string
          id?: string
          interval_days?: number | null
          interval_hours?: number | null
          interval_km?: number | null
          item_name?: string
          notes?: string | null
          replace_days?: number | null
          replace_hours?: number | null
          replace_km?: number | null
          severity?: Database["public"]["Enums"]["plan_severity"]
          sort_order?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_plan_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "maintenance_plan_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_plan_templates: {
        Row: {
          active: boolean
          brand: string | null
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          model: string | null
          name: string
          updated_at: string
          year_from: number | null
          year_to: number | null
        }
        Insert: {
          active?: boolean
          brand?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          model?: string | null
          name: string
          updated_at?: string
          year_from?: number | null
          year_to?: number | null
        }
        Update: {
          active?: boolean
          brand?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          model?: string | null
          name?: string
          updated_at?: string
          year_from?: number | null
          year_to?: number | null
        }
        Relationships: []
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
      maintenance_wear_signs: {
        Row: {
          category: Database["public"]["Enums"]["maintenance_category"]
          created_at: string
          id: string
          item_name: string | null
          label: string
          sort_order: number
        }
        Insert: {
          category: Database["public"]["Enums"]["maintenance_category"]
          created_at?: string
          id?: string
          item_name?: string | null
          label: string
          sort_order?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["maintenance_category"]
          created_at?: string
          id?: string
          item_name?: string | null
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      motorcycle_documents: {
        Row: {
          amount: number | null
          bucket: string
          created_at: string
          created_by: string | null
          custom_label: string | null
          deleted_at: string | null
          deleted_by: string | null
          doc_date: string | null
          doc_number: string | null
          doc_type: Database["public"]["Enums"]["motorcycle_document_type"]
          file_name: string | null
          id: string
          is_current: boolean
          issuer: string | null
          mime_type: string | null
          motorcycle_id: string
          notes: string | null
          parent_id: string | null
          sha256: string | null
          size_bytes: number | null
          storage_path: string
          updated_at: string
          version: number
        }
        Insert: {
          amount?: number | null
          bucket?: string
          created_at?: string
          created_by?: string | null
          custom_label?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          doc_date?: string | null
          doc_number?: string | null
          doc_type: Database["public"]["Enums"]["motorcycle_document_type"]
          file_name?: string | null
          id?: string
          is_current?: boolean
          issuer?: string | null
          mime_type?: string | null
          motorcycle_id: string
          notes?: string | null
          parent_id?: string | null
          sha256?: string | null
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          version?: number
        }
        Update: {
          amount?: number | null
          bucket?: string
          created_at?: string
          created_by?: string | null
          custom_label?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          doc_date?: string | null
          doc_number?: string | null
          doc_type?: Database["public"]["Enums"]["motorcycle_document_type"]
          file_name?: string | null
          id?: string
          is_current?: boolean
          issuer?: string | null
          mime_type?: string | null
          motorcycle_id?: string
          notes?: string | null
          parent_id?: string | null
          sha256?: string | null
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "motorcycle_documents_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motorcycle_documents_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "motorcycle_documents"
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
          use_profile: Database["public"]["Enums"]["use_profile"] | null
          use_profile_note: string | null
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
          use_profile?: Database["public"]["Enums"]["use_profile"] | null
          use_profile_note?: string | null
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
          use_profile?: Database["public"]["Enums"]["use_profile"] | null
          use_profile_note?: string | null
          year_make?: number | null
          year_model?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
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
      platform_modules: {
        Row: {
          created_at: string
          description: string | null
          hide_when_disabled: boolean
          id: string
          key: string
          label: string
          maintenance_message: string | null
          maintenance_reason: string | null
          maintenance_until: string | null
          sort_order: number
          status: Database["public"]["Enums"]["module_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          hide_when_disabled?: boolean
          id?: string
          key: string
          label: string
          maintenance_message?: string | null
          maintenance_reason?: string | null
          maintenance_until?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["module_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          hide_when_disabled?: boolean
          id?: string
          key?: string
          label?: string
          maintenance_message?: string | null
          maintenance_reason?: string | null
          maintenance_until?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["module_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_seen_at: string | null
          phone: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          plan_since: string
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          last_seen_at?: string | null
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          plan_since?: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_seen_at?: string | null
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          plan_since?: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      ticket_attachments: {
        Row: {
          bucket: string
          created_at: string
          file_name: string | null
          id: string
          message_id: string | null
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          ticket_id: string
          uploaded_by: string
        }
        Insert: {
          bucket?: string
          created_at?: string
          file_name?: string | null
          id?: string
          message_id?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          ticket_id: string
          uploaded_by: string
        }
        Update: {
          bucket?: string
          created_at?: string
          file_name?: string | null
          id?: string
          message_id?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          ticket_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ticket_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          code: string | null
          created_at: string
          description: string
          id: string
          last_activity_at: string
          module: Database["public"]["Enums"]["ticket_module"]
          motorcycle_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          title: string
          type: Database["public"]["Enums"]["ticket_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          code?: string | null
          created_at?: string
          description: string
          id?: string
          last_activity_at?: string
          module?: Database["public"]["Enums"]["ticket_module"]
          motorcycle_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          title: string
          type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          code?: string | null
          created_at?: string
          description?: string
          id?: string
          last_activity_at?: string
          module?: Database["public"]["Enums"]["ticket_module"]
          motorcycle_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          title?: string
          type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
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
      admin_dashboard_stats: { Args: never; Returns: Json }
      admin_list_users: {
        Args: {
          _from?: string
          _has_moto?: boolean
          _has_ticket?: boolean
          _limit?: number
          _plan?: string
          _search?: string
          _status?: string
          _to?: string
        }
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_admin: boolean
          last_seen_at: string
          motorcycles_count: number
          open_tickets: number
          phone: string
          plan: Database["public"]["Enums"]["plan_tier"]
          status: Database["public"]["Enums"]["user_status"]
        }[]
      }
      admin_set_user_plan: {
        Args: { _plan: Database["public"]["Enums"]["plan_tier"]; _user: string }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: { _is_admin: boolean; _user: string }
        Returns: undefined
      }
      admin_set_user_status: {
        Args: {
          _status: Database["public"]["Enums"]["user_status"]
          _user: string
        }
        Returns: undefined
      }
      admin_update_module: {
        Args: {
          _hide_when_disabled?: boolean
          _key: string
          _maintenance_message?: string
          _maintenance_reason?: string
          _maintenance_until?: string
          _status: Database["public"]["Enums"]["module_status"]
        }
        Returns: {
          created_at: string
          description: string | null
          hide_when_disabled: boolean
          id: string
          key: string
          label: string
          maintenance_message: string | null
          maintenance_reason: string | null
          maintenance_until: string | null
          sort_order: number
          status: Database["public"]["Enums"]["module_status"]
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "platform_modules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_profile: {
        Args: { _full_name: string; _phone: string; _user: string }
        Returns: undefined
      }
      admin_user_details: { Args: { _user: string }; Returns: Json }
      cancel_ownership_transfer: {
        Args: { _transfer_id: string }
        Returns: undefined
      }
      get_platform_modules: {
        Args: never
        Returns: {
          created_at: string
          description: string | null
          hide_when_disabled: boolean
          id: string
          key: string
          label: string
          maintenance_message: string | null
          maintenance_reason: string | null
          maintenance_until: string | null
          sort_order: number
          status: Database["public"]["Enums"]["module_status"]
          updated_at: string
          updated_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "platform_modules"
          isOneToOne: false
          isSetofReturn: true
        }
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
      inspection_decision:
        | "good"
        | "attention"
        | "replace_recommended"
        | "replaced"
        | "postpone"
        | "ignore"
      maintenance_category:
        | "engine"
        | "suspension"
        | "brakes"
        | "transmission"
        | "wheels"
        | "electrical"
        | "cooling"
        | "other"
      module_status: "active" | "maintenance" | "disabled" | "beta"
      motorcycle_document_type:
        | "invoice"
        | "manual"
        | "warranty"
        | "import"
        | "contract"
        | "other"
      ownership_method: "creation" | "transfer" | "import"
      plan_item_action:
        | "inspect"
        | "replace"
        | "lubricate"
        | "adjust"
        | "clean"
        | "check_level"
      plan_severity: "low" | "medium" | "high" | "critical"
      plan_tier: "free" | "premium" | "workshop"
      schedule_status: "active" | "snoozed" | "ignored" | "done"
      ticket_module:
        | "dashboard"
        | "motorcycle"
        | "agenda"
        | "maintenance"
        | "financial"
        | "certificate"
        | "transfer"
        | "documentation"
        | "workshop"
        | "account"
        | "other"
      ticket_priority: "low" | "medium" | "high" | "critical"
      ticket_status:
        | "open"
        | "in_analysis"
        | "awaiting_user"
        | "in_progress"
        | "resolved"
        | "closed"
        | "cancelled"
      ticket_type:
        | "bug"
        | "question"
        | "moto"
        | "certificate"
        | "billing"
        | "suggestion"
        | "admin_request"
        | "other"
      transfer_status: "pending" | "approved" | "rejected" | "cancelled"
      use_profile:
        | "light"
        | "normal"
        | "severe"
        | "motocross"
        | "competition"
        | "sand_mud"
        | "other"
      user_status: "active" | "pending" | "blocked" | "inactive"
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
      inspection_decision: [
        "good",
        "attention",
        "replace_recommended",
        "replaced",
        "postpone",
        "ignore",
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
      module_status: ["active", "maintenance", "disabled", "beta"],
      motorcycle_document_type: [
        "invoice",
        "manual",
        "warranty",
        "import",
        "contract",
        "other",
      ],
      ownership_method: ["creation", "transfer", "import"],
      plan_item_action: [
        "inspect",
        "replace",
        "lubricate",
        "adjust",
        "clean",
        "check_level",
      ],
      plan_severity: ["low", "medium", "high", "critical"],
      plan_tier: ["free", "premium", "workshop"],
      schedule_status: ["active", "snoozed", "ignored", "done"],
      ticket_module: [
        "dashboard",
        "motorcycle",
        "agenda",
        "maintenance",
        "financial",
        "certificate",
        "transfer",
        "documentation",
        "workshop",
        "account",
        "other",
      ],
      ticket_priority: ["low", "medium", "high", "critical"],
      ticket_status: [
        "open",
        "in_analysis",
        "awaiting_user",
        "in_progress",
        "resolved",
        "closed",
        "cancelled",
      ],
      ticket_type: [
        "bug",
        "question",
        "moto",
        "certificate",
        "billing",
        "suggestion",
        "admin_request",
        "other",
      ],
      transfer_status: ["pending", "approved", "rejected", "cancelled"],
      use_profile: [
        "light",
        "normal",
        "severe",
        "motocross",
        "competition",
        "sand_mud",
        "other",
      ],
      user_status: ["active", "pending", "blocked", "inactive"],
    },
  },
} as const
