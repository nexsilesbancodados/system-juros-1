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
      chat_messages: {
        Row: {
          content: string
          created_at: string
          file_name: string | null
          file_type: string | null
          id: string
          reply_to: Json | null
          type: string
          user_avatar: string | null
          user_id: string
          user_name: string
        }
        Insert: {
          content: string
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          id?: string
          reply_to?: Json | null
          type?: string
          user_avatar?: string | null
          user_id: string
          user_name: string
        }
        Update: {
          content?: string
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          id?: string
          reply_to?: Json | null
          type?: string
          user_avatar?: string | null
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: Json | null
          avatar_url: string | null
          cellphone_sale: Json | null
          client_type: string
          cpf_cnpj: string | null
          created_at: string
          documents: Json | null
          email: string | null
          id: string
          loan: Json | null
          name: string
          phone: string | null
          status: string
          user_id: string
        }
        Insert: {
          address?: Json | null
          avatar_url?: string | null
          cellphone_sale?: Json | null
          client_type?: string
          cpf_cnpj?: string | null
          created_at?: string
          documents?: Json | null
          email?: string | null
          id?: string
          loan?: Json | null
          name: string
          phone?: string | null
          status?: string
          user_id: string
        }
        Update: {
          address?: Json | null
          avatar_url?: string | null
          cellphone_sale?: Json | null
          client_type?: string
          cpf_cnpj?: string | null
          created_at?: string
          documents?: Json | null
          email?: string | null
          id?: string
          loan?: Json | null
          name?: string
          phone?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      collectors: {
        Row: {
          city: string
          created_at: string
          id: string
          name: string
          phone: string
          state: string
          user_id: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          name: string
          phone: string
          state: string
          user_id: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          date: string
          description: string
          id: string
          receipt_url: string | null
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          date: string
          description: string
          id?: string
          receipt_url?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          receipt_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          current_amount: number
          description: string
          frequency: string
          id: string
          target_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          current_amount?: number
          description: string
          frequency: string
          id?: string
          target_amount: number
          user_id: string
        }
        Update: {
          created_at?: string
          current_amount?: number
          description?: string
          frequency?: string
          id?: string
          target_amount?: number
          user_id?: string
        }
        Relationships: []
      }
      installments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          due_date: string
          id: string
          installment_number: number
          paid_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          paid_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          paid_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          created_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          from: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          sent_at: string
          subscription_cycle: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          from?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          sent_at?: string
          subscription_cycle?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          from?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          sent_at?: string
          subscription_cycle?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pledges: {
        Row: {
          client_name: string
          created_at: string
          description: string
          estimated_value: number
          id: string
          notes: string | null
          photo_url: string | null
          pledge_date: string
          return_date: string | null
          status: string
          user_id: string
        }
        Insert: {
          client_name: string
          created_at?: string
          description: string
          estimated_value?: number
          id?: string
          notes?: string | null
          photo_url?: string | null
          pledge_date?: string
          return_date?: string | null
          status?: string
          user_id: string
        }
        Update: {
          client_name?: string
          created_at?: string
          description?: string
          estimated_value?: number
          id?: string
          notes?: string | null
          photo_url?: string | null
          pledge_date?: string
          return_date?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          billing_message: string | null
          created_at: string
          email: string | null
          expense_balance: number
          id: string
          is_admin: boolean
          is_blocked: boolean
          is_chat_blocked: boolean
          loan_balance: number
          name: string
          pix_key: string | null
          pix_key_type: string | null
          profit_balance: number
          subscription_expires_at: string | null
          subscription_type: string | null
        }
        Insert: {
          avatar_url?: string | null
          billing_message?: string | null
          created_at?: string
          email?: string | null
          expense_balance?: number
          id: string
          is_admin?: boolean
          is_blocked?: boolean
          is_chat_blocked?: boolean
          loan_balance?: number
          name?: string
          pix_key?: string | null
          pix_key_type?: string | null
          profit_balance?: number
          subscription_expires_at?: string | null
          subscription_type?: string | null
        }
        Update: {
          avatar_url?: string | null
          billing_message?: string | null
          created_at?: string
          email?: string | null
          expense_balance?: number
          id?: string
          is_admin?: boolean
          is_blocked?: boolean
          is_chat_blocked?: boolean
          loan_balance?: number
          name?: string
          pix_key?: string | null
          pix_key_type?: string | null
          profit_balance?: number
          subscription_expires_at?: string | null
          subscription_type?: string | null
        }
        Relationships: []
      }
      profits: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          date: string
          description: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string
          date?: string
          description: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      rentals: {
        Row: {
          client_id: string
          client_name: string
          created_at: string
          end_date: string
          id: string
          is_paid: boolean
          price: number
          rental_type: string
          start_date: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          client_id: string
          client_name: string
          created_at?: string
          end_date: string
          id?: string
          is_paid?: boolean
          price: number
          rental_type: string
          start_date: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          client_id?: string
          client_name?: string
          created_at?: string
          end_date?: string
          id?: string
          is_paid?: boolean
          price?: number
          rental_type?: string
          start_date?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          color: string
          cost_price: number
          created_at: string
          id: string
          imei: string
          model: string
          status: string
          storage: string
          user_id: string
        }
        Insert: {
          color: string
          cost_price: number
          created_at?: string
          id?: string
          imei: string
          model: string
          status?: string
          storage: string
          user_id: string
        }
        Update: {
          color?: string
          cost_price?: number
          created_at?: string
          id?: string
          imei?: string
          model?: string
          status?: string
          storage?: string
          user_id?: string
        }
        Relationships: []
      }
      todos: {
        Row: {
          created_at: string
          id: string
          is_complete: boolean
          task: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_complete?: boolean
          task?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_complete?: boolean
          task?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          brand: string
          created_at: string
          id: string
          model: string
          photo_url: string | null
          plate: string
          status: string
          type: string
          user_id: string
          year: number
        }
        Insert: {
          brand: string
          created_at?: string
          id?: string
          model: string
          photo_url?: string | null
          plate: string
          status?: string
          type: string
          user_id: string
          year: number
        }
        Update: {
          brand?: string
          created_at?: string
          id?: string
          model?: string
          photo_url?: string | null
          plate?: string
          status?: string
          type?: string
          user_id?: string
          year?: number
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
