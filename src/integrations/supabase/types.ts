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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      archived_stops: {
        Row: {
          archived_at: string
          driver_id: string | null
          id: string
          notes: string | null
          order_id: string
          reason: Database["public"]["Enums"]["archive_reason"]
        }
        Insert: {
          archived_at?: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          order_id: string
          reason: Database["public"]["Enums"]["archive_reason"]
        }
        Update: {
          archived_at?: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          reason?: Database["public"]["Enums"]["archive_reason"]
        }
        Relationships: [
          {
            foreignKeyName: "archived_stops_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["pkgplace_id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          current_mileage: number | null
          driver_id: string
          event_type: string
          id: string
          logged_at: string
        }
        Insert: {
          current_mileage?: number | null
          driver_id: string
          event_type: string
          id?: string
          logged_at?: string
        }
        Update: {
          current_mileage?: number | null
          driver_id?: string
          event_type?: string
          id?: string
          logged_at?: string
        }
        Relationships: []
      }
      delivery_proof_photos: {
        Row: {
          created_at: string
          id: string
          order_id: string
          photo_url: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          photo_url: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          photo_url?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_proof_photos_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["pkgplace_id"]
          },
        ]
      }
      maintenance_logs: {
        Row: {
          cost: number | null
          created_at: string
          description: string
          id: string
          mileage_at_service: number | null
          service_date: string
          vehicle_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          description: string
          id?: string
          mileage_at_service?: number | null
          service_date?: string
          vehicle_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          description?: string
          id?: string
          mileage_at_service?: number | null
          service_date?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          address_line2: string | null
          auction_house: string | null
          created_at: string
          customer_name: string | null
          delivery_instructions: string | null
          delivery_status: Database["public"]["Enums"]["delivery_status"]
          email: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string | null
          photo_url: string | null
          pkgplace_id: string
          zip_code: string | null
          zone: string | null
        }
        Insert: {
          address?: string | null
          address_line2?: string | null
          auction_house?: string | null
          created_at?: string
          customer_name?: string | null
          delivery_instructions?: string | null
          delivery_status?: Database["public"]["Enums"]["delivery_status"]
          email?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string | null
          photo_url?: string | null
          pkgplace_id: string
          zip_code?: string | null
          zone?: string | null
        }
        Update: {
          address?: string | null
          address_line2?: string | null
          auction_house?: string | null
          created_at?: string
          customer_name?: string | null
          delivery_instructions?: string | null
          delivery_status?: Database["public"]["Enums"]["delivery_status"]
          email?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string | null
          photo_url?: string | null
          pkgplace_id?: string
          zip_code?: string | null
          zone?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          full_name: string | null
          id: string
          is_driver: boolean
          phone: string | null
          status: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id: string
          is_driver?: boolean
          phone?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id?: string
          is_driver?: boolean
          phone?: string | null
          status?: string
        }
        Relationships: []
      }
      route_orders: {
        Row: {
          created_at: string
          id: string
          order_id: string
          route_id: string
          stop_order: number
          stop_type: Database["public"]["Enums"]["stop_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          route_id: string
          stop_order?: number
          stop_type?: Database["public"]["Enums"]["stop_type"]
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          route_id?: string
          stop_order?: number
          stop_type?: Database["public"]["Enums"]["stop_type"]
        }
        Relationships: [
          {
            foreignKeyName: "route_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["pkgplace_id"]
          },
          {
            foreignKeyName: "route_orders_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string
          driver_id: string | null
          id: string
          route_date: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          id?: string
          route_date: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          id?: string
          route_date?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          created_at: string
          current_mileage: number | null
          id: string
          insurance_url: string | null
          make: string
          mileage_of_last_oil_change: number | null
          model: string
          registration_url: string | null
          vin: string | null
          year: number | null
        }
        Insert: {
          created_at?: string
          current_mileage?: number | null
          id?: string
          insurance_url?: string | null
          make: string
          mileage_of_last_oil_change?: number | null
          model: string
          registration_url?: string | null
          vin?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string
          current_mileage?: number | null
          id?: string
          insurance_url?: string | null
          make?: string
          mileage_of_last_oil_change?: number | null
          model?: string
          registration_url?: string | null
          vin?: string | null
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "driver"
      archive_reason:
        | "business_closed"
        | "customer_not_home"
        | "access_code_required"
        | "safety_weather"
        | "package_damaged"
      delivery_status:
        | "requested"
        | "ready"
        | "in_warehouse"
        | "out_for_delivery"
        | "delivered"
      payment_status: "paid" | "unpaid"
      stop_type: "pickup" | "delivery"
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
      app_role: ["admin", "driver"],
      archive_reason: [
        "business_closed",
        "customer_not_home",
        "access_code_required",
        "safety_weather",
        "package_damaged",
      ],
      delivery_status: [
        "requested",
        "ready",
        "in_warehouse",
        "out_for_delivery",
        "delivered",
      ],
      payment_status: ["paid", "unpaid"],
      stop_type: ["pickup", "delivery"],
    },
  },
} as const
