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
      active_vehicles: {
        Row: {
          advance_amount: number | null
          advance_paid: boolean | null
          created_at: string | null
          daily_rate: number
          driver_mobile: string
          entry_time: string
          expected_exit: string | null
          id: string
          notes: string | null
          num_wheels: number
          payment_mode: string
          payment_status: string
          pricing_category: string
          vehicle_number: string
        }
        Insert: {
          advance_amount?: number | null
          advance_paid?: boolean | null
          created_at?: string | null
          daily_rate: number
          driver_mobile: string
          entry_time?: string
          expected_exit?: string | null
          id?: string
          notes?: string | null
          num_wheels: number
          payment_mode: string
          payment_status: string
          pricing_category: string
          vehicle_number: string
        }
        Update: {
          advance_amount?: number | null
          advance_paid?: boolean | null
          created_at?: string | null
          daily_rate?: number
          driver_mobile?: string
          entry_time?: string
          expected_exit?: string | null
          id?: string
          notes?: string | null
          num_wheels?: number
          payment_mode?: string
          payment_status?: string
          pricing_category?: string
          vehicle_number?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          advance_warning_hours: number | null
          created_at: string | null
          facility_name: string | null
          id: string
          max_stay_days: number | null
        }
        Insert: {
          advance_warning_hours?: number | null
          created_at?: string | null
          facility_name?: string | null
          id?: string
          max_stay_days?: number | null
        }
        Update: {
          advance_warning_hours?: number | null
          created_at?: string | null
          facility_name?: string | null
          id?: string
          max_stay_days?: number | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          history_vehicle_id: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_mode: string
          payment_type: string
          vehicle_id: string | null
          vehicle_number: string
        }
        Insert: {
          amount: number
          history_vehicle_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_mode: string
          payment_type: string
          vehicle_id?: string | null
          vehicle_number: string
        }
        Update: {
          amount?: number
          history_vehicle_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_mode?: string
          payment_type?: string
          vehicle_id?: string | null
          vehicle_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "active_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_history: {
        Row: {
          advance_paid_amount: number | null
          balance_amount: number
          created_at: string | null
          daily_rate: number
          driver_mobile: string
          entry_time: string
          exit_payment_mode: string | null
          exit_time: string
          final_payment_status: string
          gross_amount: number
          id: string
          num_wheels: number
          payment_mode: string
          pricing_category: string
          total_days_billed: number | null
          total_hours: number | null
          vehicle_number: string
        }
        Insert: {
          advance_paid_amount?: number | null
          balance_amount: number
          created_at?: string | null
          daily_rate: number
          driver_mobile: string
          entry_time: string
          exit_payment_mode?: string | null
          exit_time: string
          final_payment_status: string
          gross_amount: number
          id?: string
          num_wheels: number
          payment_mode: string
          pricing_category: string
          total_days_billed?: number | null
          total_hours?: number | null
          vehicle_number: string
        }
        Update: {
          advance_paid_amount?: number | null
          balance_amount?: number
          created_at?: string | null
          daily_rate?: number
          driver_mobile?: string
          entry_time?: string
          exit_payment_mode?: string | null
          exit_time?: string
          final_payment_status?: string
          gross_amount?: number
          id?: string
          num_wheels?: number
          payment_mode?: string
          pricing_category?: string
          total_days_billed?: number | null
          total_hours?: number | null
          vehicle_number?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
