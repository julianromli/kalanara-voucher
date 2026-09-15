import { Suspense } from "react";
import { CartCheckoutClient } from "@/app/checkout/cart/cart-checkout-client";
import { CheckoutLoadingSkeleton } from "@/app/checkout/[id]/loading";
import {
  getScalevCheckoutConfig,
  getUnavailableScalevCheckoutConfig,
} from "@/lib/scalev/checkout-config";

export default function CartCheckoutPage() {
  return (
    <Suspense fallback={<CheckoutLoadingSkeleton />}>
      <ProviderCartCheckout />
    </Suspense>
  );
}

async function ProviderCartCheckout() {
  const initialPaymentConfig = await getScalevCheckoutConfig().catch((error) => {
    console.error("[Scalev] Failed to preload cart checkout config:", error);
    return getUnavailableScalevCheckoutConfig();
  });

  return (
    <CartCheckoutClient initialPaymentConfig={initialPaymentConfig} />
  );
}
