'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type {
  Service as FrontendService,
  Voucher as FrontendVoucher,
  Order as FrontendOrder,
  Review as FrontendReview,
} from '@/lib/types';
import { ServiceCategory, PaymentMethod, PaymentStatus } from '@/lib/types';
import type {
  Service as DBService,
  Voucher as DBVoucher,
  Review as DBReview,
  VoucherWithService,
  OrderWithVoucher,
} from '@/lib/database.types';

// Server actions
import { getServices } from '@/lib/actions/services';
import {
  getVouchers,
  getVoucherByCode as getVoucherByCodeAction,
  createVoucher as createVoucherAction,
  redeemVoucher as redeemVoucherAction,
} from '@/lib/actions/vouchers';
import { getOrders, createOrder as createOrderAction } from '@/lib/actions/orders';
import { getReviews, createReview as createReviewAction } from '@/lib/actions/reviews';

// ============================================================================
// Types
// ============================================================================

interface StoreContextType {
  services: FrontendService[];
  vouchers: FrontendVoucher[];
  orders: FrontendOrder[];
  reviews: FrontendReview[];
  isLoading: boolean;
  error: string | null;
  addVoucher: (voucher: FrontendVoucher) => Promise<void>;
  addOrder: (order: FrontendOrder) => Promise<void>;
  addReview: (review: FrontendReview) => Promise<void>;
  redeemVoucher: (code: string) => Promise<{ success: boolean; message: string }>;
  getVoucherByCode: (code: string) => FrontendVoucher | undefined;
  getServiceById: (id: string) => FrontendService | undefined;
  refreshData: () => Promise<void>;
}

interface StoreProviderProps {
  children: ReactNode;
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  SERVICES: 'kalanara_services',
  VOUCHERS: 'kalanara_vouchers',
  ORDERS: 'kalanara_orders',
  REVIEWS: 'kalanara_reviews',
} as const;

// ============================================================================
// Type Adapters: DB → Frontend
// ============================================================================

/**
 * Converts a database Service to a frontend Service
 */
function adaptDBServiceToFrontend(dbService: DBService): FrontendService {
  return {
    id: dbService.id,
    name: dbService.name,
    description: dbService.description ?? '',
    duration: dbService.duration,
    price: dbService.price,
    category: dbService.category as ServiceCategory,
    image: dbService.image_url ?? '/images/services/placeholder.jpg',
  };
}

/**
 * Converts a database VoucherWithService to a frontend Voucher
 */
function adaptDBVoucherToFrontend(dbVoucher: VoucherWithService): FrontendVoucher {
  return {
    id: dbVoucher.id,
    code: dbVoucher.code,
    service: adaptDBServiceToFrontend(dbVoucher.services),
    recipientName: dbVoucher.recipient_name,
    recipientEmail: dbVoucher.recipient_email,
    senderName: dbVoucher.sender_name,
    senderMessage: dbVoucher.sender_message ?? '',
    purchaseDate: new Date(dbVoucher.purchase_date),
    expiryDate: new Date(dbVoucher.expiry_date),
    isRedeemed: dbVoucher.is_redeemed,
    redeemedDate: dbVoucher.redeemed_at ? new Date(dbVoucher.redeemed_at) : undefined,
    amount: dbVoucher.amount,
  };
}

/**
 * Converts a database OrderWithVoucher to a frontend Order
 */
function adaptDBOrderToFrontend(dbOrder: OrderWithVoucher): FrontendOrder {
  return {
    id: dbOrder.id,
    voucher: dbOrder.vouchers ? adaptDBVoucherToFrontend(dbOrder.vouchers) : null as unknown as FrontendVoucher,
    customerEmail: dbOrder.customer_email,
    customerName: dbOrder.customer_name,
    customerPhone: dbOrder.customer_phone,
    paymentMethod: dbOrder.payment_method as PaymentMethod,
    paymentStatus: dbOrder.payment_status as PaymentStatus,
    createdAt: new Date(dbOrder.created_at),
    totalAmount: dbOrder.total_amount,
  };
}

/**
 * Converts a database Review to a frontend Review
 */
function adaptDBReviewToFrontend(dbReview: DBReview): FrontendReview {
  return {
    id: dbReview.id,
    voucherId: dbReview.voucher_id,
    rating: dbReview.rating,
    comment: dbReview.comment ?? '',
    customerName: dbReview.customer_name,
    createdAt: new Date(dbReview.created_at),
  };
}

// ============================================================================
// localStorage Helper Functions
// ============================================================================

function parseStoredServices(data: string | null): FrontendService[] {
  if (!data) return [];
  try {
    return JSON.parse(data) as FrontendService[];
  } catch {
    return [];
  }
}

function parseStoredVouchers(data: string | null): FrontendVoucher[] {
  if (!data) return [];
  try {
    const parsed = JSON.parse(data) as Array<Record<string, unknown>>;
    return parsed.map((v) => ({
      ...v,
      purchaseDate: new Date(v.purchaseDate as string),
      expiryDate: new Date(v.expiryDate as string),
      redeemedDate: v.redeemedDate ? new Date(v.redeemedDate as string) : undefined,
    })) as FrontendVoucher[];
  } catch {
    return [];
  }
}

function parseStoredOrders(data: string | null): FrontendOrder[] {
  if (!data) return [];
  try {
    const parsed = JSON.parse(data) as Array<Record<string, unknown>>;
    return parsed.map((o) => ({
      ...o,
      createdAt: new Date(o.createdAt as string),
      voucher: {
        ...(o.voucher as Record<string, unknown>),
        purchaseDate: new Date((o.voucher as Record<string, unknown>).purchaseDate as string),
        expiryDate: new Date((o.voucher as Record<string, unknown>).expiryDate as string),
        redeemedDate: (o.voucher as Record<string, unknown>).redeemedDate
          ? new Date((o.voucher as Record<string, unknown>).redeemedDate as string)
          : undefined,
      },
    })) as FrontendOrder[];
  } catch {
    return [];
  }
}

function parseStoredReviews(data: string | null): FrontendReview[] {
  if (!data) return [];
  try {
    const parsed = JSON.parse(data) as Array<Record<string, unknown>>;
    return parsed.map((r) => ({
      ...r,
      createdAt: new Date(r.createdAt as string),
    })) as FrontendReview[];
  } catch {
    return [];
  }
}

// ============================================================================
// Context
// ============================================================================

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

export function StoreProvider({ children }: StoreProviderProps) {
  const [services, setServices] = useState<FrontendService[]>([]);
  const [vouchers, setVouchers] = useState<FrontendVoucher[]>([]);
  const [orders, setOrders] = useState<FrontendOrder[]>([]);
  const [reviews, setReviews] = useState<FrontendReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  /**
   * Fetches all data from Supabase and updates state
   */
  const fetchDataFromSupabase = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [dbServices, dbVouchers, dbOrders, dbReviews] = await Promise.all([
        getServices(),
        getVouchers(),
        getOrders(),
        getReviews(),
      ]);

      // Convert DB types to frontend types
      const frontendServices = dbServices.map(adaptDBServiceToFrontend);
      const frontendVouchers = dbVouchers.map(adaptDBVoucherToFrontend);
      const frontendOrders = dbOrders.map(adaptDBOrderToFrontend);
      const frontendReviews = dbReviews.map(adaptDBReviewToFrontend);

      setServices(frontendServices);
      setVouchers(frontendVouchers);
      setOrders(frontendOrders);
      setReviews(frontendReviews);

      // Cache in localStorage for offline support
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(frontendServices));
        localStorage.setItem(STORAGE_KEYS.VOUCHERS, JSON.stringify(frontendVouchers));
        localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(frontendOrders));
        localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(frontendReviews));
      }
    } catch (err) {
      console.error('Error fetching data from Supabase:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');

      // Fallback to localStorage cache
      if (typeof window !== 'undefined') {
        const cachedServices = parseStoredServices(localStorage.getItem(STORAGE_KEYS.SERVICES));
        const cachedVouchers = parseStoredVouchers(localStorage.getItem(STORAGE_KEYS.VOUCHERS));
        const cachedOrders = parseStoredOrders(localStorage.getItem(STORAGE_KEYS.ORDERS));
        const cachedReviews = parseStoredReviews(localStorage.getItem(STORAGE_KEYS.REVIEWS));

        if (cachedServices.length > 0) setServices(cachedServices);
        if (cachedVouchers.length > 0) setVouchers(cachedVouchers);
        if (cachedOrders.length > 0) setOrders(cachedOrders);
        if (cachedReviews.length > 0) setReviews(cachedReviews);
      }
    } finally {
      setIsLoading(false);
      setIsHydrated(true);
    }
  }, []);

  // Initialize state from Supabase on mount
  useEffect(() => {
    fetchDataFromSupabase();
  }, [fetchDataFromSupabase]);

  // Cross-tab synchronization for localStorage
  useEffect(() => {
    function handleStorageChange(event: StorageEvent) {
      if (event.key === STORAGE_KEYS.SERVICES && event.newValue) {
        setServices(parseStoredServices(event.newValue));
      }
      if (event.key === STORAGE_KEYS.VOUCHERS && event.newValue) {
        setVouchers(parseStoredVouchers(event.newValue));
      }
      if (event.key === STORAGE_KEYS.ORDERS && event.newValue) {
        setOrders(parseStoredOrders(event.newValue));
      }
      if (event.key === STORAGE_KEYS.REVIEWS && event.newValue) {
        setReviews(parseStoredReviews(event.newValue));
      }
    }

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  /**
   * Adds a voucher to both Supabase and local state
   */
  const addVoucher = useCallback(
    async (voucher: FrontendVoucher) => {
      try {
        // Create voucher in Supabase
        const dbVoucher = await createVoucherAction({
          service_id: voucher.service.id,
          recipient_name: voucher.recipientName,
          recipient_email: voucher.recipientEmail,
          sender_name: voucher.senderName,
          sender_message: voucher.senderMessage || null,
          expiry_date: voucher.expiryDate.toISOString(),
          amount: voucher.amount,
        });

        if (dbVoucher) {
          // Refresh data from Supabase to get the complete voucher with service
          await fetchDataFromSupabase();
        } else {
          // Fallback: add to local state only
          setVouchers((prev) => [...prev, voucher]);
          if (isHydrated) {
            localStorage.setItem(STORAGE_KEYS.VOUCHERS, JSON.stringify([...vouchers, voucher]));
          }
        }
      } catch (err) {
        console.error('Error adding voucher:', err);
        // Fallback: add to local state only
        setVouchers((prev) => [...prev, voucher]);
        if (isHydrated) {
          localStorage.setItem(STORAGE_KEYS.VOUCHERS, JSON.stringify([...vouchers, voucher]));
        }
      }
    },
    [vouchers, isHydrated, fetchDataFromSupabase]
  );

  /**
   * Adds an order to both Supabase and local state
   */
  const addOrder = useCallback(
    async (order: FrontendOrder) => {
      try {
        // Create order in Supabase
        const dbOrder = await createOrderAction({
          voucher_id: order.voucher.id,
          customer_email: order.customerEmail,
          customer_name: order.customerName,
          customer_phone: order.customerPhone,
          payment_method: order.paymentMethod as 'CREDIT_CARD' | 'BANK_TRANSFER' | 'E_WALLET',
          payment_status: order.paymentStatus as
            | 'PENDING'
            | 'COMPLETED'
            | 'FAILED'
            | 'REFUNDED',
          total_amount: order.totalAmount,
        });

        if (dbOrder) {
          // Refresh data from Supabase
          await fetchDataFromSupabase();
        } else {
          // Fallback: add to local state only
          setOrders((prev) => [...prev, order]);
          if (isHydrated) {
            localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([...orders, order]));
          }
        }
      } catch (err) {
        console.error('Error adding order:', err);
        // Fallback: add to local state only
        setOrders((prev) => [...prev, order]);
        if (isHydrated) {
          localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([...orders, order]));
        }
      }
    },
    [orders, isHydrated, fetchDataFromSupabase]
  );

  /**
   * Adds a review to both Supabase and local state
   */
  const addReview = useCallback(
    async (review: FrontendReview) => {
      try {
        // Create review in Supabase
        const dbReview = await createReviewAction({
          voucher_id: review.voucherId,
          rating: review.rating,
          comment: review.comment || null,
          customer_name: review.customerName,
        });

        if (dbReview) {
          // Refresh data from Supabase
          await fetchDataFromSupabase();
        } else {
          // Fallback: add to local state only
          setReviews((prev) => [...prev, review]);
          if (isHydrated) {
            localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify([...reviews, review]));
          }
        }
      } catch (err) {
        console.error('Error adding review:', err);
        // Fallback: add to local state only
        setReviews((prev) => [...prev, review]);
        if (isHydrated) {
          localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify([...reviews, review]));
        }
      }
    },
    [reviews, isHydrated, fetchDataFromSupabase]
  );

  /**
   * Redeems a voucher by code
   */
  const redeemVoucher = useCallback(
    async (code: string): Promise<{ success: boolean; message: string }> => {
      try {
        // Try to redeem via Supabase
        const result = await redeemVoucherAction(code);

        if (result.success) {
          // Refresh data from Supabase
          await fetchDataFromSupabase();
        }

        return result;
      } catch (err) {
        console.error('Error redeeming voucher:', err);

        // Fallback: local redemption
        const voucherIndex = vouchers.findIndex(
          (v) => v.code.toLowerCase() === code.toLowerCase()
        );

        if (voucherIndex === -1) {
          return {
            success: false,
            message: 'Voucher not found. Please check the code and try again.',
          };
        }

        const voucher = vouchers[voucherIndex];

        if (voucher.isRedeemed) {
          return {
            success: false,
            message: `This voucher has already been redeemed on ${voucher.redeemedDate?.toLocaleDateString()}.`,
          };
        }

        if (new Date() > voucher.expiryDate) {
          return {
            success: false,
            message: `This voucher expired on ${voucher.expiryDate.toLocaleDateString()}.`,
          };
        }

        // Update the voucher as redeemed locally
        setVouchers((prev) =>
          prev.map((v, i) =>
            i === voucherIndex ? { ...v, isRedeemed: true, redeemedDate: new Date() } : v
          )
        );

        return {
          success: true,
          message: `Voucher for "${voucher.service.name}" has been successfully redeemed!`,
        };
      }
    },
    [vouchers, fetchDataFromSupabase]
  );

  /**
   * Gets a voucher by its code
   */
  const getVoucherByCode = useCallback(
    (code: string): FrontendVoucher | undefined => {
      return vouchers.find((v) => v.code.toLowerCase() === code.toLowerCase());
    },
    [vouchers]
  );

  /**
   * Gets a service by its ID
   */
  const getServiceById = useCallback(
    (id: string): FrontendService | undefined => {
      return services.find((s) => s.id === id);
    },
    [services]
  );

  /**
   * Refreshes all data from Supabase
   */
  const refreshData = useCallback(async () => {
    await fetchDataFromSupabase();
  }, [fetchDataFromSupabase]);

  const value: StoreContextType = {
    services,
    vouchers,
    orders,
    reviews,
    isLoading,
    error,
    addVoucher,
    addOrder,
    addReview,
    redeemVoucher,
    getVoucherByCode,
    getServiceById,
    refreshData,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useStore(): StoreContextType {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
