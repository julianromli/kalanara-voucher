import { CartCheckoutClient } from "@/app/checkout/cart/cart-checkout-client";
import {
  getScalevCheckoutConfig,
  getUnavailableScalevCheckoutConfig,
} from "@/lib/scalev/checkout-config";

export default async function CartCheckoutPage() {
  const initialPaymentConfig = await getScalevCheckoutConfig().catch((error) => {
    console.error("[Scalev] Failed to preload cart checkout config:", error);
    return getUnavailableScalevCheckoutConfig();
  });

  return (
    <CartCheckoutClient initialPaymentConfig={initialPaymentConfig} />
  );
}
