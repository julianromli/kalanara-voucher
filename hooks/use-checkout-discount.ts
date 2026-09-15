"use client";

import { useEffect, useState } from "react";
import type {
  CheckoutDiscountSummary,
  DiscountCodePreviewResponse,
} from "@/lib/scalev/types";
import { normalizePhoneInput } from "@/lib/checkout/client";

type Toast = (message: string, type: "success" | "error") => void;

interface UseCheckoutDiscountOptions {
  customerEmail: string;
  customerPhone: string;
  serviceIds: string[];
  resetKey?: number;
  showToast: Toast;
}

export function useCheckoutDiscount({
  customerEmail,
  customerPhone,
  serviceIds,
  resetKey,
  showToast,
}: UseCheckoutDiscountOptions) {
  const [codeInput, setCodeInputState] = useState("");
  const [appliedDiscount, setAppliedDiscount] =
    useState<CheckoutDiscountSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    setAppliedDiscount(null);
    setError(null);
  }, [customerEmail, customerPhone, resetKey]);

  const setCodeInput = (value: string) => {
    setCodeInputState(value.toUpperCase());
    setError(null);
  };

  const applyDiscount = async () => {
    if (!codeInput.trim()) {
      showToast("Masukkan kode diskon terlebih dahulu.", "error");
      return;
    }
    if (!customerEmail.trim() || !customerPhone.trim()) {
      showToast(
        "Isi email dan WhatsApp pembeli dulu sebelum pakai kode diskon.",
        "error"
      );
      return;
    }

    setIsApplying(true);
    setError(null);
    try {
      const response = await fetch("/api/discount-codes/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: customerEmail.trim(),
          customerPhone: normalizePhoneInput(customerPhone),
          discountCode: codeInput,
          serviceIds,
        }),
      });
      const result = (await response.json()) as DiscountCodePreviewResponse;
      if (!response.ok || !result.success || !result.pricing) {
        throw new Error(result.error || "Kode diskon belum bisa dipakai.");
      }
      setAppliedDiscount(result.pricing);
      setCodeInputState(result.pricing.code);
      showToast("Kode diskon berhasil diterapkan.", "success");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Kode diskon belum bisa dipakai.";
      setAppliedDiscount(null);
      setError(message);
      showToast(message, "error");
    } finally {
      setIsApplying(false);
    }
  };

  const removeDiscount = () => {
    setAppliedDiscount(null);
    setCodeInputState("");
    setError(null);
  };

  return {
    codeInput,
    setCodeInput,
    appliedDiscount,
    error,
    isApplying,
    applyDiscount,
    removeDiscount,
  };
}
