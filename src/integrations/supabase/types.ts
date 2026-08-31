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
      brand_members: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["brand_role"]
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["brand_role"]
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["brand_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_members_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          accent: string
          created_at: string
          created_by: string
          id: string
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          accent?: string
          created_at?: string
          created_by?: string
          id?: string
          name: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          accent?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      channel_accounts: {
        Row: {
          account_name: string
          avatar_url: string | null
          brand_id: string
          connected: boolean
          connected_at: string | null
          created_at: string
          external_id: string | null
          id: string
          last_error: string | null
          platform: Database["public"]["Enums"]["platform"]
          updated_at: string
        }
        Insert: {
          account_name: string
          avatar_url?: string | null
          brand_id: string
          connected?: boolean
          connected_at?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          last_error?: string | null
          platform: Database["public"]["Enums"]["platform"]
          updated_at?: string
        }
        Update: {
          account_name?: string
          avatar_url?: string | null
          brand_id?: string
          connected?: boolean
          connected_at?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          last_error?: string | null
          platform?: Database["public"]["Enums"]["platform"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_accounts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_credentials: {
        Row: {
          access_token: string
          channel_account_id: string
          connected_by: string | null
          external_id: string | null
          meta: Json
          platform: Database["public"]["Enums"]["platform"]
          refresh_expires_at: string | null
          refresh_token: string | null
          scopes: string[]
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          channel_account_id: string
          connected_by?: string | null
          external_id?: string | null
          meta?: Json
          platform: Database["public"]["Enums"]["platform"]
          refresh_expires_at?: string | null
          refresh_token?: string | null
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          channel_account_id?: string
          connected_by?: string | null
          external_id?: string | null
          meta?: Json
          platform?: Database["public"]["Enums"]["platform"]
          refresh_expires_at?: string | null
          refresh_token?: string | null
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_credentials_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: true
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_sessions: {
        Row: {
          accounts: Json | null
          brand_id: string
          created_at: string
          error_message: string | null
          expires_at: string
          platform: Database["public"]["Enums"]["platform"]
          state: string
          status: string
          token_expires_at: string | null
          user_access_token: string | null
          user_id: string
        }
        Insert: {
          accounts?: Json | null
          brand_id: string
          created_at?: string
          error_message?: string | null
          expires_at?: string
          platform: Database["public"]["Enums"]["platform"]
          state: string
          status?: string
          token_expires_at?: string | null
          user_access_token?: string | null
          user_id: string
        }
        Update: {
          accounts?: Json | null
          brand_id?: string
          created_at?: string
          error_message?: string | null
          expires_at?: string
          platform?: Database["public"]["Enums"]["platform"]
          state?: string
          status?: string
          token_expires_at?: string | null
          user_access_token?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_sessions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      post_targets: {
        Row: {
          attempt_count: number
          channel_account_id: string | null
          created_at: string
          error_message: string | null
          external_id: string | null
          external_url: string | null
          id: string
          last_attempt_at: string | null
          override_body: string | null
          pending_external_id: string | null
          platform: Database["public"]["Enums"]["platform"]
          post_id: string
          published_at: string | null
          status: Database["public"]["Enums"]["target_status"]
          tiktok_options: Json | null
          updated_at: string
          youtube_options: Json | null
        }
        Insert: {
          attempt_count?: number
          channel_account_id?: string | null
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          last_attempt_at?: string | null
          override_body?: string | null
          pending_external_id?: string | null
          platform: Database["public"]["Enums"]["platform"]
          post_id: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["target_status"]
          tiktok_options?: Json | null
          updated_at?: string
          youtube_options?: Json | null
        }
        Update: {
          attempt_count?: number
          channel_account_id?: string | null
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          last_attempt_at?: string | null
          override_body?: string | null
          pending_external_id?: string | null
          platform?: Database["public"]["Enums"]["platform"]
          post_id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["target_status"]
          tiktok_options?: Json | null
          updated_at?: string
          youtube_options?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "post_targets_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: false
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_targets_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body: string
          brand_id: string
          created_at: string
          created_by: string
          id: string
          media_url: string | null
          media_urls: string[]
          published_at: string | null
          publishing_started_at: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["post_status"]
          title: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          brand_id: string
          created_at?: string
          created_by?: string
          id?: string
          media_url?: string | null
          media_urls?: string[]
          published_at?: string | null
          publishing_started_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          brand_id?: string
          created_at?: string
          created_by?: string
          id?: string
          media_url?: string | null
          media_urls?: string[]
          published_at?: string | null
          publishing_started_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_brand: { Args: { _brand_id: string }; Returns: boolean }
      purge_expired_oauth_sessions: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "approver" | "editor"
      brand_role: "owner" | "approver" | "editor"
      platform: "facebook" | "instagram" | "tiktok" | "youtube" | "line"
      post_status:
        | "draft"
        | "pending"
        | "approved"
        | "publishing"
        | "published"
        | "failed"
      target_status: "queued" | "publishing" | "published" | "failed"
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
      app_role: ["admin", "approver", "editor"],
      brand_role: ["owner", "approver", "editor"],
      platform: ["facebook", "instagram", "tiktok", "youtube", "line"],
      post_status: [
        "draft",
        "pending",
        "approved",
        "publishing",
        "published",
        "failed",
      ],
      target_status: ["queued", "publishing", "published", "failed"],
    },
  },
} as const
