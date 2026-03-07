import "server-only";

import { cache } from "react";
import { getScalevConfig } from "@/lib/scalev/config";
import type {
  ScalevApiEnvelope,
  ScalevCatalogProductInput,
  ScalevOrderCreateInput,
  ScalevOrderRecord,
  ScalevPaymentIntentResponse,
  ScalevPaymentStatusResponse,
  ScalevProductRecord,
  ScalevSettlementStatusResponse,
  ScalevStoreRecord,
} from "@/lib/scalev/types";

async function scalevRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const config = getScalevConfig();
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as
    | ScalevApiEnvelope<T>
    | T
    | null;

  if (!response.ok || !json) {
    throw new Error(`Scalev request failed: ${response.status} ${path}`);
  }

  if (typeof json === "object" && json !== null && "data" in json) {
    return json.data;
  }

  return json;
}

function getVariantFromProduct(
  product: ScalevProductRecord,
  variantId?: number
) {
  if (variantId) {
    return product.variants.find((item) => item.id === variantId) || null;
  }

  return product.variants[0] || null;
}

export const resolveScalevStore = cache(async (): Promise<ScalevStoreRecord> => {
  const config = getScalevConfig();
  const result = await scalevRequest<{
    results: ScalevStoreRecord[];
  }>(`/stores?search=${encodeURIComponent(config.storeNameSearch)}&page_size=25`);

  const store =
    result.results.find((item) => item.unique_id === config.storeUniqueId) || null;

  if (!store) {
    throw new Error(`Scalev store not found for ${config.storeUniqueId}`);
  }

  return store;
});

export async function getScalevCheckoutAvailability() {
  const config = getScalevConfig();

  try {
    const store = await resolveScalevStore();
    const paymentMethods = await scalevRequest<string[]>(
      `/stores/${store.id}/payment-methods`
    );

    return {
      store,
      paymentMethods: Array.isArray(paymentMethods)
        ? paymentMethods
        : config.fallbackPaymentMethods,
      subPaymentMethods: store.sub_payment_methods || config.fallbackVABanks,
    };
  } catch (error) {
    console.warn("[Scalev] Falling back to configured payment methods:", error);

    return {
      store: {
        id: 0,
        name: config.storeNameSearch,
        unique_id: config.storeUniqueId,
      },
      paymentMethods: config.fallbackPaymentMethods,
      subPaymentMethods: config.fallbackVABanks,
    };
  }
}

export async function listScalevProducts(search?: string) {
  const suffix = search ? `?search=${encodeURIComponent(search)}&page_size=25` : "?page_size=25";
  const data = await scalevRequest<{ results: ScalevProductRecord[] }>(
    `/products${suffix}`
  );

  return data.results;
}

export async function getScalevProduct(id: number) {
  return scalevRequest<ScalevProductRecord>(`/products/${id}`);
}

export async function createScalevProduct(input: ScalevCatalogProductInput) {
  const product = await scalevRequest<ScalevProductRecord>("/products", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      public_name: input.publicName,
      rich_description: input.richDescription,
      item_type: input.itemType,
      meta_thumbnail: input.metaThumbnail,
      variants: input.variants.map((variant) => ({
        name: variant.name,
        price: variant.price,
        weight: variant.weight,
        metadata: variant.metadata,
        is_checked: true,
      })),
    }),
  });

  const primaryVariant = getVariantFromProduct(product);
  if (!primaryVariant) {
    throw new Error("Scalev product created without a primary variant");
  }

  return { product, primaryVariant };
}

export async function updateScalevProduct(
  id: number,
  input: ScalevCatalogProductInput
) {
  const product = await scalevRequest<ScalevProductRecord>(`/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      public_name: input.publicName,
      rich_description: input.richDescription,
      item_type: input.itemType,
      meta_thumbnail: input.metaThumbnail,
      variants: input.variants.map((variant) => ({
        variant_id: variant.variantId,
        price: variant.price,
        weight: variant.weight,
        metadata: variant.metadata,
        name: variant.name,
        is_checked: true,
      })),
    }),
  });

  const primaryVariant = getVariantFromProduct(product, input.variants[0]?.variantId);
  if (!primaryVariant) {
    throw new Error("Scalev product update did not return the target variant");
  }

  return { product, primaryVariant };
}

export async function attachProductToScalevStore(productId: number) {
  const store = await resolveScalevStore();

  await scalevRequest<unknown>(`/stores/${store.id}/products`, {
    method: "POST",
    body: JSON.stringify({
      product_ids: [productId],
    }),
  });
}

export async function createScalevOrder(input: ScalevOrderCreateInput) {
  return scalevRequest<ScalevOrderRecord>("/order", {
    method: "POST",
    body: JSON.stringify({
      customer_name: input.customer_name,
      customer_email: input.customer_email,
      customer_phone: input.customer_phone,
      store_unique_id: input.store_unique_id,
      ordervariants: input.ordervariants,
      payment_method: input.paymentMethod,
      sub_payment_method: input.subPaymentMethod,
      metadata: input.metadata,
      notes: input.notes,
    }),
  });
}

export async function createScalevPaymentIntent(orderPk: number) {
  return scalevRequest<ScalevPaymentIntentResponse>(`/order/${orderPk}/payment`, {
    method: "POST",
  });
}

export async function retrieveScalevOrder(orderPk: number) {
  return scalevRequest<ScalevOrderRecord>(`/order/${orderPk}`);
}

export async function getScalevOrderByPgReference(pgReferenceId: string) {
  const data = await scalevRequest<{ id: number }>(
    `/order/retrieve-by-pg-reference-id?pg_reference_id=${encodeURIComponent(pgReferenceId)}`
  );

  if (!data.id) {
    return null;
  }

  return retrieveScalevOrder(data.id);
}

export async function checkScalevPaymentStatus(orderPk: number) {
  return scalevRequest<ScalevPaymentStatusResponse>(`/order/${orderPk}/check-payment`);
}

export async function checkScalevSettlementStatus(orderPk: number) {
  return scalevRequest<ScalevSettlementStatusResponse>(
    `/order/${orderPk}/check-settlement`
  );
}
