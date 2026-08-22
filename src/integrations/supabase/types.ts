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
      agent_payouts: {
        Row: {
          admin_note: string | null
          agent_id: string
          amount: number
          approved_at: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          method: string | null
          note: string | null
          paid_at: string | null
          period_from: string | null
          period_to: string | null
          reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          agent_id: string
          amount: number
          approved_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          method?: string | null
          note?: string | null
          paid_at?: string | null
          period_from?: string | null
          period_to?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          agent_id?: string
          amount?: number
          approved_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          method?: string | null
          note?: string | null
          paid_at?: string | null
          period_from?: string | null
          period_to?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_payouts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          commission_rate: number
          created_at: string
          display_name: string
          email: string | null
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          sale_target: number
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          sale_target?: number
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          commission_rate?: number
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          sale_target?: number
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
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
      cloudflare_config: {
        Row: {
          a_record_ip: string | null
          account_id: string | null
          api_token: string | null
          auto_worker_domain: boolean
          cname_target: string | null
          dns_active: boolean
          id: number
          is_active: boolean
          mode: string
          server_a_ip: string | null
          server_cname: string | null
          server_note: string | null
          updated_at: string
          worker_name: string | null
          zone_id: string | null
          zone_name: string | null
        }
        Insert: {
          a_record_ip?: string | null
          account_id?: string | null
          api_token?: string | null
          auto_worker_domain?: boolean
          cname_target?: string | null
          dns_active?: boolean
          id?: number
          is_active?: boolean
          mode?: string
          server_a_ip?: string | null
          server_cname?: string | null
          server_note?: string | null
          updated_at?: string
          worker_name?: string | null
          zone_id?: string | null
          zone_name?: string | null
        }
        Update: {
          a_record_ip?: string | null
          account_id?: string | null
          api_token?: string | null
          auto_worker_domain?: boolean
          cname_target?: string | null
          dns_active?: boolean
          id?: number
          is_active?: boolean
          mode?: string
          server_a_ip?: string | null
          server_cname?: string | null
          server_note?: string | null
          updated_at?: string
          worker_name?: string | null
          zone_id?: string | null
          zone_name?: string | null
        }
        Relationships: []
      }
      courier_configs: {
        Row: {
          config: Json
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          provider: Database["public"]["Enums"]["courier_provider"]
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          provider: Database["public"]["Enums"]["courier_provider"]
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          provider?: Database["public"]["Enums"]["courier_provider"]
          updated_at?: string
        }
        Relationships: []
      }
      courier_events: {
        Row: {
          cod_amount: number | null
          consignment_id: string | null
          courier_status: string
          created_at: string
          delivery_charge: number | null
          event_at: string
          id: string
          note: string | null
          notification_type: string | null
          order_id: string
          payload: Json
          provider: Database["public"]["Enums"]["courier_provider"]
          shipment_id: string | null
          source: string
          tracking_code: string | null
        }
        Insert: {
          cod_amount?: number | null
          consignment_id?: string | null
          courier_status: string
          created_at?: string
          delivery_charge?: number | null
          event_at?: string
          id?: string
          note?: string | null
          notification_type?: string | null
          order_id: string
          payload?: Json
          provider?: Database["public"]["Enums"]["courier_provider"]
          shipment_id?: string | null
          source?: string
          tracking_code?: string | null
        }
        Update: {
          cod_amount?: number | null
          consignment_id?: string | null
          courier_status?: string
          created_at?: string
          delivery_charge?: number | null
          event_at?: string
          id?: string
          note?: string | null
          notification_type?: string | null
          order_id?: string
          payload?: Json
          provider?: Database["public"]["Enums"]["courier_provider"]
          shipment_id?: string | null
          source?: string
          tracking_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          id: string
          method: string | null
          note: string | null
          reference: string | null
          spent_on: string
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          note?: string | null
          reference?: string | null
          spent_on?: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          note?: string | null
          reference?: string | null
          spent_on?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      global_settings: {
        Row: {
          accent_color: string | null
          advanced_settings: Json
          contact_email: string | null
          contact_phone: string | null
          deposit_default_amount: number
          deposit_default_frozen: number
          deposit_texts: Json
          deposit_trigger_default_on: boolean
          favicon_url: string | null
          flagship_reseller_code: string | null
          id: number
          label_size: string
          landing_content: Json
          logo_url: string | null
          meta_description: string | null
          meta_title_template: string | null
          og_image_url: string | null
          primary_color: string | null
          privacy_policy: string | null
          site_name: string
          tagline: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          advanced_settings?: Json
          contact_email?: string | null
          contact_phone?: string | null
          deposit_default_amount?: number
          deposit_default_frozen?: number
          deposit_texts?: Json
          deposit_trigger_default_on?: boolean
          favicon_url?: string | null
          flagship_reseller_code?: string | null
          id?: number
          label_size?: string
          landing_content?: Json
          logo_url?: string | null
          meta_description?: string | null
          meta_title_template?: string | null
          og_image_url?: string | null
          primary_color?: string | null
          privacy_policy?: string | null
          site_name?: string
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          advanced_settings?: Json
          contact_email?: string | null
          contact_phone?: string | null
          deposit_default_amount?: number
          deposit_default_frozen?: number
          deposit_texts?: Json
          deposit_trigger_default_on?: boolean
          favicon_url?: string | null
          flagship_reseller_code?: string | null
          id?: number
          label_size?: string
          landing_content?: Json
          logo_url?: string | null
          meta_description?: string | null
          meta_title_template?: string | null
          og_image_url?: string | null
          primary_color?: string | null
          privacy_policy?: string | null
          site_name?: string
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      leader_commissions: {
        Row: {
          amount: number
          base_profit: number
          created_at: string
          id: string
          leader_id: string
          order_id: string
          paid_at: string | null
          rate: number
          reseller_id: string
          status: string
        }
        Insert: {
          amount: number
          base_profit: number
          created_at?: string
          id?: string
          leader_id: string
          order_id: string
          paid_at?: string | null
          rate: number
          reseller_id: string
          status?: string
        }
        Update: {
          amount?: number
          base_profit?: number
          created_at?: string
          id?: string
          leader_id?: string
          order_id?: string
          paid_at?: string | null
          rate?: number
          reseller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leader_commissions_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "public_stores"
            referencedColumns: ["reseller_id"]
          },
          {
            foreignKeyName: "leader_commissions_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leader_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leader_commissions_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "public_stores"
            referencedColumns: ["reseller_id"]
          },
          {
            foreignKeyName: "leader_commissions_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_configs: {
        Row: {
          access_token: string | null
          created_at: string
          extra: Json
          id: string
          is_active: boolean
          pixel_id: string | null
          platform: string
          reseller_id: string | null
          test_event_code: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          extra?: Json
          id?: string
          is_active?: boolean
          pixel_id?: string | null
          platform: string
          reseller_id?: string | null
          test_event_code?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          extra?: Json
          id?: string
          is_active?: boolean
          pixel_id?: string | null
          platform?: string
          reseller_id?: string | null
          test_event_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_configs_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "public_stores"
            referencedColumns: ["reseller_id"]
          },
          {
            foreignKeyName: "marketing_configs_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_configs: {
        Row: {
          channel: string
          config: Json
          created_at: string
          from_name: string | null
          from_value: string | null
          id: string
          is_active: boolean
          provider: string
          reseller_id: string | null
          updated_at: string
        }
        Insert: {
          channel: string
          config?: Json
          created_at?: string
          from_name?: string | null
          from_value?: string | null
          id?: string
          is_active?: boolean
          provider: string
          reseller_id?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          config?: Json
          created_at?: string
          from_name?: string | null
          from_value?: string | null
          id?: string
          is_active?: boolean
          provider?: string
          reseller_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_configs_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "public_stores"
            referencedColumns: ["reseller_id"]
          },
          {
            foreignKeyName: "notification_configs_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          id: string
          order_id: string | null
          payload: Json | null
          recipient: string
          reseller_id: string | null
          status: string
          template: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string | null
          payload?: Json | null
          recipient: string
          reseller_id?: string | null
          status?: string
          template?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string | null
          payload?: Json | null
          recipient?: string
          reseller_id?: string | null
          status?: string
          template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "public_stores"
            referencedColumns: ["reseller_id"]
          },
          {
            foreignKeyName: "notification_logs_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          listing_id: string | null
          order_id: string
          product_id: string | null
          product_image: string | null
          product_name: string
          profit: number
          quantity: number
          reseller_price: number
          returned_qty: number
          sa_price: number
          sku: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number
          listing_id?: string | null
          order_id: string
          product_id?: string | null
          product_image?: string | null
          product_name: string
          profit?: number
          quantity?: number
          reseller_price?: number
          returned_qty?: number
          sa_price?: number
          sku?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          listing_id?: string | null
          order_id?: string
          product_id?: string | null
          product_image?: string | null
          product_name?: string
          profit?: number
          quantity?: number
          reseller_price?: number
          returned_qty?: number
          sa_price?: number
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "reseller_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          note: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_line: string
          admin_note: string | null
          advance_amount: number
          advance_by: string | null
          area: Database["public"]["Enums"]["delivery_area"]
          city: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          damage_note: string | null
          delivery_cost: number
          discount: number
          forwarded_at: string | null
          forwarded_to_admin: boolean
          id: string
          landmark: string | null
          notes: string | null
          order_number: string
          packaging_total: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          received_amount: number | null
          reseller_id: string | null
          reseller_note: string | null
          reseller_profit: number
          sa_cost_total: number
          settled_at: string | null
          settled_by: string | null
          settlement_note: string | null
          shipping_cost: number
          status: Database["public"]["Enums"]["order_status"]
          stock_restored: boolean
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          address_line: string
          admin_note?: string | null
          advance_amount?: number
          advance_by?: string | null
          area?: Database["public"]["Enums"]["delivery_area"]
          city?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          damage_note?: string | null
          delivery_cost?: number
          discount?: number
          forwarded_at?: string | null
          forwarded_to_admin?: boolean
          id?: string
          landmark?: string | null
          notes?: string | null
          order_number?: string
          packaging_total?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          received_amount?: number | null
          reseller_id?: string | null
          reseller_note?: string | null
          reseller_profit?: number
          sa_cost_total?: number
          settled_at?: string | null
          settled_by?: string | null
          settlement_note?: string | null
          shipping_cost?: number
          status?: Database["public"]["Enums"]["order_status"]
          stock_restored?: boolean
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          address_line?: string
          admin_note?: string | null
          advance_amount?: number
          advance_by?: string | null
          area?: Database["public"]["Enums"]["delivery_area"]
          city?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          damage_note?: string | null
          delivery_cost?: number
          discount?: number
          forwarded_at?: string | null
          forwarded_to_admin?: boolean
          id?: string
          landmark?: string | null
          notes?: string | null
          order_number?: string
          packaging_total?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          received_amount?: number | null
          reseller_id?: string | null
          reseller_note?: string | null
          reseller_profit?: number
          sa_cost_total?: number
          settled_at?: string | null
          settled_by?: string | null
          settlement_note?: string | null
          shipping_cost?: number
          status?: Database["public"]["Enums"]["order_status"]
          stock_restored?: boolean
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "public_stores"
            referencedColumns: ["reseller_id"]
          },
          {
            foreignKeyName: "orders_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_configs: {
        Row: {
          config: Json
          created_at: string
          id: string
          instructions: string | null
          is_active: boolean
          label: string
          method: Database["public"]["Enums"]["payment_method"]
          mode: string
          reseller_id: string | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          label: string
          method: Database["public"]["Enums"]["payment_method"]
          mode?: string
          reseller_id?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          label?: string
          method?: Database["public"]["Enums"]["payment_method"]
          mode?: string
          reseller_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_configs_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "public_stores"
            referencedColumns: ["reseller_id"]
          },
          {
            foreignKeyName: "payment_configs_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"] | null
          notes: string | null
          paid_at: string | null
          reference: string | null
          requested_at: string
          reseller_id: string
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"] | null
          notes?: string | null
          paid_at?: string | null
          reference?: string | null
          requested_at?: string
          reseller_id: string
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"] | null
          notes?: string | null
          paid_at?: string | null
          reference?: string | null
          requested_at?: string
          reseller_id?: string
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "public_stores"
            referencedColumns: ["reseller_id"]
          },
          {
            foreignKeyName: "payouts_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
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
          delivery_flat: number
          delivery_inside: number
          delivery_mode: string
          delivery_outside: number
          description: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          keywords: string | null
          meta_description: string | null
          meta_title: string | null
          name: string
          og_image_url: string | null
          packaging_cost: number
          product_code: string
          reseller_price: number
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
          delivery_flat?: number
          delivery_inside?: number
          delivery_mode?: string
          delivery_outside?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          keywords?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          og_image_url?: string | null
          packaging_cost?: number
          product_code?: string
          reseller_price?: number
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
          delivery_flat?: number
          delivery_inside?: number
          delivery_mode?: string
          delivery_outside?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          keywords?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          og_image_url?: string | null
          packaging_cost?: number
          product_code?: string
          reseller_price?: number
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
          email_verified_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          phone_verified_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email_verified_at?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          phone_verified_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email_verified_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          phone_verified_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reseller_deposits: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          method: string | null
          note: string | null
          reference: string | null
          reseller_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          note?: string | null
          reference?: string | null
          reseller_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          note?: string | null
          reference?: string | null
          reseller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_deposits_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "public_stores"
            referencedColumns: ["reseller_id"]
          },
          {
            foreignKeyName: "reseller_deposits_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_domains: {
        Row: {
          cloudflare_hostname_id: string | null
          created_at: string
          dns_target: string | null
          hostname: string
          id: string
          is_primary: boolean
          last_checked_at: string | null
          last_error: string | null
          mode: string
          ownership_status: string | null
          reseller_id: string
          ssl_status: string
          verification_txt_name: string | null
          verification_txt_value: string | null
          verified_at: string | null
          worker_domain_id: string | null
        }
        Insert: {
          cloudflare_hostname_id?: string | null
          created_at?: string
          dns_target?: string | null
          hostname: string
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          mode?: string
          ownership_status?: string | null
          reseller_id: string
          ssl_status?: string
          verification_txt_name?: string | null
          verification_txt_value?: string | null
          verified_at?: string | null
          worker_domain_id?: string | null
        }
        Update: {
          cloudflare_hostname_id?: string | null
          created_at?: string
          dns_target?: string | null
          hostname?: string
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          mode?: string
          ownership_status?: string | null
          reseller_id?: string
          ssl_status?: string
          verification_txt_name?: string | null
          verification_txt_value?: string | null
          verified_at?: string | null
          worker_domain_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reseller_domains_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "public_stores"
            referencedColumns: ["reseller_id"]
          },
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
            referencedRelation: "public_stores"
            referencedColumns: ["reseller_id"]
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
      reseller_menu_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          kind: string
          label: string
          layout: string
          open_new_tab: boolean
          parent_id: string | null
          ref_slug: string | null
          reseller_id: string
          sort_order: number
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind?: string
          label: string
          layout?: string
          open_new_tab?: boolean
          parent_id?: string | null
          ref_slug?: string | null
          reseller_id: string
          sort_order?: number
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind?: string
          label?: string
          layout?: string
          open_new_tab?: boolean
          parent_id?: string | null
          ref_slug?: string | null
          reseller_id?: string
          sort_order?: number
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reseller_menu_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "reseller_menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_menu_items_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "public_stores"
            referencedColumns: ["reseller_id"]
          },
          {
            foreignKeyName: "reseller_menu_items_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_settings: {
        Row: {
          about_text: string | null
          accent_color: string | null
          announcement: string | null
          facebook_url: string | null
          favicon_url: string | null
          footer_text: string | null
          hero_headline: string | null
          hero_image_url: string | null
          hero_subheadline: string | null
          instagram_url: string | null
          logo_url: string | null
          meta_description: string | null
          og_image_url: string | null
          primary_color: string | null
          reseller_id: string
          store_name: string
          support_phone: string | null
          tagline: string | null
          theme: string
          theme_settings: Json
          tiktok_url: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          about_text?: string | null
          accent_color?: string | null
          announcement?: string | null
          facebook_url?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          hero_headline?: string | null
          hero_image_url?: string | null
          hero_subheadline?: string | null
          instagram_url?: string | null
          logo_url?: string | null
          meta_description?: string | null
          og_image_url?: string | null
          primary_color?: string | null
          reseller_id: string
          store_name: string
          support_phone?: string | null
          tagline?: string | null
          theme?: string
          theme_settings?: Json
          tiktok_url?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          about_text?: string | null
          accent_color?: string | null
          announcement?: string | null
          facebook_url?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          hero_headline?: string | null
          hero_image_url?: string | null
          hero_subheadline?: string | null
          instagram_url?: string | null
          logo_url?: string | null
          meta_description?: string | null
          og_image_url?: string | null
          primary_color?: string | null
          reseller_id?: string
          store_name?: string
          support_phone?: string | null
          tagline?: string | null
          theme?: string
          theme_settings?: Json
          tiktok_url?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reseller_settings_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: true
            referencedRelation: "public_stores"
            referencedColumns: ["reseller_id"]
          },
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
          agent_id: string | null
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          business_name: string
          code: string
          commission_rate: number
          contact_phone: string | null
          created_at: string
          deposit_required: boolean
          deposit_required_amount: number
          frozen_amount: number
          id: string
          leader_id: string | null
          nid_number: string | null
          notes: string | null
          payout_account_name: string | null
          payout_account_number: string | null
          payout_bank_name: string | null
          payout_branch: string | null
          payout_method: string | null
          payout_notes: string | null
          payout_routing: string | null
          status: Database["public"]["Enums"]["reseller_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          agent_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          business_name: string
          code: string
          commission_rate?: number
          contact_phone?: string | null
          created_at?: string
          deposit_required?: boolean
          deposit_required_amount?: number
          frozen_amount?: number
          id?: string
          leader_id?: string | null
          nid_number?: string | null
          notes?: string | null
          payout_account_name?: string | null
          payout_account_number?: string | null
          payout_bank_name?: string | null
          payout_branch?: string | null
          payout_method?: string | null
          payout_notes?: string | null
          payout_routing?: string | null
          status?: Database["public"]["Enums"]["reseller_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          agent_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          business_name?: string
          code?: string
          commission_rate?: number
          contact_phone?: string | null
          created_at?: string
          deposit_required?: boolean
          deposit_required_amount?: number
          frozen_amount?: number
          id?: string
          leader_id?: string | null
          nid_number?: string | null
          notes?: string | null
          payout_account_name?: string | null
          payout_account_number?: string | null
          payout_bank_name?: string | null
          payout_branch?: string | null
          payout_method?: string | null
          payout_notes?: string | null
          payout_routing?: string | null
          status?: Database["public"]["Enums"]["reseller_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resellers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resellers_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "public_stores"
            referencedColumns: ["reseller_id"]
          },
          {
            foreignKeyName: "resellers_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
        }
        Relationships: []
      }
      shipments: {
        Row: {
          booked_at: string | null
          booked_by: string | null
          cod_amount: number | null
          consignment_id: string | null
          cost: number
          courier_note: string | null
          courier_status: string | null
          created_at: string
          delivery_charge: number | null
          id: string
          last_event_at: string | null
          last_synced_at: string | null
          order_id: string
          provider: Database["public"]["Enums"]["courier_provider"]
          request_payload: Json | null
          response_payload: Json | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_id: string | null
          updated_at: string
        }
        Insert: {
          booked_at?: string | null
          booked_by?: string | null
          cod_amount?: number | null
          consignment_id?: string | null
          cost?: number
          courier_note?: string | null
          courier_status?: string | null
          created_at?: string
          delivery_charge?: number | null
          id?: string
          last_event_at?: string | null
          last_synced_at?: string | null
          order_id: string
          provider?: Database["public"]["Enums"]["courier_provider"]
          request_payload?: Json | null
          response_payload?: Json | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_id?: string | null
          updated_at?: string
        }
        Update: {
          booked_at?: string | null
          booked_by?: string | null
          cod_amount?: number | null
          consignment_id?: string | null
          cost?: number
          courier_note?: string | null
          courier_status?: string | null
          created_at?: string
          delivery_charge?: number | null
          id?: string
          last_event_at?: string | null
          last_synced_at?: string | null
          order_id?: string
          provider?: Database["public"]["Enums"]["courier_provider"]
          request_payload?: Json | null
          response_payload?: Json | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      store_visits: {
        Row: {
          created_at: string
          device: string
          id: string
          path: string
          referrer: string | null
          reseller_id: string
          session_key: string
        }
        Insert: {
          created_at?: string
          device?: string
          id?: string
          path?: string
          referrer?: string | null
          reseller_id: string
          session_key: string
        }
        Update: {
          created_at?: string
          device?: string
          id?: string
          path?: string
          referrer?: string | null
          reseller_id?: string
          session_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_visits_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "public_stores"
            referencedColumns: ["reseller_id"]
          },
          {
            foreignKeyName: "store_visits_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          custom_role_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_role_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          custom_role_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_codes: {
        Row: {
          attempts: number
          channel: string
          code_hash: string
          created_at: string
          expires_at: string
          target: string
          user_id: string
        }
        Insert: {
          attempts?: number
          channel: string
          code_hash: string
          created_at?: string
          expires_at: string
          target: string
          user_id: string
        }
        Update: {
          attempts?: number
          channel?: string
          code_hash?: string
          created_at?: string
          expires_at?: string
          target?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_marketing_pixels: {
        Row: {
          id: string | null
          pixel_id: string | null
          platform: string | null
          reseller_id: string | null
        }
        Insert: {
          id?: string | null
          pixel_id?: string | null
          platform?: string | null
          reseller_id?: string | null
        }
        Update: {
          id?: string | null
          pixel_id?: string | null
          platform?: string | null
          reseller_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_configs_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "public_stores"
            referencedColumns: ["reseller_id"]
          },
          {
            foreignKeyName: "marketing_configs_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      public_payment_methods: {
        Row: {
          id: string | null
          instructions: string | null
          label: string | null
          method: Database["public"]["Enums"]["payment_method"] | null
          mode: string | null
          reseller_id: string | null
        }
        Insert: {
          id?: string | null
          instructions?: string | null
          label?: string | null
          method?: Database["public"]["Enums"]["payment_method"] | null
          mode?: string | null
          reseller_id?: string | null
        }
        Update: {
          id?: string | null
          instructions?: string | null
          label?: string | null
          method?: Database["public"]["Enums"]["payment_method"] | null
          mode?: string | null
          reseller_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_configs_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "public_stores"
            referencedColumns: ["reseller_id"]
          },
          {
            foreignKeyName: "payment_configs_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      public_stores: {
        Row: {
          about_text: string | null
          accent_color: string | null
          announcement: string | null
          business_name: string | null
          code: string | null
          facebook_url: string | null
          favicon_url: string | null
          footer_text: string | null
          hero_headline: string | null
          hero_image_url: string | null
          hero_subheadline: string | null
          instagram_url: string | null
          logo_url: string | null
          meta_description: string | null
          og_image_url: string | null
          primary_color: string | null
          reseller_id: string | null
          store_name: string | null
          support_phone: string | null
          tagline: string | null
          theme: string | null
          theme_settings: Json | null
          tiktok_url: string | null
          whatsapp: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_reseller_metrics: {
        Args: never
        Returns: {
          available: number
          delivered_profit: number
          deposit_balance: number
          frozen_amount: number
          orders: number
          paid_out: number
          pending_payout: number
          reseller_id: string
        }[]
      }
      calculate_delivery_charge: {
        Args: { _area: string; _product_id: string }
        Returns: number
      }
      cf_config_get: {
        Args: never
        Returns: {
          a_record_ip: string | null
          account_id: string | null
          api_token: string | null
          auto_worker_domain: boolean
          cname_target: string | null
          dns_active: boolean
          id: number
          is_active: boolean
          mode: string
          server_a_ip: string | null
          server_cname: string | null
          server_note: string | null
          updated_at: string
          worker_name: string | null
          zone_id: string | null
          zone_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cloudflare_config"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cf_config_save: {
        Args: {
          _a_record_ip: string
          _account_id: string
          _api_token: string
          _auto_worker_domain: boolean
          _cname_target: string
          _dns_active?: boolean
          _is_active: boolean
          _mode?: string
          _server_a_ip?: string
          _server_cname?: string
          _server_note?: string
          _worker_name: string
          _zone_id: string
          _zone_name: string
        }
        Returns: {
          a_record_ip: string | null
          account_id: string | null
          api_token: string | null
          auto_worker_domain: boolean
          cname_target: string | null
          dns_active: boolean
          id: number
          is_active: boolean
          mode: string
          server_a_ip: string | null
          server_cname: string | null
          server_note: string | null
          updated_at: string
          worker_name: string | null
          zone_id: string | null
          zone_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cloudflare_config"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cf_config_settings: {
        Args: never
        Returns: {
          a_record_ip: string
          account_id: string
          auto_worker_domain: boolean
          cname_target: string
          dns_active: boolean
          has_token: boolean
          is_active: boolean
          mode: string
          server_a_ip: string
          server_cname: string
          server_note: string
          updated_at: string
          worker_name: string
          zone_id: string
          zone_name: string
        }[]
      }
      cf_dns_guide: {
        Args: never
        Returns: {
          a_record_ip: string
          active: boolean
          cf_ready: boolean
          cname_target: string
          dns_ready: boolean
          mode: string
          server_a_ip: string
          server_cname: string
          server_note: string
          zone_name: string
        }[]
      }
      cleanup_counts: {
        Args: never
        Returns: {
          key: string
          rows: number
        }[]
      }
      cleanup_purge: {
        Args: { _keys: string[] }
        Returns: {
          key: string
          rows: number
        }[]
      }
      create_public_order: {
        Args: {
          _address_line: string
          _area: Database["public"]["Enums"]["delivery_area"]
          _city: string
          _customer_email: string
          _customer_name: string
          _customer_phone: string
          _items: Json
          _landmark: string
          _notes: string
          _payment_method: Database["public"]["Enums"]["payment_method"]
          _reseller_code: string
        }
        Returns: {
          order_id: string
          order_number: string
        }[]
      }
      current_agent_id: { Args: never; Returns: string }
      current_reseller_id: { Args: never; Returns: string }
      generate_product_code: { Args: never; Returns: string }
      generate_reseller_code: { Args: { _seed: string }; Returns: string }
      has_any_permission: {
        Args: { _permissions: string[]; _user_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      log_store_visit: {
        Args: {
          _code: string
          _device: string
          _path: string
          _referrer: string
          _session_key: string
        }
        Returns: undefined
      }
      my_permissions: { Args: never; Returns: string[] }
      order_kept_product_cost: { Args: { _order_id: string }; Returns: number }
      purge_store_visits: { Args: never; Returns: number }
      recalc_order_packaging: {
        Args: { _order_id: string }
        Returns: undefined
      }
      reseller_deposit_balance: {
        Args: { _reseller_id: string }
        Returns: number
      }
      reseller_ledger: {
        Args: { _limit?: number; _reseller_id: string }
        Returns: {
          amount: number
          at: string
          direction: string
          kind: string
          label: string
          reference: string
          running: number
          status: string
        }[]
      }
      reseller_profit_summary: {
        Args: { _reseller_id: string }
        Returns: {
          available: number
          delivered_profit: number
          deposit_balance: number
          frozen_amount: number
          paid_out: number
          pending_payout: number
        }[]
      }
      seed_reseller_store: { Args: { _reseller_id: string }; Returns: number }
      store_visit_access: { Args: { _reseller_id: string }; Returns: boolean }
      store_visit_daily: {
        Args: { _from: string; _reseller_id: string; _to: string }
        Returns: {
          day: string
          visitors: number
          visits: number
        }[]
      }
      store_visit_leaderboard: {
        Args: { _from: string; _limit?: number; _to: string }
        Returns: {
          business_name: string
          code: string
          last_at: string
          live: number
          reseller_id: string
          visitors: number
          visits: number
        }[]
      }
      store_visit_pages: {
        Args: {
          _from: string
          _limit?: number
          _reseller_id: string
          _to: string
        }
        Returns: {
          path: string
          visitors: number
          visits: number
        }[]
      }
      store_visit_summary: {
        Args: { _from: string; _reseller_id: string; _to: string }
        Returns: {
          last_at: string
          live: number
          today_visits: number
          visitors: number
          visits: number
        }[]
      }
      transaction_report: {
        Args: {
          _from: string
          _limit?: number
          _reseller_id: string
          _to: string
        }
        Returns: {
          advance: number
          advance_by: string
          amount: number
          at: string
          buy_delivery: number
          buy_product: number
          buy_total: number
          collected: number
          direction: string
          kind: string
          label: string
          note: string
          order_id: string
          order_number: string
          packaging: number
          received: number
          reseller_code: string
          reseller_id: string
          reseller_name: string
          running: number
          sell_delivery: number
          sell_subtotal: number
          sell_total: number
          status: string
        }[]
      }
      verify_check: {
        Args: { _channel: string; _code: string }
        Returns: boolean
      }
      verify_issue: {
        Args: { _channel: string; _code: string; _target: string }
        Returns: undefined
      }
      verify_state: {
        Args: never
        Returns: {
          email_sent_at: string
          email_verified_at: string
          phone_verified_at: string
          sms_sent_at: string
        }[]
      }
    }
    Enums: {
      app_role: "super_admin" | "reseller" | "leader" | "staff"
      courier_provider:
        | "steadfast"
        | "pathao"
        | "carrybee"
        | "redx"
        | "paperfly"
        | "manual"
      delivery_area: "inside_dhaka" | "outside_dhaka" | "sub_dhaka"
      order_status:
        | "draft"
        | "pending"
        | "confirmed"
        | "forwarded"
        | "processing"
        | "shipped"
        | "delivered"
        | "partial"
        | "returned"
        | "cancelled"
        | "ready_to_ship"
        | "pending_return"
        | "packaging"
        | "pending_partial"
        | "partial_full"
        | "partial_item"
        | "partial_delivery"
        | "damaged"
      payment_method:
        | "cod"
        | "bkash"
        | "nagad"
        | "rocket"
        | "card"
        | "sslcommerz"
        | "eps"
        | "other"
      payment_status: "unpaid" | "partial" | "paid" | "refunded"
      payout_status: "pending" | "approved" | "paid" | "rejected"
      reseller_status: "pending" | "active" | "suspended" | "rejected"
      shipment_status:
        | "pending"
        | "booked"
        | "in_transit"
        | "delivered"
        | "returned"
        | "failed"
        | "cancelled"
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
      courier_provider: [
        "steadfast",
        "pathao",
        "carrybee",
        "redx",
        "paperfly",
        "manual",
      ],
      delivery_area: ["inside_dhaka", "outside_dhaka", "sub_dhaka"],
      order_status: [
        "draft",
        "pending",
        "confirmed",
        "forwarded",
        "processing",
        "shipped",
        "delivered",
        "partial",
        "returned",
        "cancelled",
        "ready_to_ship",
        "pending_return",
        "packaging",
        "pending_partial",
        "partial_full",
        "partial_item",
        "partial_delivery",
        "damaged",
      ],
      payment_method: [
        "cod",
        "bkash",
        "nagad",
        "rocket",
        "card",
        "sslcommerz",
        "eps",
        "other",
      ],
      payment_status: ["unpaid", "partial", "paid", "refunded"],
      payout_status: ["pending", "approved", "paid", "rejected"],
      reseller_status: ["pending", "active", "suspended", "rejected"],
      shipment_status: [
        "pending",
        "booked",
        "in_transit",
        "delivered",
        "returned",
        "failed",
        "cancelled",
      ],
    },
  },
} as const
