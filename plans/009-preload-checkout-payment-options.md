# 009 — Preload checkout payment options on the server

- **Status**: DONE
- **Commit**: b94c4ae
- **Severity**: HIGH
- **Category**: Performance
- **Rule**: Beyond the scan
- **Estimated scope**: 7 files, moderate server/client boundary refactor

## Problem

Both checkout routes render without payment configuration, hydrate, and only then call an internal route that asks Scalev for availability. This adds a client waterfall and a second render before the primary payment controls are usable.

```tsx
// app/checkout/[id]/page.tsx:40-49 — current
export default async function CheckoutPage({ params }: PageProps) {
  const { id } = await params;
  const service = toServiceModel(await getServiceById(id));

  if (!service || !service.id) {
    notFound();
  }

  return <CheckoutPageClient service={service} />;
}
```

```tsx
// app/checkout/cart/page.tsx:1-5 — current
import { CartCheckoutClient } from "@/app/checkout/cart/cart-checkout-client";

export default function CartCheckoutPage() {
  return <CartCheckoutClient />;
}
```

```tsx
// app/checkout/[id]/checkout-page-client.tsx:281-334 — current
  useEffect(() => {
    let cancelled = false;

    async function loadPaymentOptions() {
      setPaymentError(null);

      try {
        const response = await fetch("/api/scalev/payment-options", {
          cache: "no-store",
        });
        const result = (await response.json()) as {
          success: boolean;
          config?: ScalevCheckoutConfig;
        };

        if (cancelled) {
          return;
        }

        if (!response.ok || !result.success || !result.config) {
          throw new Error("Gagal memuat metode pembayaran.");
        }

        setPaymentConfig(result.config);
        const nextMethod = result.config.paymentOptions[0]?.code ?? null;

        if (!nextMethod) {
          setPaymentError("Metode pembayaran sedang tidak tersedia.");
          return;
        }

        setPaymentMethod((current) => {
          if (current && result.config?.paymentOptions.some((option) => option.code === current)) {
            return current;
          }

          return nextMethod;
        });
      } catch (error) {
        console.error("Failed to load Scalev payment options:", error);
        if (!cancelled) {
          setPaymentConfig(null);
          setPaymentMethod(null);
          setSubPaymentMethod("");
          setPaymentError("Gagal memuat metode pembayaran. Coba muat ulang.");
        }
      }
    }

    void loadPaymentOptions();

    return () => {
      cancelled = true;
    };
  }, [paymentConfigReloadKey]);
```

```tsx
// app/checkout/cart/cart-checkout-client.tsx:201-246 — current
  useEffect(() => {
    let cancelled = false;

    async function loadPaymentOptions() {
      setPaymentError(null);
      try {
        const response = await fetch("/api/scalev/payment-options", { cache: "no-store" });
        const result = (await response.json()) as {
          success: boolean;
          config?: ScalevCheckoutConfig;
        };

        if (cancelled) return;
        if (!response.ok || !result.success || !result.config) {
          throw new Error("Gagal memuat metode pembayaran.");
        }

        setPaymentConfig(result.config);
        const nextMethod = result.config.paymentOptions[0]?.code ?? null;
        if (!nextMethod) {
          setPaymentError("Metode pembayaran sedang tidak tersedia.");
          return;
        }

        setPaymentMethod((current) =>
          current && result.config?.paymentOptions.some((option) => option.code === current)
            ? current
            : nextMethod
        );
      } catch (error) {
        console.error("Failed to load Scalev payment options:", error);
        if (!cancelled) {
          setPaymentConfig(null);
          setPaymentMethod(null);
          setSubPaymentMethod("");
          setPaymentError("Gagal memuat metode pembayaran. Coba muat ulang.");
        }
      }
    }

    void loadPaymentOptions();
    return () => {
      cancelled = true;
    };
  }, [paymentConfigReloadKey]);
```

Payment creation already performs fresh provider validation. Preload data must never replace it:

```ts
// app/api/scalev/create-payment/route.ts:266-282 — current
    const availability = await getScalevCheckoutAvailability();
    const methodAllowed = availability.paymentMethods.includes(
      validatedData.paymentMethod
    );
    const subMethodAllowed =
      validatedData.paymentMethod !== "va" ||
      availability.subPaymentMethods.includes(
        validatedData.subPaymentMethod as ScalevVABankCode
      );

    if (!methodAllowed || !subMethodAllowed) {
      return errorResponse(
        "Metode pembayaran tidak tersedia.",
        "PAYMENT_METHOD_UNAVAILABLE",
        400
      );
    }
```

## Target

Create one server-only loader shared by pages and the retry route:

```ts
// lib/scalev/checkout-config.ts — target
import "server-only";

import { getScalevCheckoutAvailability } from "@/lib/scalev/client";
import { buildCheckoutConfig, getScalevConfig } from "@/lib/scalev/config";
import type {
  ScalevCheckoutConfig,
  ScalevPaymentMethod,
  ScalevVABankCode,
} from "@/lib/scalev/types";

export async function getScalevCheckoutConfig(): Promise<ScalevCheckoutConfig> {
  const availability = await getScalevCheckoutAvailability();
  const config = getScalevConfig();

  return buildCheckoutConfig(
    availability.paymentMethods as ScalevPaymentMethod[],
    availability.subPaymentMethods as ScalevVABankCode[],
    config.disabledPaymentMethods
  );
}
```

```tsx
// app/checkout/[id]/page.tsx — target
const [serviceResult, initialPaymentConfig] = await Promise.all([
  getServiceById(id),
  getScalevCheckoutConfig(),
]);
const service = toServiceModel(serviceResult);
if (!service || !service.id) notFound();
return (
  <CheckoutPageClient
    service={service}
    initialPaymentConfig={initialPaymentConfig}
  />
);
```

```tsx
// app/checkout/cart/page.tsx — target
export default async function CartCheckoutPage() {
  const initialPaymentConfig = await getScalevCheckoutConfig();
  return <CartCheckoutClient initialPaymentConfig={initialPaymentConfig} />;
}
```

Both clients must initialize from the prop and fetch only on explicit retry:

```tsx
// target pattern for both checkout clients
interface CheckoutPaymentProps {
  initialPaymentConfig: ScalevCheckoutConfig;
}

const initialPaymentMethod =
  initialPaymentConfig.paymentOptions[0]?.code ?? null;
const [paymentConfig, setPaymentConfig] =
  useState<ScalevCheckoutConfig | null>(initialPaymentConfig);
const [paymentMethod, setPaymentMethod] =
  useState<ScalevPaymentMethod | null>(initialPaymentMethod);
const [paymentError, setPaymentError] = useState<string | null>(
  initialPaymentMethod ? null : "Metode pembayaran sedang tidak tersedia."
);

const retryPaymentOptions = async () => {
  setPaymentError(null);
  try {
    const response = await fetch("/api/scalev/payment-options", {
      cache: "no-store",
    });
    const result = (await response.json()) as {
      success: boolean;
      config?: ScalevCheckoutConfig;
    };
    if (!response.ok || !result.success || !result.config) {
      throw new Error("Gagal memuat metode pembayaran.");
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
      setPaymentError("Metode pembayaran sedang tidak tersedia.");
    }
  } catch (error) {
    console.error("Failed to load Scalev payment options:", error);
    setPaymentConfig(null);
    setPaymentMethod(null);
    setSubPaymentMethod("");
    setPaymentError("Gagal memuat metode pembayaran. Coba muat ulang.");
  }
};

<Button type="button" onClick={() => void retryPaymentOptions()}>
  Coba Muat Ulang
</Button>
```

Remove `paymentConfigReloadKey` and both mount effects. Keep `/api/scalev/payment-options` as the explicit retry endpoint, implemented through `getScalevCheckoutConfig()`. Keep `app/api/scalev/create-payment/route.ts:266-282` behavior unchanged.

## Repo conventions to follow

- Keep provider access server-only and use absolute `@/` imports.
- Imitate submit-time validation at `app/api/scalev/create-payment/route.ts:266-282`.
- Preserve existing Indonesian loading, empty, and retry messages.
- Keep `ScalevCheckoutConfig` as the serialized Server Component prop.

## Steps

1. Add `lib/scalev/checkout-config.ts` with the target loader.
2. Refactor the payment-options GET route to call it.
3. Preload concurrently with service data in `[id]/page.tsx`; preload in async `cart/page.tsx`.
4. Add `initialPaymentConfig` to both client prop interfaces and initialize config/method/error from it.
5. Remove reload-key state and mount fetch effects. Wire the retained fetch logic directly to “Coba Muat Ulang”.
6. Preserve and test fresh provider validation in `create-payment`, including rejection when preloaded availability has become stale.
7. Re-read the diff and remove unrelated churn.

## Boundaries

- Do NOT cache payment availability across requests or trust preload at submission.
- Do NOT remove or weaken `create-payment` provider validation.
- Do NOT change payment identifiers, fallback configuration, payloads, discounts, pricing, or redirects.
- Do NOT automatically refetch after hydration.
- Do NOT add dependencies or modify environment/config files.
- STOP if code differs from commit `b94c4ae`; report drift instead of improvising.

## Verification

- **Mechanical**:
  - Run `bunx tsc --noEmit`, `bun run lint`, and focused checkout/payment tests.
  - Run `npx react-doctor@latest --scope changed`; score must not regress, then run an unfiltered affected-scope scan.
  - In Network, verify first navigation to each checkout sends no post-hydration `GET /api/scalev/payment-options`.
- **Behavior check**:
  - Confirm both checkout routes contain selectable options in the initial response and remain stable through hydration.
  - Force fallback/empty states and confirm explicit retry sends exactly one request and recovers.
  - Change provider availability after render and confirm stale selection is rejected as `PAYMENT_METHOD_UNAVAILABLE`.
  - Record before/after in React DevTools Profiler; confirm the payment loading-to-options hydration commit disappears. Use “Highlight updates” to ensure the payment section no longer flashes after hydration.
- **Done when**: initial options are server-preloaded, retry stays explicit, payment creation validates fresh provider state, checks pass, and the extra commit is gone.
