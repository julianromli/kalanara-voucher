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
      services: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          duration: number;
          price: number;
          category: "MASSAGE" | "FACIAL" | "BODY_TREATMENT" | "PACKAGE";
          image_url: string | null;
          is_active: boolean;
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
          image_url?: string | null;
          is_active?: boolean;
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
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vouchers: {
        Row: {
          id: string;
          code: string;
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
            foreignKeyName: "vouchers_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
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
          total_amount: number;
          created_at: string;
          // Midtrans fields
          midtrans_order_id: string | null;
          midtrans_transaction_id: string | null;
          midtrans_payment_type: string | null;
          midtrans_transaction_time: string | null;
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
          total_amount: number;
          created_at?: string;
          // Midtrans fields
          midtrans_order_id?: string | null;
          midtrans_transaction_id?: string | null;
          midtrans_payment_type?: string | null;
          midtrans_transaction_time?: string | null;
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
          total_amount?: number;
          created_at?: string;
          // Midtrans fields
          midtrans_order_id?: string | null;
          midtrans_transaction_id?: string | null;
          midtrans_payment_type?: string | null;
          midtrans_transaction_time?: string | null;
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
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

export type Review = Database["public"]["Tables"]["reviews"]["Row"];
export type ReviewInsert = Database["public"]["Tables"]["reviews"]["Insert"];
export type ReviewUpdate = Database["public"]["Tables"]["reviews"]["Update"];

export type Admin = Database["public"]["Tables"]["admins"]["Row"];
export type AdminInsert = Database["public"]["Tables"]["admins"]["Insert"];
export type AdminUpdate = Database["public"]["Tables"]["admins"]["Update"];

export type ServiceCategory = Database["public"]["Enums"]["service_category"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type AdminRole = Database["public"]["Enums"]["admin_role"];

// Joined types for frontend use
export type VoucherWithService = Voucher & {
  services: Service;
};

export type OrderWithVoucher = Order & {
  vouchers: VoucherWithService | null;
};

// Order with service (for pending orders before voucher creation)
export type OrderWithService = Order & {
  services: Service | null;
};
