export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      service_categories: {
        Row: {
          id: string;
          slug: string;
          name: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          duration: number;
          price: number;
          category: "MASSAGE" | "FACIAL" | "BODY_TREATMENT" | "PACKAGE";
          category_id: string | null;
          image_url: string | null;
          is_active: boolean;
          scalev_product_id: number | null;
          scalev_variant_id: number | null;
          scalev_variant_unique_id: string | null;
          scalev_sync_status: string | null;
          scalev_last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          duration: number;
          price: number;
          category: "MASSAGE" | "FACIAL" | "BODY_TREATMENT" | "PACKAGE";
          category_id?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          scalev_product_id?: number | null;
          scalev_variant_id?: number | null;
          scalev_variant_unique_id?: string | null;
          scalev_sync_status?: string | null;
          scalev_last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          duration?: number;
          price?: number;
          category?: "MASSAGE" | "FACIAL" | "BODY_TREATMENT" | "PACKAGE";
          category_id?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          scalev_product_id?: number | null;
          scalev_variant_id?: number | null;
          scalev_variant_unique_id?: string | null;
          scalev_sync_status?: string | null;
          scalev_last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "service_categories";
            referencedColumns: ["id"];
          }
        ];
      };
      vouchers: {
        Row: {
          id: string;
          code: string;
          source_order_id: string | null;
          source_order_item_id: string | null;
          service_id: string;
          recipient_name: string;
          recipient_email: string;
          sender_name: string;
          sender_message: string | null;
          purchase_date: string;
          expiry_date: string;
          is_redeemed: boolean;
          redeemed_at: string | null;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          source_order_id?: string | null;
          source_order_item_id?: string | null;
          service_id: string;
          recipient_name: string;
          recipient_email: string;
          sender_name: string;
          sender_message?: string | null;
          purchase_date?: string;
          expiry_date: string;
          is_redeemed?: boolean;
          redeemed_at?: string | null;
          amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          source_order_id?: string | null;
          source_order_item_id?: string | null;
          service_id?: string;
          recipient_name?: string;
          recipient_email?: string;
          sender_name?: string;
          sender_message?: string | null;
          purchase_date?: string;
          expiry_date?: string;
          is_redeemed?: boolean;
          redeemed_at?: string | null;
          amount?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vouchers_source_order_id_fkey";
            columns: ["source_order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vouchers_source_order_item_id_fkey";
            columns: ["source_order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vouchers_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          }
        ];
      };
      discount_codes: {
        Row: {
          id: string;
          code: string;
          normalized_code: string;
          is_active: boolean;
          discount_type: string;
          discount_value: number;
          starts_at: string | null;
          ends_at: string | null;
          max_total_uses: number | null;
          max_uses_per_customer: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          normalized_code: string;
          is_active?: boolean;
          discount_type: string;
          discount_value: number;
          starts_at?: string | null;
          ends_at?: string | null;
          max_total_uses?: number | null;
          max_uses_per_customer?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          normalized_code?: string;
          is_active?: boolean;
          discount_type?: string;
          discount_value?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          max_total_uses?: number | null;
          max_uses_per_customer?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      discount_code_redemptions: {
        Row: {
          id: string;
          discount_code_id: string;
          order_id: string;
          customer_email_normalized: string;
          customer_phone_normalized: string;
          status: string;
          discount_snapshot_type: string;
          discount_snapshot_value: number;
          subtotal_amount: number;
          discount_amount: number;
          final_total_amount: number;
          redeemed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          discount_code_id: string;
          order_id: string;
          customer_email_normalized: string;
          customer_phone_normalized: string;
          status: string;
          discount_snapshot_type: string;
          discount_snapshot_value: number;
          subtotal_amount: number;
          discount_amount: number;
          final_total_amount: number;
          redeemed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          discount_code_id?: string;
          order_id?: string;
          customer_email_normalized?: string;
          customer_phone_normalized?: string;
          status?: string;
          discount_snapshot_type?: string;
          discount_snapshot_value?: number;
          subtotal_amount?: number;
          discount_amount?: number;
          final_total_amount?: number;
          redeemed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discount_code_redemptions_discount_code_id_fkey";
            columns: ["discount_code_id"];
            isOneToOne: false;
            referencedRelation: "discount_codes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discount_code_redemptions_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          }
        ];
      };
      orders: {
        Row: {
          id: string;
          voucher_id: string | null; // Nullable - set after payment success
          customer_email: string;
          customer_name: string;
          customer_phone: string;
          payment_method: "CREDIT_CARD" | "BANK_TRANSFER" | "E_WALLET";
          payment_status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
          payment_provider: string;
          subtotal_amount: number;
          discount_code_id: string | null;
          discount_code: string | null;
          discount_type_snapshot: string | null;
          discount_value_snapshot: number | null;
          discount_amount: number;
          total_amount: number;
          created_at: string;
          // Payment gateway fields
          payment_order_id: string | null;
          public_access_token: string;
          payment_transaction_id: string | null;
          payment_type: string | null;
          payment_transaction_time: string | null;
          payment_link: string | null;
          scalev_order_pk: number | null;
          scalev_order_id: string | null;
          scalev_pg_reference_id: string | null;
          scalev_payment_method: string | null;
          scalev_sub_payment_method: string | null;
          scalev_store_unique_id: string | null;
          scalev_last_checked_at: string | null;
          scalev_raw_status: string | null;
          scalev_raw_payment_status: string | null;
          // Recipient info for voucher creation
          service_id: string | null;
          recipient_name: string | null;
          recipient_email: string | null;
          recipient_phone: string | null;
          sender_message: string | null;
          delivery_method: "EMAIL" | "WHATSAPP" | "BOTH" | null;
          send_to: "PURCHASER" | "RECIPIENT" | null;
        };
        Insert: {
          id?: string;
          voucher_id?: string | null;
          customer_email: string;
          customer_name: string;
          customer_phone: string;
          payment_method: "CREDIT_CARD" | "BANK_TRANSFER" | "E_WALLET";
          payment_status?: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
          payment_provider?: string;
          subtotal_amount?: number;
          discount_code_id?: string | null;
          discount_code?: string | null;
          discount_type_snapshot?: string | null;
          discount_value_snapshot?: number | null;
          discount_amount?: number;
          total_amount: number;
          created_at?: string;
          // Payment gateway fields
          payment_order_id?: string | null;
          public_access_token?: string;
          payment_transaction_id?: string | null;
          payment_type?: string | null;
          payment_transaction_time?: string | null;
          payment_link?: string | null;
          scalev_order_pk?: number | null;
          scalev_order_id?: string | null;
          scalev_pg_reference_id?: string | null;
          scalev_payment_method?: string | null;
          scalev_sub_payment_method?: string | null;
          scalev_store_unique_id?: string | null;
          scalev_last_checked_at?: string | null;
          scalev_raw_status?: string | null;
          scalev_raw_payment_status?: string | null;
          // Recipient info for voucher creation
          service_id?: string | null;
          recipient_name?: string | null;
          recipient_email?: string | null;
          recipient_phone?: string | null;
          sender_message?: string | null;
          delivery_method?: "EMAIL" | "WHATSAPP" | "BOTH" | null;
          send_to?: "PURCHASER" | "RECIPIENT" | null;
        };
        Update: {
          id?: string;
          voucher_id?: string | null;
          customer_email?: string;
          customer_name?: string;
          customer_phone?: string;
          payment_method?: "CREDIT_CARD" | "BANK_TRANSFER" | "E_WALLET";
          payment_status?: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
          payment_provider?: string;
          subtotal_amount?: number;
          discount_code_id?: string | null;
          discount_code?: string | null;
          discount_type_snapshot?: string | null;
          discount_value_snapshot?: number | null;
          discount_amount?: number;
          total_amount?: number;
          created_at?: string;
          // Payment gateway fields
          payment_order_id?: string | null;
          public_access_token?: string;
          payment_transaction_id?: string | null;
          payment_type?: string | null;
          payment_transaction_time?: string | null;
          payment_link?: string | null;
          scalev_order_pk?: number | null;
          scalev_order_id?: string | null;
          scalev_pg_reference_id?: string | null;
          scalev_payment_method?: string | null;
          scalev_sub_payment_method?: string | null;
          scalev_store_unique_id?: string | null;
          scalev_last_checked_at?: string | null;
          scalev_raw_status?: string | null;
          scalev_raw_payment_status?: string | null;
          // Recipient info for voucher creation
          service_id?: string | null;
          recipient_name?: string | null;
          recipient_email?: string | null;
          recipient_phone?: string | null;
          sender_message?: string | null;
          delivery_method?: "EMAIL" | "WHATSAPP" | "BOTH" | null;
          send_to?: "PURCHASER" | "RECIPIENT" | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_voucher_id_fkey";
            columns: ["voucher_id"];
            isOneToOne: false;
            referencedRelation: "vouchers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_discount_code_id_fkey";
            columns: ["discount_code_id"];
            isOneToOne: false;
            referencedRelation: "discount_codes";
            referencedColumns: ["id"];
          }
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          service_id: string;
          voucher_id: string | null;
          original_unit_price: number;
          discount_amount: number;
          final_unit_price: number;
          unit_price: number;
          recipient_name: string;
          recipient_email: string | null;
          recipient_phone: string | null;
          sender_message: string | null;
          delivery_method: "EMAIL" | "WHATSAPP" | "BOTH";
          send_to: "PURCHASER" | "RECIPIENT";
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          service_id: string;
          voucher_id?: string | null;
          original_unit_price: number;
          discount_amount?: number;
          final_unit_price: number;
          unit_price: number;
          recipient_name: string;
          recipient_email?: string | null;
          recipient_phone?: string | null;
          sender_message?: string | null;
          delivery_method: "EMAIL" | "WHATSAPP" | "BOTH";
          send_to: "PURCHASER" | "RECIPIENT";
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          service_id?: string;
          voucher_id?: string | null;
          original_unit_price?: number;
          discount_amount?: number;
          final_unit_price?: number;
          unit_price?: number;
          recipient_name?: string;
          recipient_email?: string | null;
          recipient_phone?: string | null;
          sender_message?: string | null;
          delivery_method?: "EMAIL" | "WHATSAPP" | "BOTH";
          send_to?: "PURCHASER" | "RECIPIENT";
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_voucher_id_fkey";
            columns: ["voucher_id"];
            isOneToOne: false;
            referencedRelation: "vouchers";
            referencedColumns: ["id"];
          }
        ];
      };
      reviews: {
        Row: {
          id: string;
          voucher_id: string;
          rating: number;
          comment: string | null;
          customer_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          voucher_id: string;
          rating: number;
          comment?: string | null;
          customer_name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          voucher_id?: string;
          rating?: number;
          comment?: string | null;
          customer_name?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_voucher_id_fkey";
            columns: ["voucher_id"];
            isOneToOne: false;
            referencedRelation: "vouchers";
            referencedColumns: ["id"];
          }
        ];
      };
      admins: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: "SUPER_ADMIN" | "MANAGER" | "STAFF";
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          role?: "SUPER_ADMIN" | "MANAGER" | "STAFF";
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: "SUPER_ADMIN" | "MANAGER" | "STAFF";
          created_at?: string;
        };
        Relationships: [];
      };
      scalev_webhook_events: {
        Row: {
          id: string;
          provider: string;
          event_type: string;
          external_event_hash: string;
          signature: string | null;
          payload: Json | null;
          order_id: string | null;
          scalev_order_pk: number | null;
          scalev_order_id: string | null;
          scalev_pg_reference_id: string | null;
          payment_status: string | null;
          processing_status: string;
          processing_message: string | null;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider?: string;
          event_type: string;
          external_event_hash: string;
          signature?: string | null;
          payload?: Json | null;
          order_id?: string | null;
          scalev_order_pk?: number | null;
          scalev_order_id?: string | null;
          scalev_pg_reference_id?: string | null;
          payment_status?: string | null;
          processing_status?: string;
          processing_message?: string | null;
          processed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          provider?: string;
          event_type?: string;
          external_event_hash?: string;
          signature?: string | null;
          payload?: Json | null;
          order_id?: string | null;
          scalev_order_pk?: number | null;
          scalev_order_id?: string | null;
          scalev_pg_reference_id?: string | null;
          payment_status?: string | null;
          processing_status?: string;
          processing_message?: string | null;
          processed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scalev_webhook_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      hard_delete_orders: {
        Args: {
          order_ids?: string[] | null;
        };
        Returns: {
          success: boolean;
          message: string;
          deleted_order_count: number;
          deleted_voucher_count: number;
          deleted_review_count: number;
          deleted_webhook_event_count: number;
        }[];
      };
      generate_voucher_code: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_super_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      service_category: "MASSAGE" | "FACIAL" | "BODY_TREATMENT" | "PACKAGE";
      payment_method: "CREDIT_CARD" | "BANK_TRANSFER" | "E_WALLET";
      payment_status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
      admin_role: "SUPER_ADMIN" | "MANAGER" | "STAFF";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Helper types for easier usage
export type Service = Database["public"]["Tables"]["services"]["Row"];
export type ServiceInsert = Database["public"]["Tables"]["services"]["Insert"];
export type ServiceUpdate = Database["public"]["Tables"]["services"]["Update"];

export type Voucher = Database["public"]["Tables"]["vouchers"]["Row"];
export type VoucherInsert = Database["public"]["Tables"]["vouchers"]["Insert"];
export type VoucherUpdate = Database["public"]["Tables"]["vouchers"]["Update"];

export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];
export type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];

export type DiscountCode = Database["public"]["Tables"]["discount_codes"]["Row"];
export type DiscountCodeInsert = Database["public"]["Tables"]["discount_codes"]["Insert"];
export type DiscountCodeUpdate = Database["public"]["Tables"]["discount_codes"]["Update"];

export type DiscountCodeRedemption =
  Database["public"]["Tables"]["discount_code_redemptions"]["Row"];
export type DiscountCodeRedemptionInsert =
  Database["public"]["Tables"]["discount_code_redemptions"]["Insert"];
export type DiscountCodeRedemptionUpdate =
  Database["public"]["Tables"]["discount_code_redemptions"]["Update"];

export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type OrderItemInsert = Database["public"]["Tables"]["order_items"]["Insert"];
export type OrderItemUpdate = Database["public"]["Tables"]["order_items"]["Update"];

export type Review = Database["public"]["Tables"]["reviews"]["Row"];
export type ReviewInsert = Database["public"]["Tables"]["reviews"]["Insert"];
export type ReviewUpdate = Database["public"]["Tables"]["reviews"]["Update"];

export type Admin = Database["public"]["Tables"]["admins"]["Row"];
export type AdminInsert = Database["public"]["Tables"]["admins"]["Insert"];
export type AdminUpdate = Database["public"]["Tables"]["admins"]["Update"];

export type ScalevWebhookEvent =
  Database["public"]["Tables"]["scalev_webhook_events"]["Row"];
export type ScalevWebhookEventInsert =
  Database["public"]["Tables"]["scalev_webhook_events"]["Insert"];
export type ScalevWebhookEventUpdate =
  Database["public"]["Tables"]["scalev_webhook_events"]["Update"];

export type ServiceCategory = Database["public"]["Enums"]["service_category"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type AdminRole = Database["public"]["Enums"]["admin_role"];

// Joined types for frontend use
export type VoucherWithService = Voucher & {
  services: Service;
};

export type OrderWithVoucher = Order & {
  services: Service | null;
  vouchers: VoucherWithService | null;
};

export type OrderWithVoucherItems = Order & {
  vouchers: VoucherWithService | null;
  order_items: OrderItemWithService[];
};

// Order with service (for pending orders before voucher creation)
export type OrderWithService = Order & {
  services: Service | null;
};

export type OrderItemWithService = OrderItem & {
  services: Service;
  vouchers?: Voucher | null;
};

export type OrderWithItems = Order & {
  services: Service | null;
  order_items: OrderItemWithService[];
};
