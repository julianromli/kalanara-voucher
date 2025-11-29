/**
 * TypeScript types for Kalanara Spa Voucher Website
 * @description Comprehensive type definitions for spa services, vouchers, orders, and administration
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Categories of spa services offered
 */
export enum ServiceCategory {
  MASSAGE = "MASSAGE",
  FACIAL = "FACIAL",
  BODY_TREATMENT = "BODY_TREATMENT",
  PACKAGE = "PACKAGE",
}

/**
 * Available payment methods for voucher purchases
 */
export enum PaymentMethod {
  CREDIT_CARD = "CREDIT_CARD",
  BANK_TRANSFER = "BANK_TRANSFER",
  E_WALLET = "E_WALLET",
}

/**
 * Status of payment transactions
 */
export enum PaymentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

/**
 * Administrative user roles with different permission levels
 */
export enum AdminRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  MANAGER = "MANAGER",
  STAFF = "STAFF",
}

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Spa service offered by Kalanara Spa
 */
export interface Service {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Duration of the service in minutes */
  readonly duration: number;
  /** Price in the local currency */
  readonly price: number;
  readonly category: ServiceCategory;
  /** URL to the service image */
  readonly image: string;
}

/**
 * Details about the voucher recipient
 */
export interface RecipientDetails {
  readonly name: string;
  readonly email: string;
  readonly message: string;
}

/**
 * Gift voucher for spa services
 */
export interface Voucher {
  readonly id: string;
  /** Unique voucher code for redemption */
  readonly code: string;
  readonly service: Service;
  readonly recipientName: string;
  readonly recipientEmail: string;
  readonly senderName: string;
  readonly senderMessage: string;
  readonly purchaseDate: Date;
  readonly expiryDate: Date;
  readonly isRedeemed: boolean;
  /** Date when the voucher was redeemed, if applicable */
  readonly redeemedDate?: Date;
  /** Total value of the voucher */
  readonly amount: number;
}

/**
 * Purchase order for a voucher
 */
export interface Order {
  readonly id: string;
  readonly voucher: Voucher;
  readonly customerEmail: string;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly paymentMethod: PaymentMethod;
  readonly paymentStatus: PaymentStatus;
  readonly createdAt: Date;
  readonly totalAmount: number;
}

/**
 * Customer review for a redeemed voucher experience
 */
export interface Review {
  readonly id: string;
  readonly voucherId: string;
  /** Rating from 1 to 5 stars */
  readonly rating: number;
  readonly comment: string;
  readonly customerName: string;
  readonly createdAt: Date;
}

/**
 * Administrative user account
 */
export interface Admin {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: AdminRole;
}

/**
 * Item in the shopping cart
 */
export interface CartItem {
  readonly service: Service;
  readonly quantity: number;
  readonly recipientDetails: RecipientDetails;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Type for creating a new service (without id)
 */
export type CreateServiceInput = Omit<Service, "id">;

/**
 * Type for creating a new voucher (without generated fields)
 */
export type CreateVoucherInput = Omit<
  Voucher,
  "id" | "code" | "purchaseDate" | "isRedeemed" | "redeemedDate"
>;

/**
 * Type for creating a new order (without generated fields)
 */
export type CreateOrderInput = Omit<Order, "id" | "createdAt">;

/**
 * Type for creating a new review (without generated fields)
 */
export type CreateReviewInput = Omit<Review, "id" | "createdAt">;

/**
 * Type for creating a new admin user (without id)
 */
export type CreateAdminInput = Omit<Admin, "id">;

/**
 * Partial update type for services
 */
export type UpdateServiceInput = Partial<Omit<Service, "id">>;

/**
 * Partial update type for vouchers
 */
export type UpdateVoucherInput = Partial<
  Pick<Voucher, "isRedeemed" | "redeemedDate">
>;

/**
 * Partial update type for orders
 */
export type UpdateOrderInput = Partial<Pick<Order, "paymentStatus">>;

/**
 * Rating value constrained to 1-5
 */
export type RatingValue = 1 | 2 | 3 | 4 | 5;

/**
 * Shopping cart state
 */
export interface Cart {
  readonly items: readonly CartItem[];
  readonly totalAmount: number;
  readonly itemCount: number;
}
