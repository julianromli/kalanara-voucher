
export enum VoucherStatus {
  ACTIVE = 'Aktif',
  REDEEMED = 'Terpakai',
  EXPIRED = 'Kadaluarsa',
  VOIDED = 'Dibatalkan'
}

export type UserRole = 'ADMIN' | 'STAFF';

export interface User {
  email: string;
  role: UserRole;
  name: string;
}

export interface Service {
  id: string;
  title: string;
  description: string;
  durationMin: number;
  price: number;
  image: string;
  facilities: string[];
  isArchived?: boolean;
}

export interface Customer {
  name: string;
  email: string; // Separated from generic contact
  phone: string; // Separated from generic contact
  notes?: string;
}

export interface GiftDetails {
  isGift: boolean;
  senderName: string; // Derived from Purchaser Name
  recipientName: string; // The Gifted Person
  message: string;
  sendTo: 'PURCHASER' | 'RECIPIENT'; // Delivery Target
  recipientEmail?: string;
  recipientPhone?: string;
}

export interface Transaction {
  id: string; // KAL-2025-XXXX
  serviceId: string;
  customer: Customer;
  purchaseDate: string;
  expiryDate: string;
  status: VoucherStatus;
  amount: number;
  paymentMethod: 'QRIS' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'CASH' | 'COMPLIMENTARY';
  giftDetails?: GiftDetails;
}

// DTO for Public Verification (Hides sensitive data like price and customer info)
export interface PublicVoucherInfo {
  code: string;
  serviceTitle: string;
  serviceImage: string;
  expiryDate: string;
  status: VoucherStatus;
  isGift: boolean;
  senderName?: string; // Only show sender name if it's a gift
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  performedBy: string;
}

export interface Review {
  id: string;
  transactionId: string;
  customerName: string;
  serviceTitle: string;
  rating: number; // 1-5
  comment: string;
  date: string;
}

export interface StoreContextType {
  services: Service[];
  transactions: Transaction[];
  auditLogs: AuditLogEntry[];
  reviews: Review[];
  addTransaction: (transaction: Transaction) => void;
  createVoucher: (transaction: Transaction, performedBy: string) => void;
  redeemVoucher: (code: string, performedBy: string) => { success: boolean; message: string };
  verifyVoucher: (code: string) => PublicVoucherInfo | null; // Public verification method
  updateVoucherStatus: (id: string, status: VoucherStatus) => void;
  extendVoucher: (id: string, days: number, performedBy: string) => void;
  voidVoucher: (id: string, reason: string, performedBy: string) => void;
  addReview: (review: Review) => void;
  addService: (service: Service, performedBy: string) => void;
  updateService: (id: string, updatedData: Partial<Service>, performedBy: string) => void;
  deleteService: (id: string, performedBy: string) => void;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, role: UserRole) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface ToastContextType {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}
