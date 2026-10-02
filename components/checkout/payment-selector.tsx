import { AlertCircle, CreditCard } from "lucide-react";
import {
  getPaymentMark,
  PaymentMethodMark,
} from "@/components/checkout/payment-method-mark";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPaymentMethodDescription } from "@/lib/checkout/client";
import type {
  ScalevCheckoutConfig,
  ScalevPaymentMethod,
  ScalevPaymentOption,
  ScalevVABankCode,
} from "@/lib/scalev/types";

interface PaymentSelectorProps {
  idPrefix: string;
  paymentConfig: ScalevCheckoutConfig | null;
  paymentError: string | null;
  paymentMethod: ScalevPaymentMethod | null;
  subPaymentMethod: ScalevVABankCode | "";
  paymentOptions: ScalevPaymentOption[];
  selectedPaymentOption: ScalevPaymentOption | null;
  isLoading: boolean;
  onPaymentMethodChange: (method: ScalevPaymentMethod) => void;
  onSubPaymentMethodChange: (bank: ScalevVABankCode) => void;
  onRetry: () => Promise<void>;
  className?: string;
}

export function PaymentSelector(props: PaymentSelectorProps) {
  const {
    idPrefix,
    paymentConfig,
    paymentError,
    paymentMethod,
    subPaymentMethod,
    paymentOptions,
    selectedPaymentOption,
    isLoading,
    onPaymentMethodChange,
    onSubPaymentMethodChange,
    onRetry,
    className = "",
  } = props;
  return (
    <section
      className={`${className} rounded-2xl border border-border bg-card p-4 sm:p-6`}
    >
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
        <CreditCard size={20} aria-hidden="true" /> Metode pembayaran
      </h2>
      {paymentConfig?.paymentNotice ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {paymentConfig.paymentNotice}
        </div>
      ) : null}
      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-border bg-background p-4">
          <div className="space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <p className="text-sm text-muted-foreground">
              Sedang menyiapkan metode pembayaran...
            </p>
          </div>
        </div>
      ) : paymentError ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 text-destructive" />
            <div>
              <p className="font-medium text-foreground">
                Metode pembayaran belum berhasil dimuat
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{paymentError}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => void onRetry()}
              >
                Coba Muat Ulang
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paymentOptions.map((option) => {
              const radioId = `${idPrefix}-payment-${option.code}`;
              const selected = paymentMethod === option.code;
              const mark = getPaymentMark(option.code);
              return (
                <label
                  key={option.code}
                  htmlFor={radioId}
                  className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-[background-color,border-color] focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
                    selected
                      ? "border-primary bg-muted"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <input
                    id={radioId}
                    type="radio"
                    name="paymentMethod"
                    value={option.code}
                    checked={selected}
                    onChange={() => onPaymentMethodChange(option.code)}
                    className="sr-only"
                  />
                  <PaymentMethodMark code={option.code} />
                  <span
                    className={
                      mark?.wordmark
                        ? "sr-only"
                        : "font-medium text-foreground"
                    }
                  >
                    {option.label}
                  </span>
                  {option.code === "qris" ? (
                    <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      Paling mudah
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
          {paymentMethod ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {getPaymentMethodDescription(paymentMethod)}
            </p>
          ) : null}
          {paymentMethod === "va" &&
          selectedPaymentOption?.subMethods?.length ? (
            <div className="mt-4 space-y-2">
              <label
                htmlFor={`${idPrefix}-va-bank`}
                className="block text-sm font-medium text-muted-foreground"
              >
                Bank Virtual Account
              </label>
              <select
                id={`${idPrefix}-va-bank`}
                value={subPaymentMethod}
                onChange={(event) =>
                  onSubPaymentMethodChange(
                    event.target.value as ScalevVABankCode
                  )
                }
                className="min-h-12 w-full rounded-lg border border-border bg-background px-3 text-base"
              >
                {selectedPaymentOption.subMethods.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
