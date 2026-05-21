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
      activities: {
        Row: {
          category: string
          created_at: string
          description: string
          event_date: string | null
          id: string
          image_url: string | null
          is_featured: boolean
          location: string | null
          published: boolean
          spots_remaining: number | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          event_date?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          location?: string | null
          published?: boolean
          spots_remaining?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          event_date?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          location?: string | null
          published?: boolean
          spots_remaining?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      application_forms: {
        Row: {
          created_at: string
          id: string
          published: boolean
          schema: Json
          tier: Database["public"]["Enums"]["membership_tier"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          published?: boolean
          schema?: Json
          tier: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          published?: boolean
          schema?: Json
          tier?: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      application_submissions: {
        Row: {
          answers: Json
          created_at: string
          id: string
          payment_id: string | null
          status: Database["public"]["Enums"]["application_status"]
          tier: Database["public"]["Enums"]["membership_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          payment_id?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          tier: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          payment_id?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          tier?: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      certificate_templates: {
        Row: {
          authorized_name: string | null
          created_at: string
          field_positions: Json
          id: string
          image_url: string
          is_active: boolean
          name: string
          signature_url: string | null
          tier: Database["public"]["Enums"]["membership_tier"]
          updated_at: string
        }
        Insert: {
          authorized_name?: string | null
          created_at?: string
          field_positions?: Json
          id?: string
          image_url: string
          is_active?: boolean
          name: string
          signature_url?: string | null
          tier: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string
        }
        Update: {
          authorized_name?: string | null
          created_at?: string
          field_positions?: Json
          id?: string
          image_url?: string
          is_active?: boolean
          name?: string
          signature_url?: string | null
          tier?: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          created_at: string
          expires_at: string
          full_name: string
          id: string
          issued_at: string
          member_id: string
          revoked: boolean
          template_id: string | null
          tier: Database["public"]["Enums"]["membership_tier"]
          user_id: string
          verification_code: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          full_name: string
          id?: string
          issued_at?: string
          member_id: string
          revoked?: boolean
          template_id?: string | null
          tier: Database["public"]["Enums"]["membership_tier"]
          user_id: string
          verification_code: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          full_name?: string
          id?: string
          issued_at?: string
          member_id?: string
          revoked?: boolean
          template_id?: string | null
          tier?: Database["public"]["Enums"]["membership_tier"]
          user_id?: string
          verification_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "certificate_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          created_at: string
          error: string | null
          fallback_used: boolean
          id: string
          provider: string
          status: string
          subject: string
          template_key: string | null
          to_email: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          fallback_used?: boolean
          id?: string
          provider: string
          status: string
          subject?: string
          template_key?: string | null
          to_email: string
        }
        Update: {
          created_at?: string
          error?: string | null
          fallback_used?: boolean
          id?: string
          provider?: string
          status?: string
          subject?: string
          template_key?: string | null
          to_email?: string
        }
        Relationships: []
      }
      email_settings: {
        Row: {
          id: string
          primary_provider: string
          resend_api_key: string | null
          resend_enabled: boolean
          resend_from: string | null
          singleton: boolean
          smtp_enabled: boolean
          smtp_from: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_secure: boolean
          smtp_user: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          primary_provider?: string
          resend_api_key?: string | null
          resend_enabled?: boolean
          resend_from?: string | null
          singleton?: boolean
          smtp_enabled?: boolean
          smtp_from?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean
          smtp_user?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          primary_provider?: string
          resend_api_key?: string | null
          resend_enabled?: boolean
          resend_from?: string | null
          singleton?: boolean
          smtp_enabled?: boolean
          smtp_from?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean
          smtp_user?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          blocks: Json
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
          subject?: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          media_type: Database["public"]["Enums"]["media_type"]
          published: boolean
          thumbnail_url: string | null
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          media_type?: Database["public"]["Enums"]["media_type"]
          published?: boolean
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          media_type?: Database["public"]["Enums"]["media_type"]
          published?: boolean
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      member_profiles: {
        Row: {
          company_name: string
          contact_name: string
          country: string
          created_at: string
          email: string
          id: string
          industry: string | null
          member_id: string | null
          notes: string | null
          phone: string
          products_exported: string | null
          status: Database["public"]["Enums"]["application_status"]
          subscription_expiry: string | null
          subscription_start: string | null
          tier: Database["public"]["Enums"]["membership_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string
          contact_name?: string
          country?: string
          created_at?: string
          email?: string
          id?: string
          industry?: string | null
          member_id?: string | null
          notes?: string | null
          phone?: string
          products_exported?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          subscription_expiry?: string | null
          subscription_start?: string | null
          tier?: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string
          contact_name?: string
          country?: string
          created_at?: string
          email?: string
          id?: string
          industry?: string | null
          member_id?: string | null
          notes?: string | null
          phone?: string
          products_exported?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          subscription_expiry?: string | null
          subscription_start?: string | null
          tier?: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      membership_applications: {
        Row: {
          admin_notes: string | null
          company_name: string
          contact_name: string
          country: string
          created_at: string
          email: string
          id: string
          industry: string | null
          message: string | null
          phone: string
          products_exported: string | null
          status: Database["public"]["Enums"]["application_status"]
          tier: Database["public"]["Enums"]["membership_tier"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          company_name: string
          contact_name: string
          country?: string
          created_at?: string
          email: string
          id?: string
          industry?: string | null
          message?: string | null
          phone: string
          products_exported?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          tier?: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          company_name?: string
          contact_name?: string
          country?: string
          created_at?: string
          email?: string
          id?: string
          industry?: string | null
          message?: string | null
          phone?: string
          products_exported?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          tier?: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      news: {
        Row: {
          author: string
          body: string
          category: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published: boolean
          published_at: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author?: string
          body?: string
          category?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string
          body?: string
          category?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payment_gateways: {
        Row: {
          bank_details: Json | null
          config: Json
          created_at: string
          display_order: number
          enabled: boolean
          id: string
          name: string
          provider: string
          updated_at: string
        }
        Insert: {
          bank_details?: Json | null
          config?: Json
          created_at?: string
          display_order?: number
          enabled?: boolean
          id?: string
          name: string
          provider: string
          updated_at?: string
        }
        Update: {
          bank_details?: Json | null
          config?: Json
          created_at?: string
          display_order?: number
          enabled?: boolean
          id?: string
          name?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_submissions: {
        Row: {
          admin_notes: string | null
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          currency: string
          duration_months: number
          gateway_id: string | null
          id: string
          kind: string
          member_message: string | null
          method: string
          pending_application_id: string | null
          proof_url: string | null
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          duration_months?: number
          gateway_id?: string | null
          id?: string
          kind?: string
          member_message?: string | null
          method: string
          pending_application_id?: string | null
          proof_url?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          duration_months?: number
          gateway_id?: string | null
          id?: string
          kind?: string
          member_message?: string | null
          method?: string
          pending_application_id?: string | null
          proof_url?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_submissions_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "payment_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_submissions_pending_application_id_fkey"
            columns: ["pending_application_id"]
            isOneToOne: false
            referencedRelation: "pending_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_applications: {
        Row: {
          claim_token: string
          company_name: string
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          phone: string
          plan_id: string | null
          status: string
          tier: string
          user_id: string | null
        }
        Insert: {
          claim_token?: string
          company_name?: string
          created_at?: string
          email: string
          expires_at?: string
          full_name: string
          id?: string
          phone: string
          plan_id?: string | null
          status?: string
          tier: string
          user_id?: string | null
        }
        Update: {
          claim_token?: string
          company_name?: string
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          phone?: string
          plan_id?: string | null
          status?: string
          tier?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_applications_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          description: string
          display_order: number
          features: string[]
          id: string
          image_url: string | null
          name: string
          published: boolean
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          display_order?: number
          features?: string[]
          id?: string
          image_url?: string | null
          name: string
          published?: boolean
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          display_order?: number
          features?: string[]
          id?: string
          image_url?: string | null
          name?: string
          published?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          active: boolean
          amount: number
          application_form_pdf_url: string | null
          bank_deposit_email: string | null
          currency: string
          description: string | null
          display_order: number
          duration_months: number
          id: string
          name: string | null
          post_download_message: string | null
          slug: string | null
          tier: Database["public"]["Enums"]["membership_tier"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount?: number
          application_form_pdf_url?: string | null
          bank_deposit_email?: string | null
          currency?: string
          description?: string | null
          display_order?: number
          duration_months?: number
          id?: string
          name?: string | null
          post_download_message?: string | null
          slug?: string | null
          tier: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          application_form_pdf_url?: string | null
          bank_deposit_email?: string | null
          currency?: string
          description?: string | null
          display_order?: number
          duration_months?: number
          id?: string
          name?: string | null
          post_download_message?: string | null
          slug?: string | null
          tier?: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          created_at: string
          id: string
          priority: string
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          priority?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          priority?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_admin: boolean
          sender_id: string
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_admin?: boolean
          sender_id: string
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_admin?: boolean
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exec_sql: { Args: { sql: string }; Returns: undefined }
      admin_list_enums: { Args: never; Returns: Json }
      admin_list_functions: { Args: never; Returns: Json }
      admin_list_policies: { Args: never; Returns: Json }
      admin_list_sequences: { Args: never; Returns: Json }
      admin_list_tables: { Args: never; Returns: Json }
      generate_member_id: {
        Args: { _tier: Database["public"]["Enums"]["membership_tier"] }
        Returns: string
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
      app_role: "admin" | "editor" | "user"
      application_status: "new" | "reviewing" | "approved" | "rejected"
      media_type: "photo" | "video"
      membership_tier: "associate" | "corporate" | "standard"
      payment_status: "pending" | "confirmed" | "rejected"
      ticket_status: "open" | "pending" | "resolved" | "closed"
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
      app_role: ["admin", "editor", "user"],
      application_status: ["new", "reviewing", "approved", "rejected"],
      media_type: ["photo", "video"],
      membership_tier: ["associate", "corporate", "standard"],
      payment_status: ["pending", "confirmed", "rejected"],
      ticket_status: ["open", "pending", "resolved", "closed"],
    },
  },
} as const
