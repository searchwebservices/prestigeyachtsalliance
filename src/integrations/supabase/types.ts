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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      booking_rate_limits: {
        Row: {
          created_at: string
          email_hash: string
          id: string
          ip_hash: string
          request_id: string | null
        }
        Insert: {
          created_at?: string
          email_hash: string
          id?: string
          ip_hash: string
          request_id?: string | null
        }
        Update: {
          created_at?: string
          email_hash?: string
          id?: string
          ip_hash?: string
          request_id?: string | null
        }
        Relationships: []
      }
      booking_request_logs: {
        Row: {
          created_at: string
          details: Json | null
          endpoint: string
          id: string
          request_id: string
          status_code: number
        }
        Insert: {
          created_at?: string
          details?: Json | null
          endpoint: string
          id?: string
          request_id: string
          status_code: number
        }
        Update: {
          created_at?: string
          details?: Json | null
          endpoint?: string
          id?: string
          request_id?: string
          status_code?: number
        }
        Relationships: []
      }
      booking_webhook_events: {
        Row: {
          booking_uid: string | null
          event_type: string | null
          id: string
          payload: Json
          received_at: string
        }
        Insert: {
          booking_uid?: string | null
          event_type?: string | null
          id?: string
          payload: Json
          received_at?: string
        }
        Update: {
          booking_uid?: string | null
          event_type?: string | null
          id?: string
          payload?: Json
          received_at?: string
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          base_currency: string
          created_at: string
          fetched_at: string
          id: string
          rate: number
          target_currency: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          fetched_at?: string
          id?: string
          rate: number
          target_currency?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          fetched_at?: string
          id?: string
          rate?: number
          target_currency?: string
        }
        Relationships: []
      }
      guest_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          full_name: string
          id: string
          nationality: string
          notes: string
          phone: string
          preferred_language: string
          preferred_name: string
          updated_at: string
          updated_by: string | null
          whatsapp: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          nationality?: string
          notes?: string
          phone?: string
          preferred_language?: string
          preferred_name?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          nationality?: string
          notes?: string
          phone?: string
          preferred_language?: string
          preferred_name?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone_number: string | null
          preferred_language: string
          preferred_theme: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone_number?: string | null
          preferred_language?: string
          preferred_theme?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone_number?: string | null
          preferred_language?: string
          preferred_theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      reservation_change_log: {
        Row: {
          action: string
          actor_user_id: string | null
          booking_uid: string
          created_at: string
          id: string
          payload: Json
          reservation_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          booking_uid: string
          created_at?: string
          id?: string
          payload?: Json
          reservation_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          booking_uid?: string
          created_at?: string
          id?: string
          payload?: Json
          reservation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_change_log_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservation_details"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_details: {
        Row: {
          adult_count: number | null
          allergies: string[]
          booking_uid_current: string
          booking_uid_history: string[]
          concierge_notes: string
          created_at: string
          created_by: string | null
          dietary_notes: string
          end_at: string
          guest_count: number | null
          guest_profile_id: string | null
          id: string
          internal_notes: string
          kids_count: number | null
          kids_notes: string
          mobility_notes: string
          occasion_notes: string
          preferences: string[]
          source: string
          start_at: string
          status: string
          staying_multiple_places: boolean
          updated_at: string
          updated_by: string | null
          yacht_name: string
          yacht_slug: string
        }
        Insert: {
          adult_count?: number | null
          allergies?: string[]
          booking_uid_current: string
          booking_uid_history?: string[]
          concierge_notes?: string
          created_at?: string
          created_by?: string | null
          dietary_notes?: string
          end_at: string
          guest_count?: number | null
          guest_profile_id?: string | null
          id?: string
          internal_notes?: string
          kids_count?: number | null
          kids_notes?: string
          mobility_notes?: string
          occasion_notes?: string
          preferences?: string[]
          source?: string
          start_at: string
          status?: string
          staying_multiple_places?: boolean
          updated_at?: string
          updated_by?: string | null
          yacht_name?: string
          yacht_slug: string
        }
        Update: {
          adult_count?: number | null
          allergies?: string[]
          booking_uid_current?: string
          booking_uid_history?: string[]
          concierge_notes?: string
          created_at?: string
          created_by?: string | null
          dietary_notes?: string
          end_at?: string
          guest_count?: number | null
          guest_profile_id?: string | null
          id?: string
          internal_notes?: string
          kids_count?: number | null
          kids_notes?: string
          mobility_notes?: string
          occasion_notes?: string
          preferences?: string[]
          source?: string
          start_at?: string
          status?: string
          staying_multiple_places?: boolean
          updated_at?: string
          updated_by?: string | null
          yacht_name?: string
          yacht_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_details_guest_profile_id_fkey"
            columns: ["guest_profile_id"]
            isOneToOne: false
            referencedRelation: "guest_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_stays: {
        Row: {
          check_in_date: string | null
          check_out_date: string | null
          created_at: string
          id: string
          location_label: string
          notes: string
          property_name: string
          reservation_id: string
          sort_order: number
          unit_or_room: string
          updated_at: string
        }
        Insert: {
          check_in_date?: string | null
          check_out_date?: string | null
          created_at?: string
          id?: string
          location_label?: string
          notes?: string
          property_name?: string
          reservation_id: string
          sort_order?: number
          unit_or_room?: string
          updated_at?: string
        }
        Update: {
          check_in_date?: string | null
          check_out_date?: string | null
          created_at?: string
          id?: string
          location_label?: string
          notes?: string
          property_name?: string
          reservation_id?: string
          sort_order?: number
          unit_or_room?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_stays_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservation_details"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          user_id?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      yacht_images: {
        Row: {
          alt_text: string | null
          created_at: string
          display_order: number | null
          id: string
          image_url: string
          is_primary: boolean | null
          yacht_id: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          image_url: string
          is_primary?: boolean | null
          yacht_id: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          image_url?: string
          is_primary?: boolean | null
          yacht_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "yacht_images_yacht_id_fkey"
            columns: ["yacht_id"]
            isOneToOne: false
            referencedRelation: "yachts"
            referencedColumns: ["id"]
          },
        ]
      }
      yachts: {
        Row: {
          booking_mode: string
          booking_public_enabled: boolean
          booking_v2_live_from: string | null
          cal_embed_url: string | null
          cal_event_type_id: number | null
          capacity: number
          commission_amount: number | null
          created_at: string
          display_order: number | null
          id: string
          is_flagship: boolean | null
          name: string
          owner_notes: string | null
          public_price: number | null
          sales_description: string | null
          slug: string
          team_description: string | null
          updated_at: string
          vessel_type: string
        }
        Insert: {
          booking_mode?: string
          booking_public_enabled?: boolean
          booking_v2_live_from?: string | null
          cal_embed_url?: string | null
          cal_event_type_id?: number | null
          capacity?: number
          commission_amount?: number | null
          created_at?: string
          display_order?: number | null
          id?: string
          is_flagship?: boolean | null
          name: string
          owner_notes?: string | null
          public_price?: number | null
          sales_description?: string | null
          slug: string
          team_description?: string | null
          updated_at?: string
          vessel_type: string
        }
        Update: {
          booking_mode?: string
          booking_public_enabled?: boolean
          booking_v2_live_from?: string | null
          cal_embed_url?: string | null
          cal_event_type_id?: number | null
          capacity?: number
          commission_amount?: number | null
          created_at?: string
          display_order?: number | null
          id?: string
          is_flagship?: boolean | null
          name?: string
          owner_notes?: string | null
          public_price?: number | null
          sales_description?: string | null
          slug?: string
          team_description?: string | null
          updated_at?: string
          vessel_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff"
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
      app_role: ["admin", "staff"],
    },
  },
} as const
