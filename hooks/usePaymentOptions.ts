"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ScalevCheckoutConfig,
  ScalevPaymentMethod,
  ScalevVABankCode,
} from "@/lib/scalev/types";

const PAYMENT_OPTIONS_ERROR = "Gagal memuat metode pembayaran.";
const PAYMENT_OPTIONS_RETRY_ERROR =
  "Gagal memuat metode pembayaran. Coba muat ulang.";
const PAYMENT_OPTIONS_UNAVAILABLE =
  "Metode pembayaran sedang tidak tersedia.";

export function usePaymentOptions(initialPaymentConfig: ScalevCheckoutConfig) {
  const retryInFlightRef = useRef(false);
  const initialPaymentMethod =
    initialPaymentConfig.paymentOptions[0]?.code ?? null;
  const [paymentConfig, setPaymentConfig] =
    useState<ScalevCheckoutConfig | null>(initialPaymentConfig);
  const [paymentError, setPaymentError] = useState<string | null>(
    initialPaymentMethod ? null : PAYMENT_OPTIONS_UNAVAILABLE
  );
  const [isPaymentConfigRetrying, setIsPaymentConfigRetrying] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<ScalevPaymentMethod | null>(initialPaymentMethod);
  const [subPaymentMethod, setSubPaymentMethod] =
    useState<ScalevVABankCode | "">("");

  const paymentOptions = useMemo(
    () => paymentConfig?.paymentOptions ?? [],
    [paymentConfig]
  );
  const selectedPaymentOption = useMemo(
    () => paymentOptions.find((option) => option.code === paymentMethod) ?? null,
    [paymentMethod, paymentOptions]
  );
  const isPaymentConfigLoading =
    isPaymentConfigRetrying || (!paymentConfig && !paymentError);

  const retryPaymentOptions = async () => {
    if (retryInFlightRef.current) {
      return;
    }

    retryInFlightRef.current = true;
    setIsPaymentConfigRetrying(true);
    setPaymentError(null);

    try {
      const response = await fetch("/api/scalev/payment-options", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(PAYMENT_OPTIONS_ERROR);
      }

      const result = (await response.json()) as {
        success: boolean;
        config?: ScalevCheckoutConfig;
      };

      if (!result.success || !result.config) {
        throw new Error(PAYMENT_OPTIONS_ERROR);
      }

      const nextMethod = result.config.paymentOptions[0]?.code ?? null;
      setPaymentConfig(result.config);
      setPaymentMethod((current) =>
        current &&
        result.config?.paymentOptions.some((option) => option.code === current)
          ? current
          : nextMethod
      );

      if (!nextMethod) {
        setPaymentError(PAYMENT_OPTIONS_UNAVAILABLE);
      }
    } catch (error) {
      console.error("Failed to load Scalev payment options:", error);
      setPaymentError(PAYMENT_OPTIONS_RETRY_ERROR);
    } finally {
      retryInFlightRef.current = false;
      setIsPaymentConfigRetrying(false);
    }
  };

  useEffect(() => {
    if (paymentMethod !== "va") {
      setSubPaymentMethod("");
      return;
    }

    if (
      selectedPaymentOption?.subMethods?.length &&
      !selectedPaymentOption.subMethods.includes(
        subPaymentMethod as ScalevVABankCode
      )
    ) {
      setSubPaymentMethod(selectedPaymentOption.subMethods[0]);
    }
  }, [paymentMethod, selectedPaymentOption, subPaymentMethod]);

  return {
    paymentConfig,
    paymentError,
    isPaymentConfigRetrying,
    paymentMethod,
    setPaymentMethod,
    subPaymentMethod,
    setSubPaymentMethod,
    paymentOptions,
    selectedPaymentOption,
    isPaymentConfigLoading,
    retryPaymentOptions,
  };
}
