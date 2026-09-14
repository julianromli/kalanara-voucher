import { CartCheckoutClient } from "@/app/checkout/cart/cart-checkout-client";
import { getScalevCheckoutConfig } from "@/lib/scalev/checkout-config";

export default async function CartCheckoutPage() {
  const initialPaymentConfig = await getScalevCheckoutConfig();

  return (
    <CartCheckoutClient initialPaymentConfig={initialPaymentConfig} />
  );
}
