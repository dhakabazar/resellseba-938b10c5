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
      brands: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          meta_description: string | null
          meta_title: string | null
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          meta_description: string | null
          meta_title: string | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      global_settings: {
        Row: {
          accent_color: string | null
          contact_email: string | null
          contact_phone: string | null
          favicon_url: string | null
          id: number
          logo_url: string | null
          meta_description: string | null
          meta_title_template: string | null
          og_image_url: string | null
          primary_color: string | null
          site_name: string
          tagline: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          favicon_url?: string | null
          id?: number
          logo_url?: string | null
          meta_description?: string | null
          meta_title_template?: string | null
          og_image_url?: string | null
          primary_color?: string | null
          site_name?: string
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          favicon_url?: string | null
          id?: number
          logo_url?: string | null
          meta_description?: string | null
          meta_title_template?: string | null
          og_image_url?: string | null
          primary_color?: string | null
          site_name?: string
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          is_primary: boolean
          product_id: string
          sort_order: number
          url: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
          url: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string | null
          buying_price: number
          category_id: string | null
          created_at: string
          delivery_inside: number
          delivery_outside: number
          description: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          keywords: string | null
          meta_description: string | null
          meta_title: string | null
          min_selling_price: number
          name: string
          og_image_url: string | null
          packaging_cost: number
          short_description: string | null
          sku: string | null
          slug: string
          stock: number
          suggested_price: number
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          brand_id?: string | null
          buying_price?: number
          category_id?: string | null
          created_at?: string
          delivery_inside?: number
          delivery_outside?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          keywords?: string | null
          meta_description?: string | null
          meta_title?: string | null
          min_selling_price?: number
          name: string
          og_image_url?: string | null
          packaging_cost?: number
          short_description?: string | null
          sku?: string | null
          slug: string
          stock?: number
          suggested_price?: number
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          brand_id?: string | null
          buying_price?: number
          category_id?: string | null
          created_at?: string
          delivery_inside?: number
          delivery_outside?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          keywords?: string | null
          meta_description?: string | null
          meta_title?: string | null
          min_selling_price?: number
          name?: string
          og_image_url?: string | null
          packaging_cost?: number
          short_description?: string | null
          sku?: string | null
          slug?: string
          stock?: number
          suggested_price?: number
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
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
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reseller_domains: {
        Row: {
          cloudflare_hostname_id: string | null
          created_at: string
          hostname: string
          id: string
          is_primary: boolean
          reseller_id: string
          ssl_status: string
          verified_at: string | null
        }
        Insert: {
          cloudflare_hostname_id?: string | null
          created_at?: string
          hostname: string
          id?: string
          is_primary?: boolean
          reseller_id: string
          ssl_status?: string
          verified_at?: string | null
        }
        Update: {
          cloudflare_hostname_id?: string | null
          created_at?: string
          hostname?: string
          id?: string
          is_primary?: boolean
          reseller_id?: string
          ssl_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reseller_domains_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_listings: {
        Row: {
          created_at: string
          custom_description: string | null
          custom_title: string | null
          extra_delivery_inside: number
          extra_delivery_outside: number
          id: string
          is_active: boolean
          meta_description: string | null
          meta_title: string | null
          product_id: string
          reseller_id: string
          selling_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_description?: string | null
          custom_title?: string | null
          extra_delivery_inside?: number
          extra_delivery_outside?: number
          id?: string
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          product_id: string
          reseller_id: string
          selling_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_description?: string | null
          custom_title?: string | null
          extra_delivery_inside?: number
          extra_delivery_outside?: number
          id?: string
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          product_id?: string
          reseller_id?: string
          selling_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_listings_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_settings: {
        Row: {
          accent_color: string | null
          facebook_url: string | null
          favicon_url: string | null
          footer_text: string | null
          instagram_url: string | null
          logo_url: string | null
          meta_description: string | null
          og_image_url: string | null
          primary_color: string | null
          reseller_id: string
          store_name: string
          tagline: string | null
          tiktok_url: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          accent_color?: string | null
          facebook_url?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          instagram_url?: string | null
          logo_url?: string | null
          meta_description?: string | null
          og_image_url?: string | null
          primary_color?: string | null
          reseller_id: string
          store_name: string
          tagline?: string | null
          tiktok_url?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          accent_color?: string | null
          facebook_url?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          instagram_url?: string | null
          logo_url?: string | null
          meta_description?: string | null
          og_image_url?: string | null
          primary_color?: string | null
          reseller_id?: string
          store_name?: string
          tagline?: string | null
          tiktok_url?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reseller_settings_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: true
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      resellers: {
        Row: {
          address: string | null
          approved_at: string | null
          approved_by: string | null
          business_name: string
          code: string
          commission_rate: number
          contact_phone: string | null
          created_at: string
          id: string
          leader_id: string | null
          nid_number: string | null
          notes: string | null
          status: Database["public"]["Enums"]["reseller_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          business_name: string
          code: string
          commission_rate?: number
          contact_phone?: string | null
          created_at?: string
          id?: string
          leader_id?: string | null
          nid_number?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["reseller_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          business_name?: string
          code?: string
          commission_rate?: number
          contact_phone?: string | null
          created_at?: string
          id?: string
          leader_id?: string | null
          nid_number?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["reseller_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resellers_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "resellers"
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
      current_reseller_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "reseller" | "leader" | "staff"
      reseller_status: "pending" | "active" | "suspended" | "rejected"
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
      app_role: ["super_admin", "reseller", "leader", "staff"],
      reseller_status: ["pending", "active", "suspended", "rejected"],
    },
  },
} as const
