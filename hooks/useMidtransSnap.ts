"use client";

/**
 * useMidtransSnap Hook
 * @description React hook for integrating Midtrans Snap payment popup
 * 
 * This hook handles:
 * - Dynamic loading of Snap.js script
 * - Payment popup initialization
 * - Callback handling (success, pending, error, close)
 * - Loading state management
 * 
 * @see https://docs.midtrans.com/docs/snap-integration-guide
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { SnapResult } from "@/lib/midtrans/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Snap.js window interface
 */
declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options: {
          onSuccess?: (result: SnapResult) => void;
          onPending?: (result: SnapResult) => void;
          onError?: (result: SnapResult) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

/**
 * Options for useMidtransSnap hook
 */
export interface UseMidtransSnapOptions {
  /** Callback when payment is successful */
  onSuccess?: (result: SnapResult) => void;
  /** Callback when payment is pending (e.g., bank transfer) */
  onPending?: (result: SnapResult) => void;
  /** Callback when payment fails */
  onError?: (result: SnapResult) => void;
  /** Callback when user closes the popup without completing */
  onClose?: () => void;
}

/**
 * Return type for useMidtransSnap hook
 */
export interface UseMidtransSnapReturn {
  /** Function to initiate payment with a Snap token */
  pay: (token: string) => void;
  /** Whether Snap.js is currently loading */
  isLoading: boolean;
  /** Whether Snap.js has been loaded successfully */
  isReady: boolean;
  /** Error message if Snap.js failed to load */
  error: string | null;
}


// ============================================================================
// Constants
// ============================================================================

const SNAP_SCRIPT_ID = "midtrans-snap-script";

/**
 * Get Snap.js URL based on environment
 */
function getSnapUrl(): string {
  const isProduction = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true";
  return isProduction
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";
}

/**
 * Get Midtrans client key from environment
 */
function getClientKey(): string {
  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
  if (!clientKey) {
    throw new Error("NEXT_PUBLIC_MIDTRANS_CLIENT_KEY is not configured");
  }
  return clientKey;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * React hook for Midtrans Snap integration
 * 
 * @example
 * ```tsx
 * const { pay, isLoading, isReady, error } = useMidtransSnap({
 *   onSuccess: (result) => {
 *     console.log("Payment successful:", result);
 *     router.push(`/checkout/success?order=${result.order_id}`);
 *   },
 *   onPending: (result) => {
 *     console.log("Payment pending:", result);
 *     router.push(`/checkout/pending?order=${result.order_id}`);
 *   },
 *   onError: (result) => {
 *     console.error("Payment failed:", result);
 *     toast.error("Pembayaran gagal. Silakan coba lagi.");
 *   },
 *   onClose: () => {
 *     console.log("User closed payment popup");
 *   },
 * });
 * 
 * // Later, when you have a token from the API:
 * pay(snapToken);
 * ```
 */
export function useMidtransSnap(
  options: UseMidtransSnapOptions = {}
): UseMidtransSnapReturn {
  const { onSuccess, onPending, onError, onClose } = options;
  
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Store callbacks in refs to avoid re-running effect when they change
  const callbacksRef = useRef({ onSuccess, onPending, onError, onClose });
  
  // Update callbacks ref in effect to avoid accessing ref during render
  useEffect(() => {
    callbacksRef.current = { onSuccess, onPending, onError, onClose };
  }, [onSuccess, onPending, onError, onClose]);

  // Load Snap.js script on mount
  useEffect(() => {
    // Check if script is already loaded
    const existingScript = document.getElementById(SNAP_SCRIPT_ID);
    if (existingScript) {
      // Script already exists, check if snap is ready
      if (window.snap) {
        setIsReady(true);
        setIsLoading(false);
      } else {
        // Script exists but snap not ready yet, wait for it
        existingScript.addEventListener("load", () => {
          setIsReady(true);
          setIsLoading(false);
        });
      }
      return;
    }

    // Create and load script
    const script = document.createElement("script");
    script.id = SNAP_SCRIPT_ID;
    script.src = getSnapUrl();
    script.type = "text/javascript";
    script.async = true;
    
    try {
      script.setAttribute("data-client-key", getClientKey());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get client key");
      setIsLoading(false);
      return;
    }

    script.onload = () => {
      setIsReady(true);
      setIsLoading(false);
    };

    script.onerror = () => {
      setError("Gagal memuat Midtrans Snap. Silakan refresh halaman.");
      setIsLoading(false);
    };

    document.head.appendChild(script);

    // Cleanup function
    return () => {
      // Don't remove the script on unmount as it might be used by other components
      // The script will be reused if the hook is mounted again
    };
  }, []);


  /**
   * Initiate payment with a Snap token
   */
  const pay = useCallback((token: string) => {
    if (!window.snap) {
      console.error("[useMidtransSnap] Snap.js is not loaded");
      callbacksRef.current.onError?.({
        status_code: "500",
        status_message: "Snap.js belum dimuat",
        transaction_id: "",
        order_id: "",
        gross_amount: "",
        payment_type: "",
        transaction_time: "",
        transaction_status: "deny",
      });
      return;
    }

    if (!token) {
      console.error("[useMidtransSnap] No token provided");
      callbacksRef.current.onError?.({
        status_code: "400",
        status_message: "Token tidak valid",
        transaction_id: "",
        order_id: "",
        gross_amount: "",
        payment_type: "",
        transaction_time: "",
        transaction_status: "deny",
      });
      return;
    }

    try {
      window.snap.pay(token, {
        onSuccess: (result) => {
          console.log("[useMidtransSnap] Payment success:", result.order_id);
          callbacksRef.current.onSuccess?.(result);
        },
        onPending: (result) => {
          console.log("[useMidtransSnap] Payment pending:", result.order_id);
          callbacksRef.current.onPending?.(result);
        },
        onError: (result) => {
          console.error("[useMidtransSnap] Payment error:", result);
          callbacksRef.current.onError?.(result);
        },
        onClose: () => {
          console.log("[useMidtransSnap] Payment popup closed");
          callbacksRef.current.onClose?.();
        },
      });
    } catch (err) {
      console.error("[useMidtransSnap] Error calling snap.pay:", err);
      callbacksRef.current.onError?.({
        status_code: "500",
        status_message: err instanceof Error ? err.message : "Unknown error",
        transaction_id: "",
        order_id: "",
        gross_amount: "",
        payment_type: "",
        transaction_time: "",
        transaction_status: "deny",
      });
    }
  }, []);

  return {
    pay,
    isLoading,
    isReady,
    error,
  };
}

export default useMidtransSnap;
