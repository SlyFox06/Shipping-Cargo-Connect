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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      booking_documents: {
        Row: {
          booking_id: string
          created_at: string
          document_name: string
          document_type: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          updated_at: string
          uploaded_by: string
          uploaded_role: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          document_name: string
          document_type: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          updated_at?: string
          uploaded_by: string
          uploaded_role: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          document_name?: string
          document_type?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          updated_at?: string
          uploaded_by?: string
          uploaded_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booked_volume_m3: number | null
          booked_weight_kg: number | null
          booking_date: string
          booking_number: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cargo_category: string | null
          cargo_description: string
          cargo_weight_kg: number
          container_id: string
          created_at: string
          delivery_date: string | null
          delivery_deadline: string | null
          distance_km: number | null
          drop_address: string | null
          final_delivery_date: string | null
          id: string
          is_split_booking: boolean | null
          parent_booking_id: string | null
          pickup_address: string | null
          pickup_date: string | null
          predicted_delay_hours: number | null
          price_per_m3: number | null
          price_usd: number
          provider_id: string
          refund_amount: number | null
          refund_percentage: number | null
          refund_processed_at: string | null
          refund_reason: string | null
          refund_status: string | null
          route_risk_score: number | null
          safety_flags: Json | null
          space_utilization_percent: number | null
          split_cargo_details: Json | null
          status: Database["public"]["Enums"]["booking_status"] | null
          trader_id: string
          transport_legs: Json | null
          updated_at: string
          weather_risk: string | null
          weight_distribution: Json | null
        }
        Insert: {
          booked_volume_m3?: number | null
          booked_weight_kg?: number | null
          booking_date?: string
          booking_number: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cargo_category?: string | null
          cargo_description: string
          cargo_weight_kg: number
          container_id: string
          created_at?: string
          delivery_date?: string | null
          delivery_deadline?: string | null
          distance_km?: number | null
          drop_address?: string | null
          final_delivery_date?: string | null
          id?: string
          is_split_booking?: boolean | null
          parent_booking_id?: string | null
          pickup_address?: string | null
          pickup_date?: string | null
          predicted_delay_hours?: number | null
          price_per_m3?: number | null
          price_usd: number
          provider_id: string
          refund_amount?: number | null
          refund_percentage?: number | null
          refund_processed_at?: string | null
          refund_reason?: string | null
          refund_status?: string | null
          route_risk_score?: number | null
          safety_flags?: Json | null
          space_utilization_percent?: number | null
          split_cargo_details?: Json | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          trader_id: string
          transport_legs?: Json | null
          updated_at?: string
          weather_risk?: string | null
          weight_distribution?: Json | null
        }
        Update: {
          booked_volume_m3?: number | null
          booked_weight_kg?: number | null
          booking_date?: string
          booking_number?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cargo_category?: string | null
          cargo_description?: string
          cargo_weight_kg?: number
          container_id?: string
          created_at?: string
          delivery_date?: string | null
          delivery_deadline?: string | null
          distance_km?: number | null
          drop_address?: string | null
          final_delivery_date?: string | null
          id?: string
          is_split_booking?: boolean | null
          parent_booking_id?: string | null
          pickup_address?: string | null
          pickup_date?: string | null
          predicted_delay_hours?: number | null
          price_per_m3?: number | null
          price_usd?: number
          provider_id?: string
          refund_amount?: number | null
          refund_percentage?: number | null
          refund_processed_at?: string | null
          refund_reason?: string | null
          refund_status?: string | null
          route_risk_score?: number | null
          safety_flags?: Json | null
          space_utilization_percent?: number | null
          split_cargo_details?: Json | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          trader_id?: string
          transport_legs?: Json | null
          updated_at?: string
          weather_risk?: string | null
          weight_distribution?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_trader_id_fkey"
            columns: ["trader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          booking_id: string | null
          conversation_id: string | null
          created_at: string
          id: string
          message: string
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          booking_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          booking_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_logs: {
        Row: {
          created_at: string
          id: string
          query: string
          response_started: string
          user_id: string
          user_role: string
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          response_started?: string
          user_id: string
          user_role: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          response_started?: string
          user_id?: string
          user_role?: string
        }
        Relationships: []
      }
      container_performance: {
        Row: {
          average_delay_days: number | null
          container_id: string | null
          created_at: string | null
          id: string
          last_updated: string | null
          on_time_deliveries: number | null
          route_key: string
          total_bookings: number | null
          total_delay_days: number | null
          utilization_average: number | null
        }
        Insert: {
          average_delay_days?: number | null
          container_id?: string | null
          created_at?: string | null
          id?: string
          last_updated?: string | null
          on_time_deliveries?: number | null
          route_key: string
          total_bookings?: number | null
          total_delay_days?: number | null
          utilization_average?: number | null
        }
        Update: {
          average_delay_days?: number | null
          container_id?: string | null
          created_at?: string | null
          id?: string
          last_updated?: string | null
          on_time_deliveries?: number | null
          route_key?: string
          total_bookings?: number | null
          total_delay_days?: number | null
          utilization_average?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "container_performance_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
        ]
      }
      containers: {
        Row: {
          available_from: string
          available_until: string
          available_volume_m3: number | null
          available_weight_kg: number | null
          base_rate_per_sqft: number | null
          capacity_kg: number
          container_type: Database["public"]["Enums"]["container_type"]
          created_at: string
          currency: string
          departure_date: string | null
          description: string | null
          destination: string
          destination_city: string | null
          destination_country: string | null
          fragile_handling: boolean | null
          hazmat_approved: boolean | null
          height_ft: number | null
          id: string
          insurance_available: boolean | null
          length_ft: number | null
          origin: string
          origin_city: string | null
          origin_country: string | null
          performance_score: number | null
          price_per_m3: number | null
          price_usd: number
          provider_id: string
          shared_booking_enabled: boolean | null
          status: string | null
          total_volume_m3: number | null
          total_weight_capacity_kg: number | null
          transport_mode: Database["public"]["Enums"]["transport_mode"]
          updated_at: string
          utilization_rate: number | null
          width_ft: number | null
        }
        Insert: {
          available_from: string
          available_until: string
          available_volume_m3?: number | null
          available_weight_kg?: number | null
          base_rate_per_sqft?: number | null
          capacity_kg: number
          container_type: Database["public"]["Enums"]["container_type"]
          created_at?: string
          currency?: string
          departure_date?: string | null
          description?: string | null
          destination: string
          destination_city?: string | null
          destination_country?: string | null
          fragile_handling?: boolean | null
          hazmat_approved?: boolean | null
          height_ft?: number | null
          id?: string
          insurance_available?: boolean | null
          length_ft?: number | null
          origin: string
          origin_city?: string | null
          origin_country?: string | null
          performance_score?: number | null
          price_per_m3?: number | null
          price_usd: number
          provider_id: string
          shared_booking_enabled?: boolean | null
          status?: string | null
          total_volume_m3?: number | null
          total_weight_capacity_kg?: number | null
          transport_mode: Database["public"]["Enums"]["transport_mode"]
          updated_at?: string
          utilization_rate?: number | null
          width_ft?: number | null
        }
        Update: {
          available_from?: string
          available_until?: string
          available_volume_m3?: number | null
          available_weight_kg?: number | null
          base_rate_per_sqft?: number | null
          capacity_kg?: number
          container_type?: Database["public"]["Enums"]["container_type"]
          created_at?: string
          currency?: string
          departure_date?: string | null
          description?: string | null
          destination?: string
          destination_city?: string | null
          destination_country?: string | null
          fragile_handling?: boolean | null
          hazmat_approved?: boolean | null
          height_ft?: number | null
          id?: string
          insurance_available?: boolean | null
          length_ft?: number | null
          origin?: string
          origin_city?: string | null
          origin_country?: string | null
          performance_score?: number | null
          price_per_m3?: number | null
          price_usd?: number
          provider_id?: string
          shared_booking_enabled?: boolean | null
          status?: string | null
          total_volume_m3?: number | null
          total_weight_capacity_kg?: number | null
          transport_mode?: Database["public"]["Enums"]["transport_mode"]
          updated_at?: string
          utilization_rate?: number | null
          width_ft?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "containers_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          admin_notes: string | null
          booking_id: string | null
          container_id: string | null
          created_at: string
          flag_reason: string | null
          flagged_by_admin: boolean | null
          id: string
          is_flagged: boolean | null
          last_message_preview: string | null
          provider_id: string
          status: string
          trader_id: string
          unread_provider_count: number | null
          unread_trader_count: number | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          booking_id?: string | null
          container_id?: string | null
          created_at?: string
          flag_reason?: string | null
          flagged_by_admin?: boolean | null
          id?: string
          is_flagged?: boolean | null
          last_message_preview?: string | null
          provider_id: string
          status?: string
          trader_id: string
          unread_provider_count?: number | null
          unread_trader_count?: number | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          booking_id?: string | null
          container_id?: string | null
          created_at?: string
          flag_reason?: string | null
          flagged_by_admin?: boolean | null
          id?: string
          is_flagged?: boolean | null
          last_message_preview?: string | null
          provider_id?: string
          status?: string
          trader_id?: string
          unread_provider_count?: number | null
          unread_trader_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
        ]
      }
      delay_predictions: {
        Row: {
          booking_id: string | null
          confidence_score: number | null
          container_id: string | null
          created_at: string | null
          factors: Json | null
          id: string
          predicted_delay_days: number | null
          risk_score: string
          updated_at: string | null
        }
        Insert: {
          booking_id?: string | null
          confidence_score?: number | null
          container_id?: string | null
          created_at?: string | null
          factors?: Json | null
          id?: string
          predicted_delay_days?: number | null
          risk_score: string
          updated_at?: string | null
        }
        Update: {
          booking_id?: string | null
          confidence_score?: number | null
          container_id?: string | null
          created_at?: string | null
          factors?: Json | null
          id?: string
          predicted_delay_days?: number | null
          risk_score?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delay_predictions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delay_predictions_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          recipient: string
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient: string
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient?: string
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          booking_id: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_type"]
          due_date: string | null
          emailed_at: string | null
          id: string
          invoice_number: string
          issued_date: string
          paid_date: string | null
          payment_id: string | null
          pdf_path: string | null
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          due_date?: string | null
          emailed_at?: string | null
          id?: string
          invoice_number: string
          issued_date?: string
          paid_date?: string | null
          payment_id?: string | null
          pdf_path?: string | null
          subtotal: number
          tax_amount?: number
          total_amount: number
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          due_date?: string | null
          emailed_at?: string | null
          id?: string
          invoice_number?: string
          issued_date?: string
          paid_date?: string | null
          payment_id?: string | null
          pdf_path?: string | null
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_type"]
          id: string
          metadata: Json | null
          payment_method: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          bank_ifsc_code: string | null
          bank_name: string | null
          company_name: string | null
          created_at: string
          currency_preference: string | null
          email: string
          email_booking_updates: boolean | null
          email_container_updates: boolean | null
          email_marketing: boolean | null
          email_message_alerts: boolean | null
          email_notifications_enabled: boolean | null
          email_refund_updates: boolean | null
          email_security_alerts: boolean | null
          full_name: string | null
          id: string
          payment_notes: string | null
          payment_verified: boolean | null
          paypal_email: string | null
          phone: string | null
          suspended: boolean
          swift_code: string | null
          updated_at: string
          upi_id: string | null
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_ifsc_code?: string | null
          bank_name?: string | null
          company_name?: string | null
          created_at?: string
          currency_preference?: string | null
          email: string
          email_booking_updates?: boolean | null
          email_container_updates?: boolean | null
          email_marketing?: boolean | null
          email_message_alerts?: boolean | null
          email_notifications_enabled?: boolean | null
          email_refund_updates?: boolean | null
          email_security_alerts?: boolean | null
          full_name?: string | null
          id: string
          payment_notes?: string | null
          payment_verified?: boolean | null
          paypal_email?: string | null
          phone?: string | null
          suspended?: boolean
          swift_code?: string | null
          updated_at?: string
          upi_id?: string | null
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_ifsc_code?: string | null
          bank_name?: string | null
          company_name?: string | null
          created_at?: string
          currency_preference?: string | null
          email?: string
          email_booking_updates?: boolean | null
          email_container_updates?: boolean | null
          email_marketing?: boolean | null
          email_message_alerts?: boolean | null
          email_notifications_enabled?: boolean | null
          email_refund_updates?: boolean | null
          email_security_alerts?: boolean | null
          full_name?: string | null
          id?: string
          payment_notes?: string | null
          payment_verified?: boolean | null
          paypal_email?: string | null
          phone?: string | null
          suspended?: boolean
          swift_code?: string | null
          updated_at?: string
          upi_id?: string | null
        }
        Relationships: []
      }
      provider_payouts: {
        Row: {
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_type"]
          id: string
          metadata: Json | null
          processed_date: string | null
          provider_id: string
          scheduled_date: string | null
          status: string
          stripe_payout_id: string | null
          stripe_transfer_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          id?: string
          metadata?: Json | null
          processed_date?: string | null
          provider_id: string
          scheduled_date?: string | null
          status?: string
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          id?: string
          metadata?: Json | null
          processed_date?: string | null
          provider_id?: string
          scheduled_date?: string | null
          status?: string
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_payouts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          bank_ifsc_code: string | null
          bank_name: string | null
          company_registration: string | null
          created_at: string
          currency_preference: string | null
          id: string
          payment_notes: string | null
          payment_verified: boolean | null
          paypal_email: string | null
          rating: number | null
          swift_code: string | null
          total_bookings: number | null
          transport_mode: Database["public"]["Enums"]["transport_mode"]
          updated_at: string
          upi_id: string | null
          user_id: string
          verified: boolean | null
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_ifsc_code?: string | null
          bank_name?: string | null
          company_registration?: string | null
          created_at?: string
          currency_preference?: string | null
          id?: string
          payment_notes?: string | null
          payment_verified?: boolean | null
          paypal_email?: string | null
          rating?: number | null
          swift_code?: string | null
          total_bookings?: number | null
          transport_mode: Database["public"]["Enums"]["transport_mode"]
          updated_at?: string
          upi_id?: string | null
          user_id: string
          verified?: boolean | null
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_ifsc_code?: string | null
          bank_name?: string | null
          company_registration?: string | null
          created_at?: string
          currency_preference?: string | null
          id?: string
          payment_notes?: string | null
          payment_verified?: boolean | null
          paypal_email?: string | null
          rating?: number | null
          swift_code?: string | null
          total_bookings?: number | null
          transport_mode?: Database["public"]["Enums"]["transport_mode"]
          updated_at?: string
          upi_id?: string | null
          user_id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          booking_id: string
          communication_rating: number
          created_at: string
          id: string
          photos: string[] | null
          rating: number
          reliability_rating: number
          review_text: string
          reviewee_id: string
          reviewer_id: string
          status: string
          value_rating: number
        }
        Insert: {
          booking_id: string
          communication_rating: number
          created_at?: string
          id?: string
          photos?: string[] | null
          rating: number
          reliability_rating: number
          review_text: string
          reviewee_id: string
          reviewer_id: string
          status?: string
          value_rating: number
        }
        Update: {
          booking_id?: string
          communication_rating?: number
          created_at?: string
          id?: string
          photos?: string[] | null
          rating?: number
          reliability_rating?: number
          review_text?: string
          reviewee_id?: string
          reviewer_id?: string
          status?: string
          value_rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      refunds: {
        Row: {
          amount: number
          approved_by: string | null
          created_at: string
          id: string
          payment_id: string
          processed_at: string | null
          reason: string | null
          requested_at: string
          requested_by: string
          status: Database["public"]["Enums"]["refund_status"]
          stripe_refund_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          created_at?: string
          id?: string
          payment_id: string
          processed_at?: string | null
          reason?: string | null
          requested_at?: string
          requested_by: string
          status?: Database["public"]["Enums"]["refund_status"]
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          created_at?: string
          id?: string
          payment_id?: string
          processed_at?: string | null
          reason?: string | null
          requested_at?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["refund_status"]
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_analytics_charts: {
        Row: {
          chart_data: Json
          chart_name: string
          chart_type: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          user_role: string
        }
        Insert: {
          chart_data: Json
          chart_name: string
          chart_type: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          user_role: string
        }
        Update: {
          chart_data?: Json
          chart_name?: string
          chart_type?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          user_role?: string
        }
        Relationships: []
      }
      shipment_milestones: {
        Row: {
          booking_id: string
          completed_date: string | null
          created_at: string
          gps_latitude: number | null
          gps_longitude: number | null
          id: string
          images: string[] | null
          location: string | null
          milestone: Database["public"]["Enums"]["milestone_type"]
          notes: string | null
          scheduled_date: string | null
          signature_data: string | null
          status: Database["public"]["Enums"]["milestone_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          booking_id: string
          completed_date?: string | null
          created_at?: string
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          images?: string[] | null
          location?: string | null
          milestone: Database["public"]["Enums"]["milestone_type"]
          notes?: string | null
          scheduled_date?: string | null
          signature_data?: string | null
          status?: Database["public"]["Enums"]["milestone_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          booking_id?: string
          completed_date?: string | null
          created_at?: string
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          images?: string[] | null
          location?: string | null
          milestone?: Database["public"]["Enums"]["milestone_type"]
          notes?: string | null
          scheduled_date?: string | null
          signature_data?: string | null
          status?: Database["public"]["Enums"]["milestone_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_milestones_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_type"]
          description: string | null
          id: string
          metadata: Json | null
          reference_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
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
      weather_predictions: {
        Row: {
          booking_id: string | null
          container_id: string | null
          created_at: string | null
          historical_delay_factor: number | null
          id: string
          overall_risk_score: number | null
          predicted_delay_hours: number | null
          prediction_date: string | null
          rainfall_factor: number | null
          rainfall_mm: number | null
          risk_level: string | null
          route_checkpoints: Json | null
          route_key: string
          safe_sailing_window: Json | null
          storm_factor: number | null
          storm_probability: number | null
          temperature_c: number | null
          updated_at: string | null
          visibility_factor: number | null
          visibility_km: number | null
          wave_factor: number | null
          wave_height_m: number | null
          weather_alerts: Json | null
          wind_factor: number | null
          wind_speed_kmh: number | null
        }
        Insert: {
          booking_id?: string | null
          container_id?: string | null
          created_at?: string | null
          historical_delay_factor?: number | null
          id?: string
          overall_risk_score?: number | null
          predicted_delay_hours?: number | null
          prediction_date?: string | null
          rainfall_factor?: number | null
          rainfall_mm?: number | null
          risk_level?: string | null
          route_checkpoints?: Json | null
          route_key: string
          safe_sailing_window?: Json | null
          storm_factor?: number | null
          storm_probability?: number | null
          temperature_c?: number | null
          updated_at?: string | null
          visibility_factor?: number | null
          visibility_km?: number | null
          wave_factor?: number | null
          wave_height_m?: number | null
          weather_alerts?: Json | null
          wind_factor?: number | null
          wind_speed_kmh?: number | null
        }
        Update: {
          booking_id?: string | null
          container_id?: string | null
          created_at?: string | null
          historical_delay_factor?: number | null
          id?: string
          overall_risk_score?: number | null
          predicted_delay_hours?: number | null
          prediction_date?: string | null
          rainfall_factor?: number | null
          rainfall_mm?: number | null
          risk_level?: string | null
          route_checkpoints?: Json | null
          route_key?: string
          safe_sailing_window?: Json | null
          storm_factor?: number | null
          storm_probability?: number | null
          temperature_c?: number | null
          updated_at?: string | null
          visibility_factor?: number | null
          visibility_km?: number | null
          wave_factor?: number | null
          wave_height_m?: number | null
          weather_alerts?: Json | null
          wind_factor?: number | null
          wind_speed_kmh?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weather_predictions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weather_predictions_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_container_price: {
        Args: {
          p_base_rate_per_sqft: number
          p_length_ft: number
          p_width_ft: number
        }
        Returns: number
      }
      calculate_refund_amount: {
        Args: { p_booking_id: string; p_cancelled_by: string }
        Returns: {
          refund_amount: number
          refund_percentage: number
          refund_status: string
        }[]
      }
      generate_booking_number: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
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
      update_transport_leg_status: {
        Args: {
          p_booking_id: string
          p_completed_date?: string
          p_leg_number: number
          p_status: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "provider" | "trader"
      booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "in_transit"
        | "delivered"
      container_type:
        | "standard_20"
        | "standard_40"
        | "high_cube_40"
        | "refrigerated_20"
        | "refrigerated_40"
        | "open_top"
        | "flat_rack"
      currency_type: "USD" | "EUR" | "GBP" | "INR"
      milestone_status: "pending" | "completed" | "delayed"
      milestone_type:
        | "booking_confirmed"
        | "container_assigned"
        | "cargo_loaded"
        | "in_transit"
        | "at_destination_port"
        | "customs_clearance"
        | "out_for_delivery"
        | "delivered"
      notification_type:
        | "booking"
        | "payment"
        | "chat"
        | "milestone"
        | "container"
        | "system"
      payment_status:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "refunded"
      refund_status: "requested" | "approved" | "rejected" | "completed"
      transaction_type: "payment" | "refund" | "payout" | "commission"
      transport_mode: "sea" | "air" | "rail" | "road"
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
      app_role: ["admin", "provider", "trader"],
      booking_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "in_transit",
        "delivered",
      ],
      container_type: [
        "standard_20",
        "standard_40",
        "high_cube_40",
        "refrigerated_20",
        "refrigerated_40",
        "open_top",
        "flat_rack",
      ],
      currency_type: ["USD", "EUR", "GBP", "INR"],
      milestone_status: ["pending", "completed", "delayed"],
      milestone_type: [
        "booking_confirmed",
        "container_assigned",
        "cargo_loaded",
        "in_transit",
        "at_destination_port",
        "customs_clearance",
        "out_for_delivery",
        "delivered",
      ],
      notification_type: [
        "booking",
        "payment",
        "chat",
        "milestone",
        "container",
        "system",
      ],
      payment_status: [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "refunded",
      ],
      refund_status: ["requested", "approved", "rejected", "completed"],
      transaction_type: ["payment", "refund", "payout", "commission"],
      transport_mode: ["sea", "air", "rail", "road"],
    },
  },
} as const
