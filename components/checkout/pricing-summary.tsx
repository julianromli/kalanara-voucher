import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/constants";
import type { CheckoutDiscountSummary } from "@/lib/scalev/types";

interface DiscountControl {
  codeInput: string;
  setCodeInput: (value: string) => void;
  appliedDiscount: CheckoutDiscountSummary | null;
  error: string | null;
  isApplying: boolean;
  applyDiscount: () => Promise<void>;
  removeDiscount: () => void;
}

interface PricingSummaryProps {
  subtotal: number;
  total: number;
  discount: DiscountControl;
  discountHint: string;
  isProcessing: boolean;
  isSubmitDisabled: boolean;
  children: React.ReactNode;
}

export function CheckoutSubmitButton({
  isProcessing,
  disabled,
  className,
}: {
  isProcessing: boolean;
  disabled: boolean;
  className: string;
}) {
  return (
    <Button
      type="submit"
      disabled={disabled}
      className={className}
      aria-busy={isProcessing}
    >
      {isProcessing ? (
        <>
          <Loader2 className="mr-2 size-5 animate-spin" />
          Memproses...
        </>
      ) : (
        "Lanjut ke Pembayaran"
      )}
    </Button>
  );
}

export function PricingSummary({
  subtotal,
  total,
  discount,
  discountHint,
  isProcessing,
  isSubmitDisabled,
  children,
}: PricingSummaryProps) {
  const discountAmount = discount.appliedDiscount?.discountAmount ?? 0;
  return (
    <aside className="lg:sticky lg:top-24 lg:h-fit">
      <div className="animate-scale-in rounded-2xl border border-border bg-card p-4 sm:p-6">
        {children}
        <div className="space-y-3 border-t border-border pt-4">
          <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Kode diskon</p>
                <p className="text-xs text-muted-foreground">{discountHint}</p>
              </div>
              {discount.appliedDiscount ? (
                <button
                  type="button"
                  onClick={discount.removeDiscount}
                  className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
                >
                  Hapus
                </button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Input
                value={discount.codeInput}
                onChange={(event) => discount.setCodeInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void discount.applyDiscount();
                  }
                }}
                placeholder="Masukkan kode promo"
                disabled={isProcessing || discount.isApplying}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void discount.applyDiscount()}
                disabled={isProcessing || discount.isApplying}
              >
                {discount.isApplying ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Pakai"
                )}
              </Button>
            </div>
            {discount.appliedDiscount ? (
              <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-sm text-foreground">
                <p className="font-medium">
                  Kode {discount.appliedDiscount.code} aktif
                </p>
                <p className="text-xs text-muted-foreground">
                  Hemat {formatCurrency(discountAmount)}
                </p>
              </div>
            ) : null}
            {discount.error ? (
              <p className="text-xs text-destructive" role="alert">
                {discount.error}
              </p>
            ) : null}
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discount.appliedDiscount ? (
            <div className="flex justify-between text-sm text-emerald-700 dark:text-emerald-300">
              <span>Diskon</span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Biaya Layanan</span>
            <span>Gratis</span>
          </div>
          <div className="flex justify-between border-t border-border pt-3 font-semibold text-foreground">
            <span>Total</span>
            <span className="text-lg">{formatCurrency(total)}</span>
          </div>
        </div>
        <CheckoutSubmitButton
          isProcessing={isProcessing}
          disabled={isSubmitDisabled}
          className="btn-hover-lift mt-6 hidden min-h-14 w-full bg-primary text-base text-primary-foreground hover:bg-primary/90 md:flex"
        />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Pembayaran diproses aman melalui Scalev.
        </p>
      </div>
    </aside>
  );
}

export function MobileCheckoutCta({
  total,
  isProcessing,
  disabled,
}: {
  total: number;
  isProcessing: boolean;
  disabled: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-4 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Total
          </p>
          <p className="text-lg font-semibold text-foreground">
            {formatCurrency(total)}
          </p>
        </div>
        <CheckoutSubmitButton
          isProcessing={isProcessing}
          disabled={disabled}
          className="min-h-12 flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
        />
      </div>
    </div>
  );
}
