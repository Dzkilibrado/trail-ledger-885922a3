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
      admin_user_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          field: string | null
          id: string
          ip: string | null
          metadata: Json
          new_value: Json | null
          notes: string | null
          old_value: Json | null
          reason: string | null
          target_snapshot: Json | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          field?: string | null
          id?: string
          ip?: string | null
          metadata?: Json
          new_value?: Json | null
          notes?: string | null
          old_value?: Json | null
          reason?: string | null
          target_snapshot?: Json | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          field?: string | null
          id?: string
          ip?: string | null
          metadata?: Json
          new_value?: Json | null
          notes?: string | null
          old_value?: Json | null
          reason?: string | null
          target_snapshot?: Json | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
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
      certificate_access_log: {
        Row: {
          accessed_at: string
          certificate_id: string
          country: string | null
          id: string
          ip: string | null
          referer: string | null
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string
          certificate_id: string
          country?: string | null
          id?: string
          ip?: string | null
          referer?: string | null
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string
          certificate_id?: string
          country?: string | null
          id?: string
          ip?: string | null
          referer?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificate_access_log_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          allowed_sections: Json
          audience: string | null
          created_at: string
          expires_at: string | null
          id: string
          motorcycle_id: string
          public_token: string
          status: string
        }
        Insert: {
          allowed_sections?: Json
          audience?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          motorcycle_id: string
          public_token?: string
          status?: string
        }
        Update: {
          allowed_sections?: Json
          audience?: string | null
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
            referencedRelation: "document_pendencies_view"
            referencedColumns: ["motorcycle_id"]
          },
          {
            foreignKeyName: "certificates_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_audit: {
        Row: {
          action: string
          actor_id: string | null
          channel: Database["public"]["Enums"]["message_channel"] | null
          created_at: string
          id: string
          message_id: string | null
          metadata: Json
          recipient_id: string | null
          status: string | null
          subject_text: string | null
          type: Database["public"]["Enums"]["message_type"] | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"] | null
          created_at?: string
          id?: string
          message_id?: string | null
          metadata?: Json
          recipient_id?: string | null
          status?: string | null
          subject_text?: string | null
          type?: Database["public"]["Enums"]["message_type"] | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"] | null
          created_at?: string
          id?: string
          message_id?: string | null
          metadata?: Json
          recipient_id?: string | null
          status?: string | null
          subject_text?: string | null
          type?: Database["public"]["Enums"]["message_type"] | null
        }
        Relationships: []
      }
      comm_settings: {
        Row: {
          email_enabled: boolean
          email_from: string | null
          email_provider: string | null
          email_test_redirect: string | null
          homologation_mode: boolean
          id: number
          internal_enabled: boolean
          push_enabled: boolean
          sms_enabled: boolean
          updated_at: string
          updated_by: string | null
          whatsapp_enabled: boolean
        }
        Insert: {
          email_enabled?: boolean
          email_from?: string | null
          email_provider?: string | null
          email_test_redirect?: string | null
          homologation_mode?: boolean
          id?: number
          internal_enabled?: boolean
          push_enabled?: boolean
          sms_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          whatsapp_enabled?: boolean
        }
        Update: {
          email_enabled?: boolean
          email_from?: string | null
          email_provider?: string | null
          email_test_redirect?: string | null
          homologation_mode?: boolean
          id?: number
          internal_enabled?: boolean
          push_enabled?: boolean
          sms_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          whatsapp_enabled?: boolean
        }
        Relationships: []
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
            referencedRelation: "document_pendencies_view"
            referencedColumns: ["motorcycle_id"]
          },
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
      help_requests: {
        Row: {
          admin_notes: string | null
          birth_date: string | null
          code: string | null
          cpf: string | null
          created_at: string
          description: string
          email: string
          full_name: string
          id: string
          ip: string | null
          linked_user_id: string | null
          phone: string
          problem_other: string | null
          problem_type: Database["public"]["Enums"]["help_request_type"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["help_request_status"]
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          admin_notes?: string | null
          birth_date?: string | null
          code?: string | null
          cpf?: string | null
          created_at?: string
          description: string
          email: string
          full_name: string
          id?: string
          ip?: string | null
          linked_user_id?: string | null
          phone: string
          problem_other?: string | null
          problem_type: Database["public"]["Enums"]["help_request_type"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["help_request_status"]
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          admin_notes?: string | null
          birth_date?: string | null
          code?: string | null
          cpf?: string | null
          created_at?: string
          description?: string
          email?: string
          full_name?: string
          id?: string
          ip?: string | null
          linked_user_id?: string | null
          phone?: string
          problem_other?: string | null
          problem_type?: Database["public"]["Enums"]["help_request_type"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["help_request_status"]
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
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
            referencedRelation: "document_pendencies_view"
            referencedColumns: ["motorcycle_id"]
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
          schedule_id: string | null
          service: string
          template_item_id: string | null
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
          schedule_id?: string | null
          service: string
          template_item_id?: string | null
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
          schedule_id?: string | null
          service?: string
          template_item_id?: string | null
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
          {
            foreignKeyName: "maintenance_items_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "maintenance_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_items_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "maintenance_plan_items"
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
          hidden: boolean
          id: string
          interval_days: number | null
          interval_hours: number | null
          interval_km: number | null
          is_custom: boolean
          last_completed_event_id: string | null
          last_done_at: string | null
          last_done_hours: number | null
          last_done_km: number | null
          motorcycle_id: string
          name: string
          needs_review: boolean
          notes: string | null
          pinned: boolean
          severity: string | null
          snoozed_until: string | null
          sort_order: number | null
          status: Database["public"]["Enums"]["schedule_status"]
          template_item_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: Database["public"]["Enums"]["maintenance_category"]
          created_at?: string
          hidden?: boolean
          id?: string
          interval_days?: number | null
          interval_hours?: number | null
          interval_km?: number | null
          is_custom?: boolean
          last_completed_event_id?: string | null
          last_done_at?: string | null
          last_done_hours?: number | null
          last_done_km?: number | null
          motorcycle_id: string
          name: string
          needs_review?: boolean
          notes?: string | null
          pinned?: boolean
          severity?: string | null
          snoozed_until?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["schedule_status"]
          template_item_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["maintenance_category"]
          created_at?: string
          hidden?: boolean
          id?: string
          interval_days?: number | null
          interval_hours?: number | null
          interval_km?: number | null
          is_custom?: boolean
          last_completed_event_id?: string | null
          last_done_at?: string | null
          last_done_hours?: number | null
          last_done_km?: number | null
          motorcycle_id?: string
          name?: string
          needs_review?: boolean
          notes?: string | null
          pinned?: boolean
          severity?: string | null
          snoozed_until?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["schedule_status"]
          template_item_id?: string | null
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
            referencedRelation: "document_pendencies_view"
            referencedColumns: ["motorcycle_id"]
          },
          {
            foreignKeyName: "maintenance_schedules_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedules_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "maintenance_plan_items"
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
      message_deliveries: {
        Row: {
          channel: Database["public"]["Enums"]["message_channel"]
          created_at: string
          error: string | null
          id: string
          message_id: string
          payload: Json
          simulated: boolean
          status: Database["public"]["Enums"]["delivery_status"]
          user_id: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          error?: string | null
          id?: string
          message_id: string
          payload?: Json
          simulated?: boolean
          status?: Database["public"]["Enums"]["delivery_status"]
          user_id?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          error?: string | null
          id?: string
          message_id?: string
          payload?: Json
          simulated?: boolean
          status?: Database["public"]["Enums"]["delivery_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_deliveries_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_recipients: {
        Row: {
          archived_at: string | null
          created_at: string
          message_id: string
          read_at: string | null
          replied_at: string | null
          status: Database["public"]["Enums"]["recipient_status"]
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          message_id: string
          read_at?: string | null
          replied_at?: string | null
          status?: Database["public"]["Enums"]["recipient_status"]
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          message_id?: string
          read_at?: string | null
          replied_at?: string | null
          status?: Database["public"]["Enums"]["recipient_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_recipients_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          allow_reply: boolean
          audience: Database["public"]["Enums"]["message_audience"]
          audience_filter: Json
          body: string
          code: string | null
          created_at: string
          id: string
          is_automatic: boolean
          parent_message_id: string | null
          priority: Database["public"]["Enums"]["message_priority"]
          related_ticket_id: string | null
          sender_id: string | null
          status: Database["public"]["Enums"]["message_status"]
          subject_key: Database["public"]["Enums"]["message_subject_key"]
          subject_other: string | null
          subject_text: string
          type: Database["public"]["Enums"]["message_type"]
          updated_at: string
        }
        Insert: {
          allow_reply?: boolean
          audience?: Database["public"]["Enums"]["message_audience"]
          audience_filter?: Json
          body: string
          code?: string | null
          created_at?: string
          id?: string
          is_automatic?: boolean
          parent_message_id?: string | null
          priority?: Database["public"]["Enums"]["message_priority"]
          related_ticket_id?: string | null
          sender_id?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          subject_key?: Database["public"]["Enums"]["message_subject_key"]
          subject_other?: string | null
          subject_text: string
          type?: Database["public"]["Enums"]["message_type"]
          updated_at?: string
        }
        Update: {
          allow_reply?: boolean
          audience?: Database["public"]["Enums"]["message_audience"]
          audience_filter?: Json
          body?: string
          code?: string | null
          created_at?: string
          id?: string
          is_automatic?: boolean
          parent_message_id?: string | null
          priority?: Database["public"]["Enums"]["message_priority"]
          related_ticket_id?: string | null
          sender_id?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          subject_key?: Database["public"]["Enums"]["message_subject_key"]
          subject_other?: string | null
          subject_text?: string
          type?: Database["public"]["Enums"]["message_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_related_ticket_id_fkey"
            columns: ["related_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      motorcycle_brands: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
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
          is_origin_document: boolean
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
          is_origin_document?: boolean
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
          is_origin_document?: boolean
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
            referencedRelation: "document_pendencies_view"
            referencedColumns: ["motorcycle_id"]
          },
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
      motorcycle_model_defaults: {
        Row: {
          model_id: string
          notes: string | null
          suggested_control_type:
            | Database["public"]["Enums"]["control_type"]
            | null
          updated_at: string
        }
        Insert: {
          model_id: string
          notes?: string | null
          suggested_control_type?:
            | Database["public"]["Enums"]["control_type"]
            | null
          updated_at?: string
        }
        Update: {
          model_id?: string
          notes?: string | null
          suggested_control_type?:
            | Database["public"]["Enums"]["control_type"]
            | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "motorcycle_model_defaults_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: true
            referencedRelation: "motorcycle_models"
            referencedColumns: ["id"]
          },
        ]
      }
      motorcycle_model_engines: {
        Row: {
          active: boolean
          created_at: string
          displacement: number
          id: string
          model_id: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          displacement: number
          id?: string
          model_id: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          displacement?: number
          id?: string
          model_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "motorcycle_model_engines_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "motorcycle_models"
            referencedColumns: ["id"]
          },
        ]
      }
      motorcycle_model_years: {
        Row: {
          created_at: string
          id: string
          model_id: string
          year_make: number
          year_model: number
        }
        Insert: {
          created_at?: string
          id?: string
          model_id: string
          year_make: number
          year_model: number
        }
        Update: {
          created_at?: string
          id?: string
          model_id?: string
          year_make?: number
          year_model?: number
        }
        Relationships: [
          {
            foreignKeyName: "motorcycle_model_years_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "motorcycle_models"
            referencedColumns: ["id"]
          },
        ]
      }
      motorcycle_models: {
        Row: {
          active: boolean
          brand_id: string
          created_at: string
          id: string
          name: string
          notes: string | null
          sort_order: number
          type_code: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand_id: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          sort_order?: number
          type_code: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand_id?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          sort_order?: number
          type_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "motorcycle_models_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "motorcycle_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motorcycle_models_type_code_fkey"
            columns: ["type_code"]
            isOneToOne: false
            referencedRelation: "motorcycle_types_ref"
            referencedColumns: ["code"]
          },
        ]
      }
      motorcycle_photos: {
        Row: {
          bucket: string
          caption: string | null
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean
          kind: Database["public"]["Enums"]["media_kind"]
          motorcycle_id: string
          position: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          bucket?: string
          caption?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          kind?: Database["public"]["Enums"]["media_kind"]
          motorcycle_id: string
          position?: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          bucket?: string
          caption?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          kind?: Database["public"]["Enums"]["media_kind"]
          motorcycle_id?: string
          position?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "motorcycle_photos_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "document_pendencies_view"
            referencedColumns: ["motorcycle_id"]
          },
          {
            foreignKeyName: "motorcycle_photos_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      motorcycle_types_ref: {
        Row: {
          active: boolean
          code: string
          created_at: string
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          label: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      motorcycles: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          brand: string
          catalog_model_id: string | null
          chassis: string | null
          condition: string
          conservation_score: number
          control_type: Database["public"]["Enums"]["control_type"]
          created_at: string
          displacement: number | null
          engine_number: string | null
          hours_total: number
          id: string
          incident_declaration: Json | null
          initial_review_done_at: string | null
          is_homologation: boolean
          km_total: number
          main_photo_url: string | null
          model: string
          nickname: string | null
          origin_notes: string | null
          origin_set_at: string | null
          origin_type:
            | Database["public"]["Enums"]["motorcycle_origin_type"]
            | null
          owner_id: string
          plan_review_status: string
          plate: string | null
          renavam: string | null
          status: string
          trailbook_id: string
          updated_at: string
          use_profile: Database["public"]["Enums"]["use_profile"] | null
          use_profile_note: string | null
          year_make: number | null
          year_model: number | null
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          brand: string
          catalog_model_id?: string | null
          chassis?: string | null
          condition?: string
          conservation_score?: number
          control_type?: Database["public"]["Enums"]["control_type"]
          created_at?: string
          displacement?: number | null
          engine_number?: string | null
          hours_total?: number
          id?: string
          incident_declaration?: Json | null
          initial_review_done_at?: string | null
          is_homologation?: boolean
          km_total?: number
          main_photo_url?: string | null
          model: string
          nickname?: string | null
          origin_notes?: string | null
          origin_set_at?: string | null
          origin_type?:
            | Database["public"]["Enums"]["motorcycle_origin_type"]
            | null
          owner_id: string
          plan_review_status?: string
          plate?: string | null
          renavam?: string | null
          status?: string
          trailbook_id: string
          updated_at?: string
          use_profile?: Database["public"]["Enums"]["use_profile"] | null
          use_profile_note?: string | null
          year_make?: number | null
          year_model?: number | null
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          brand?: string
          catalog_model_id?: string | null
          chassis?: string | null
          condition?: string
          conservation_score?: number
          control_type?: Database["public"]["Enums"]["control_type"]
          created_at?: string
          displacement?: number | null
          engine_number?: string | null
          hours_total?: number
          id?: string
          incident_declaration?: Json | null
          initial_review_done_at?: string | null
          is_homologation?: boolean
          km_total?: number
          main_photo_url?: string | null
          model?: string
          nickname?: string | null
          origin_notes?: string | null
          origin_set_at?: string | null
          origin_type?:
            | Database["public"]["Enums"]["motorcycle_origin_type"]
            | null
          owner_id?: string
          plan_review_status?: string
          plate?: string | null
          renavam?: string | null
          status?: string
          trailbook_id?: string
          updated_at?: string
          use_profile?: Database["public"]["Enums"]["use_profile"] | null
          use_profile_note?: string | null
          year_make?: number | null
          year_model?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "motorcycles_catalog_model_id_fkey"
            columns: ["catalog_model_id"]
            isOneToOne: false
            referencedRelation: "motorcycle_models"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "document_pendencies_view"
            referencedColumns: ["motorcycle_id"]
          },
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
            referencedRelation: "document_pendencies_view"
            referencedColumns: ["motorcycle_id"]
          },
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
          birth_date: string | null
          blocked_at: string | null
          blocked_notes: string | null
          blocked_reason: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          inactive_at: string | null
          inactive_notes: string | null
          inactive_reason: string | null
          is_homologation: boolean
          last_seen_at: string | null
          login_provider: string | null
          phone: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          plan_since: string
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          blocked_at?: string | null
          blocked_notes?: string | null
          blocked_reason?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          inactive_at?: string | null
          inactive_notes?: string | null
          inactive_reason?: string | null
          is_homologation?: boolean
          last_seen_at?: string | null
          login_provider?: string | null
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          plan_since?: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          blocked_at?: string | null
          blocked_notes?: string | null
          blocked_reason?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          inactive_at?: string | null
          inactive_notes?: string | null
          inactive_reason?: string | null
          is_homologation?: boolean
          last_seen_at?: string | null
          login_provider?: string | null
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          plan_since?: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      retired_trailbook_ids: {
        Row: {
          moto_id: string | null
          reason: string | null
          retired_at: string
          retired_by: string | null
          snapshot: Json
          trailbook_id: string
        }
        Insert: {
          moto_id?: string | null
          reason?: string | null
          retired_at?: string
          retired_by?: string | null
          snapshot: Json
          trailbook_id: string
        }
        Update: {
          moto_id?: string | null
          reason?: string | null
          retired_at?: string
          retired_by?: string | null
          snapshot?: Json
          trailbook_id?: string
        }
        Relationships: []
      }
      smart_receipts: {
        Row: {
          bucket: string | null
          buyer_id: string | null
          buyer_snapshot: Json
          cancel_reason: string | null
          cancelled_at: string | null
          code: string
          created_at: string
          created_by: string
          id: string
          issued_at: string | null
          motorcycle_id: string
          motorcycle_snapshot: Json
          negotiation: Json
          pdf_path: string | null
          previous_receipt_id: string | null
          qr_path: string | null
          seller_id: string | null
          seller_snapshot: Json
          sha256: string | null
          signed_at: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          bucket?: string | null
          buyer_id?: string | null
          buyer_snapshot?: Json
          cancel_reason?: string | null
          cancelled_at?: string | null
          code: string
          created_at?: string
          created_by?: string
          id?: string
          issued_at?: string | null
          motorcycle_id: string
          motorcycle_snapshot?: Json
          negotiation?: Json
          pdf_path?: string | null
          previous_receipt_id?: string | null
          qr_path?: string | null
          seller_id?: string | null
          seller_snapshot?: Json
          sha256?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          bucket?: string | null
          buyer_id?: string | null
          buyer_snapshot?: Json
          cancel_reason?: string | null
          cancelled_at?: string | null
          code?: string
          created_at?: string
          created_by?: string
          id?: string
          issued_at?: string | null
          motorcycle_id?: string
          motorcycle_snapshot?: Json
          negotiation?: Json
          pdf_path?: string | null
          previous_receipt_id?: string | null
          qr_path?: string | null
          seller_id?: string | null
          seller_snapshot?: Json
          sha256?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "smart_receipts_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "document_pendencies_view"
            referencedColumns: ["motorcycle_id"]
          },
          {
            foreignKeyName: "smart_receipts_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_receipts_previous_receipt_id_fkey"
            columns: ["previous_receipt_id"]
            isOneToOne: false
            referencedRelation: "smart_receipts"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "document_pendencies_view"
            referencedColumns: ["motorcycle_id"]
          },
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
      document_pendencies_view: {
        Row: {
          brand: string | null
          expected_kind: string | null
          has_origin_pendency: boolean | null
          model: string | null
          motorcycle_id: string | null
          nickname: string | null
          origin_type:
            | Database["public"]["Enums"]["motorcycle_origin_type"]
            | null
          owner_id: string | null
          year_model: number | null
        }
        Insert: {
          brand?: string | null
          expected_kind?: never
          has_origin_pendency?: never
          model?: string | null
          motorcycle_id?: string | null
          nickname?: string | null
          origin_type?:
            | Database["public"]["Enums"]["motorcycle_origin_type"]
            | null
          owner_id?: string | null
          year_model?: number | null
        }
        Update: {
          brand?: string | null
          expected_kind?: never
          has_origin_pendency?: never
          model?: string | null
          motorcycle_id?: string | null
          nickname?: string | null
          origin_type?:
            | Database["public"]["Enums"]["motorcycle_origin_type"]
            | null
          owner_id?: string | null
          year_model?: number | null
        }
        Relationships: []
      }
      my_ownership_transfers: {
        Row: {
          created_at: string | null
          from_user_id: string | null
          id: string | null
          message: string | null
          motorcycle_id: string | null
          requested_at: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["transfer_status"] | null
          to_email: string | null
          to_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          from_user_id?: string | null
          id?: string | null
          message?: string | null
          motorcycle_id?: string | null
          requested_at?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["transfer_status"] | null
          to_email?: never
          to_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          from_user_id?: string | null
          id?: string | null
          message?: string | null
          motorcycle_id?: string | null
          requested_at?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["transfer_status"] | null
          to_email?: never
          to_user_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ownership_transfers_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "document_pendencies_view"
            referencedColumns: ["motorcycle_id"]
          },
          {
            foreignKeyName: "ownership_transfers_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      public_receipt_validation: {
        Row: {
          amount: string | null
          buyer_cpf_masked: string | null
          buyer_name: string | null
          code: string | null
          issued_at: string | null
          moto_brand: string | null
          moto_chassis: string | null
          moto_model: string | null
          moto_year_model: string | null
          negotiation_date: string | null
          negotiation_location: string | null
          payment_method: string | null
          previous_receipt_id: string | null
          seller_cpf_masked: string | null
          seller_name: string | null
          sha256: string | null
          signed_at: string | null
          status: string | null
          version: number | null
        }
        Insert: {
          amount?: never
          buyer_cpf_masked?: never
          buyer_name?: never
          code?: string | null
          issued_at?: string | null
          moto_brand?: never
          moto_chassis?: never
          moto_model?: never
          moto_year_model?: never
          negotiation_date?: never
          negotiation_location?: never
          payment_method?: never
          previous_receipt_id?: string | null
          seller_cpf_masked?: never
          seller_name?: never
          sha256?: string | null
          signed_at?: string | null
          status?: string | null
          version?: number | null
        }
        Update: {
          amount?: never
          buyer_cpf_masked?: never
          buyer_name?: never
          code?: string | null
          issued_at?: string | null
          moto_brand?: never
          moto_chassis?: never
          moto_model?: never
          moto_year_model?: never
          negotiation_date?: never
          negotiation_location?: never
          payment_method?: never
          previous_receipt_id?: string | null
          seller_cpf_masked?: never
          seller_name?: never
          sha256?: string | null
          signed_at?: string | null
          status?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "smart_receipts_previous_receipt_id_fkey"
            columns: ["previous_receipt_id"]
            isOneToOne: false
            referencedRelation: "smart_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _ot_visible_to_email: { Args: { _transfer_id: string }; Returns: string }
      admin_block_user: {
        Args: { _notes?: string; _reason: string; _user: string }
        Returns: undefined
      }
      admin_dashboard_stats: { Args: never; Returns: Json }
      admin_deactivate_user: {
        Args: { _notes?: string; _reason: string; _user: string }
        Returns: undefined
      }
      admin_execute_homolog_moto_deletion: {
        Args: { _moto: string; _reason: string; _storage_report?: Json }
        Returns: Json
      }
      admin_get_comm_settings: {
        Args: never
        Returns: {
          email_enabled: boolean
          email_from: string | null
          email_provider: string | null
          email_test_redirect: string | null
          homologation_mode: boolean
          id: number
          internal_enabled: boolean
          push_enabled: boolean
          sms_enabled: boolean
          updated_at: string
          updated_by: string | null
          whatsapp_enabled: boolean
        }
        SetofOptions: {
          from: "*"
          to: "comm_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_list_deliveries: {
        Args: { _limit?: number; _only_simulated?: boolean }
        Returns: {
          channel: Database["public"]["Enums"]["message_channel"]
          code: string
          created_at: string
          id: string
          message_id: string
          payload: Json
          simulated: boolean
          status: Database["public"]["Enums"]["delivery_status"]
          subject_text: string
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      admin_list_help_requests: {
        Args: { _limit?: number; _search?: string; _status?: string }
        Returns: {
          admin_notes: string | null
          birth_date: string | null
          code: string | null
          cpf: string | null
          created_at: string
          description: string
          email: string
          full_name: string
          id: string
          ip: string | null
          linked_user_id: string | null
          phone: string
          problem_other: string | null
          problem_type: Database["public"]["Enums"]["help_request_type"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["help_request_status"]
          updated_at: string
          user_agent: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "help_requests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_messages: {
        Args: {
          _automatic?: string
          _from?: string
          _limit?: number
          _priority?: string
          _search?: string
          _to?: string
          _type?: string
        }
        Returns: {
          audience: Database["public"]["Enums"]["message_audience"]
          body: string
          code: string
          created_at: string
          id: string
          is_automatic: boolean
          priority: Database["public"]["Enums"]["message_priority"]
          read_count: number
          recipients_count: number
          related_ticket_id: string
          sender_id: string
          sender_name: string
          status: Database["public"]["Enums"]["message_status"]
          subject_text: string
          type: Database["public"]["Enums"]["message_type"]
        }[]
      }
      admin_list_users: {
        Args: {
          _from?: string
          _has_documents?: boolean
          _has_moto?: boolean
          _has_ticket?: boolean
          _is_homologation?: boolean
          _limit?: number
          _login_provider?: string
          _plan?: string
          _role?: string
          _search?: string
          _status?: string
          _to?: string
        }
        Returns: {
          certificates_count: number
          cpf: string
          created_at: string
          documents_count: number
          email: string
          full_name: string
          id: string
          is_admin: boolean
          is_homologation: boolean
          last_seen_at: string
          login_provider: string
          motorcycles_count: number
          open_tickets: number
          phone: string
          plan: Database["public"]["Enums"]["plan_tier"]
          status: Database["public"]["Enums"]["user_status"]
          tickets_count: number
        }[]
      }
      admin_log_event: {
        Args: {
          _action: string
          _field?: string
          _metadata?: Json
          _new?: Json
          _notes?: string
          _old?: Json
          _reason?: string
          _snapshot?: Json
          _target: string
        }
        Returns: undefined
      }
      admin_log_view_as_user: {
        Args: { _action: string; _metadata?: Json }
        Returns: undefined
      }
      admin_message_thread: { Args: { _id: string }; Returns: Json }
      admin_motorcycle_impact: { Args: { _moto: string }; Returns: Json }
      admin_prepare_homolog_deletion: {
        Args: { _confirmation: string; _reason: string; _user: string }
        Returns: Json
      }
      admin_prepare_homolog_moto_deletion: {
        Args: { _confirmation: string; _moto: string; _reason: string }
        Returns: Json
      }
      admin_profile_snapshot: { Args: { _user: string }; Returns: Json }
      admin_reactivate_user: {
        Args: { _notes?: string; _user: string }
        Returns: undefined
      }
      admin_reply_message: {
        Args: { _body: string; _parent: string }
        Returns: string
      }
      admin_send_message: {
        Args: {
          _allow_reply: boolean
          _audience: Database["public"]["Enums"]["message_audience"]
          _body: string
          _channels: string[]
          _filter: Json
          _priority: Database["public"]["Enums"]["message_priority"]
          _related_ticket_id: string
          _subject_key: Database["public"]["Enums"]["message_subject_key"]
          _subject_other: string
          _type: Database["public"]["Enums"]["message_type"]
        }
        Returns: string
      }
      admin_set_motorcycle_homologation: {
        Args: { _flag: boolean; _moto: string; _reason?: string }
        Returns: undefined
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
      admin_update_comm_settings: {
        Args: { _json: Json }
        Returns: {
          email_enabled: boolean
          email_from: string | null
          email_provider: string | null
          email_test_redirect: string | null
          homologation_mode: boolean
          id: number
          internal_enabled: boolean
          push_enabled: boolean
          sms_enabled: boolean
          updated_at: string
          updated_by: string | null
          whatsapp_enabled: boolean
        }
        SetofOptions: {
          from: "*"
          to: "comm_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_help_request: {
        Args: { _id: string; _notes?: string; _status: string }
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
      admin_update_user: {
        Args: {
          _birth_date?: string
          _email?: string
          _full_name?: string
          _is_admin?: boolean
          _is_homologation?: boolean
          _phone?: string
          _plan?: string
          _reason?: string
          _status?: string
          _user: string
        }
        Returns: undefined
      }
      admin_user_audit: {
        Args: { _limit?: number; _user: string }
        Returns: {
          action: string
          actor_id: string | null
          created_at: string
          field: string | null
          id: string
          ip: string | null
          metadata: Json
          new_value: Json | null
          notes: string | null
          old_value: Json | null
          reason: string | null
          target_snapshot: Json | null
          target_user_id: string | null
          user_agent: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "admin_user_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_user_details: { Args: { _user: string }; Returns: Json }
      archive_motorcycle: {
        Args: { _moto_id: string; _reason?: string }
        Returns: Json
      }
      cancel_ownership_transfer: {
        Args: { _transfer_id: string }
        Returns: undefined
      }
      comm_expand_audience: {
        Args: {
          _audience: Database["public"]["Enums"]["message_audience"]
          _filter: Json
        }
        Returns: {
          user_id: string
        }[]
      }
      comm_subject_default: {
        Args: {
          _key: Database["public"]["Enums"]["message_subject_key"]
          _other: string
        }
        Returns: string
      }
      complete_signup_cpf: {
        Args: {
          _birth_date: string
          _cpf: string
          _full_name?: string
          _phone: string
        }
        Returns: undefined
      }
      count_active_admins: { Args: never; Returns: number }
      emit_system_message: {
        Args: {
          _body: string
          _priority?: Database["public"]["Enums"]["message_priority"]
          _related_ticket?: string
          _subject_key: Database["public"]["Enums"]["message_subject_key"]
          _subject_other: string
          _type: Database["public"]["Enums"]["message_type"]
          _user: string
        }
        Returns: string
      }
      get_email_by_cpf: { Args: { _cpf: string }; Returns: string }
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
      get_public_receipt: {
        Args: { _code: string }
        Returns: {
          amount: string | null
          buyer_cpf_masked: string | null
          buyer_name: string | null
          code: string | null
          issued_at: string | null
          moto_brand: string | null
          moto_chassis: string | null
          moto_model: string | null
          moto_year_model: string | null
          negotiation_date: string | null
          negotiation_location: string | null
          payment_method: string | null
          previous_receipt_id: string | null
          seller_cpf_masked: string | null
          seller_name: string | null
          sha256: string | null
          signed_at: string | null
          status: string | null
          version: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "public_receipt_validation"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_receipt_pdf_path: { Args: { _code: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_moto_owner: { Args: { _moto_id: string }; Returns: boolean }
      is_user_admin: { Args: { _user_id: string }; Returns: boolean }
      log_certificate_access: {
        Args: {
          _country?: string
          _ip?: string
          _referer?: string
          _token: string
          _user_agent?: string
        }
        Returns: undefined
      }
      me_access_status: { Args: never; Returns: Json }
      my_workshop_private: {
        Args: { _workshop: string }
        Returns: {
          cnpj: string
          id: string
          phone: string
        }[]
      }
      request_ownership_transfer: {
        Args: { _message: string; _moto_id: string; _to_email: string }
        Returns: string
      }
      respond_ownership_transfer: {
        Args: { _approve: boolean; _transfer_id: string }
        Returns: undefined
      }
      submit_help_request: {
        Args: {
          _birth_date: string
          _cpf: string
          _description: string
          _email: string
          _full_name: string
          _ip?: string
          _phone: string
          _problem_other?: string
          _problem_type: string
          _user_agent?: string
        }
        Returns: string
      }
      unarchive_motorcycle: { Args: { _moto_id: string }; Returns: Json }
      user_list_messages: {
        Args: { _filter?: string }
        Returns: {
          allow_reply: boolean
          body: string
          code: string
          created_at: string
          is_automatic: boolean
          message_id: string
          priority: Database["public"]["Enums"]["message_priority"]
          read_at: string
          related_ticket_id: string
          sender_id: string
          sender_name: string
          status: Database["public"]["Enums"]["recipient_status"]
          subject_text: string
          type: Database["public"]["Enums"]["message_type"]
        }[]
      }
      user_mark_message: {
        Args: { _action: string; _id: string }
        Returns: undefined
      }
      user_open_ticket_from_message: {
        Args: {
          _body: string
          _id: string
          _priority: string
          _subject: string
        }
        Returns: string
      }
      user_reply_message: {
        Args: { _body: string; _parent: string }
        Returns: string
      }
      user_unread_count: { Args: never; Returns: number }
      validate_cpf: { Args: { _cpf: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "mechanic" | "admin" | "USER_ADMIN"
      attachment_kind: "photo" | "video" | "document" | "invoice"
      audit_action: "insert" | "update" | "delete" | "archive" | "unarchive"
      control_type: "hours" | "km" | "both" | "not_informed"
      delivery_status:
        | "pending"
        | "sent"
        | "simulated"
        | "skipped_disabled"
        | "failed"
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
      help_request_status:
        | "open"
        | "in_analysis"
        | "waiting_user"
        | "resolved"
        | "closed"
        | "cancelled"
      help_request_type:
        | "forgot_access"
        | "cpf_exists"
        | "no_confirmation_email"
        | "changed_email"
        | "changed_phone"
        | "google_login_issue"
        | "account_blocked"
        | "other"
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
      media_kind: "photo" | "video"
      message_audience:
        | "single_user"
        | "by_status"
        | "by_role"
        | "homologation_users"
        | "open_tickets"
        | "email_unconfirmed"
        | "blocked_users"
        | "all_users"
      message_channel: "internal" | "email" | "whatsapp" | "push" | "sms"
      message_priority: "low" | "medium" | "high" | "critical"
      message_status:
        | "draft"
        | "sent"
        | "read"
        | "replied"
        | "archived"
        | "cancelled"
      message_subject_key:
        | "signup_confirmation"
        | "password_recovery"
        | "cpf_duplicate"
        | "email_not_confirmed"
        | "account_blocked"
        | "profile_update"
        | "document_pending"
        | "certificate"
        | "ticket"
        | "homologation"
        | "important_notice"
        | "other"
      message_type:
        | "system_notice"
        | "support"
        | "access"
        | "documentation"
        | "certificate"
        | "maintenance"
        | "financial"
        | "homologation"
        | "security"
        | "system_update"
        | "other"
      module_status: "active" | "maintenance" | "disabled" | "beta"
      motorcycle_document_type:
        | "invoice"
        | "manual"
        | "warranty"
        | "import"
        | "contract"
        | "other"
        | "bill_of_sale"
      motorcycle_origin_type:
        | "zero_km"
        | "private"
        | "dealer"
        | "trailbook_transfer"
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
      recipient_status: "sent" | "read" | "replied" | "archived"
      schedule_status:
        | "active"
        | "snoozed"
        | "ignored"
        | "done"
        | "no_info"
        | "not_applicable"
        | "custom"
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
      app_role: ["owner", "mechanic", "admin", "USER_ADMIN"],
      attachment_kind: ["photo", "video", "document", "invoice"],
      audit_action: ["insert", "update", "delete", "archive", "unarchive"],
      control_type: ["hours", "km", "both", "not_informed"],
      delivery_status: [
        "pending",
        "sent",
        "simulated",
        "skipped_disabled",
        "failed",
      ],
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
      help_request_status: [
        "open",
        "in_analysis",
        "waiting_user",
        "resolved",
        "closed",
        "cancelled",
      ],
      help_request_type: [
        "forgot_access",
        "cpf_exists",
        "no_confirmation_email",
        "changed_email",
        "changed_phone",
        "google_login_issue",
        "account_blocked",
        "other",
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
      media_kind: ["photo", "video"],
      message_audience: [
        "single_user",
        "by_status",
        "by_role",
        "homologation_users",
        "open_tickets",
        "email_unconfirmed",
        "blocked_users",
        "all_users",
      ],
      message_channel: ["internal", "email", "whatsapp", "push", "sms"],
      message_priority: ["low", "medium", "high", "critical"],
      message_status: [
        "draft",
        "sent",
        "read",
        "replied",
        "archived",
        "cancelled",
      ],
      message_subject_key: [
        "signup_confirmation",
        "password_recovery",
        "cpf_duplicate",
        "email_not_confirmed",
        "account_blocked",
        "profile_update",
        "document_pending",
        "certificate",
        "ticket",
        "homologation",
        "important_notice",
        "other",
      ],
      message_type: [
        "system_notice",
        "support",
        "access",
        "documentation",
        "certificate",
        "maintenance",
        "financial",
        "homologation",
        "security",
        "system_update",
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
        "bill_of_sale",
      ],
      motorcycle_origin_type: [
        "zero_km",
        "private",
        "dealer",
        "trailbook_transfer",
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
      recipient_status: ["sent", "read", "replied", "archived"],
      schedule_status: [
        "active",
        "snoozed",
        "ignored",
        "done",
        "no_info",
        "not_applicable",
        "custom",
      ],
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
