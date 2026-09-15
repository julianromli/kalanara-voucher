import "server-only";

import { cache } from "react";
import { getScalevConfig } from "@/lib/scalev/config";
import { ensureScalevIpv4First } from "@/lib/scalev/network";
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
  ScalevPaymentMethod,
  ScalevVABankCode,
} from "@/lib/scalev/types";
import {
  isScalevPaymentMethod,
  isScalevVABankCode,
} from "@/lib/scalev/types";

class ScalevApiError extends Error {
  status: number;
  path: string;
  responseBody: unknown;

  constructor(path: string, status: number, responseBody: unknown) {
    super(
      `Scalev request failed: ${status} ${path}${
        responseBody ? ` | ${formatScalevErrorBody(responseBody)}` : ""
      }`
    );
    this.name = "ScalevApiError";
    this.status = status;
    this.path = path;
    this.responseBody = responseBody;
  }
}

function formatScalevErrorBody(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeScalevMetaThumbnail(metaThumbnail?: string) {
  if (!metaThumbnail) {
    return undefined;
  }

  try {
    const url = new URL(metaThumbnail);
    const isSignedSupabaseObject =
      url.pathname.includes("/storage/v1/object/sign/") &&
      url.searchParams.has("token");

    if (isSignedSupabaseObject) {
      console.warn(
        "[Scalev] Skipping signed Supabase meta_thumbnail because Scalev /products returns 500 for this URL shape."
      );
      return undefined;
    }
  } catch {
    return metaThumbnail;
  }

  return metaThumbnail;
}

async function scalevRequest<T>(
  path: string,
  init?: RequestInit,
  options: {
    baseUrl?: string;
    allowEmptyResponse?: boolean;
  } = {}
): Promise<T> {
  ensureScalevIpv4First();
  const config = getScalevConfig();
  const response = await fetch(`${options.baseUrl || config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const rawText = await response.text().catch(() => "");
  const parsedJson = rawText
    ? (() => {
        try {
          return JSON.parse(rawText);
        } catch {
          return null;
        }
      })()
    : null;
  const json = parsedJson as
    | ScalevApiEnvelope<T>
    | T
    | null;

  if (!response.ok || (!json && !options.allowEmptyResponse)) {
    throw new ScalevApiError(
      path,
      response.status,
      json || rawText || null
    );
  }

  if (!json) {
    return undefined as T;
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

async function fetchScalevStore(
  signal?: AbortSignal
): Promise<ScalevStoreRecord> {
  const config = getScalevConfig();
  const result = await scalevRequest<{
    results: ScalevStoreRecord[];
  }>(
    `/stores?search=${encodeURIComponent(config.storeNameSearch)}&page_size=25`,
    { signal }
  );

  const store =
    result.results.find((item) => item.unique_id === config.storeUniqueId) || null;

  if (!store) {
    throw new Error(`Scalev store not found for ${config.storeUniqueId}`);
  }

  return store;
}

export const resolveScalevStore = cache(
  async (): Promise<ScalevStoreRecord> => fetchScalevStore()
);

export interface ScalevCheckoutAvailability {
  source: "provider" | "fallback";
  store: ScalevStoreRecord;
  paymentMethods: ScalevPaymentMethod[];
  subPaymentMethods: ScalevVABankCode[];
}

function uniqueKnownPaymentMethods(methods: string[]) {
  return [...new Set(methods.filter(isScalevPaymentMethod))];
}

function uniqueKnownVABanks(bankCodes: string[]) {
  return [...new Set(bankCodes.filter(isScalevVABankCode))];
}

export async function getScalevCheckoutAvailability(
  signal?: AbortSignal
): Promise<ScalevCheckoutAvailability> {
  const config = getScalevConfig();
  const filterDisabledMethods = (methods: ScalevPaymentMethod[]) =>
    methods.filter((method) => !config.disabledPaymentMethods.includes(method));

  try {
    const store = signal
      ? await fetchScalevStore(signal)
      : await resolveScalevStore();
    const paymentMethods = await scalevRequest<string[]>(
      `/stores/${store.id}/payment-methods`,
      { signal }
    );
    const allowedRuntimeMethods = filterDisabledMethods(uniqueKnownPaymentMethods(
      Array.isArray(paymentMethods) ? paymentMethods : []
    ));
    const fallbackEnabledMethods = config.fallbackPaymentMethods.filter(
      (method) => !config.disabledPaymentMethods.includes(method)
    );
    const effectivePaymentMethods =
      allowedRuntimeMethods.length > 0
        ? allowedRuntimeMethods
        : fallbackEnabledMethods;
    const runtimeVABanks = uniqueKnownVABanks(
      Array.isArray(store.sub_payment_methods) ? store.sub_payment_methods : []
    );
    const requiresVABankFallback =
      effectivePaymentMethods.includes("va") && runtimeVABanks.length === 0;
    const usedFallback =
      allowedRuntimeMethods.length === 0 || requiresVABankFallback;

    return {
      source: usedFallback ? "fallback" : "provider",
      store,
      paymentMethods: effectivePaymentMethods,
      subPaymentMethods: requiresVABankFallback
        ? config.fallbackVABanks
        : runtimeVABanks,
    };
  } catch (error) {
    console.warn("[Scalev] Falling back to configured payment methods:", error);

    return {
      source: "fallback",
      store: {
        id: 0,
        name: config.storeNameSearch,
        unique_id: config.storeUniqueId,
      },
      paymentMethods: config.fallbackPaymentMethods.filter(
        (method) => !config.disabledPaymentMethods.includes(method)
      ),
      subPaymentMethods: config.fallbackVABanks,
    };
  }
}

export async function listScalevProducts(search?: string) {
  const config = getScalevConfig();
  const suffix = search ? `?search=${encodeURIComponent(search)}&page_size=25` : "?page_size=25";
  return scalevRequest<ScalevProductRecord[]>(
    `/products${suffix}`,
    undefined,
    { baseUrl: config.catalogApiBaseUrl }
  );
}

export async function getScalevProduct(id: number) {
  const config = getScalevConfig();
  return scalevRequest<ScalevProductRecord>(
    `/products/${id}`,
    undefined,
    { baseUrl: config.catalogApiBaseUrl }
  );
}

export async function createScalevProduct(input: ScalevCatalogProductInput) {
  const config = getScalevConfig();
  const metaThumbnail = normalizeScalevMetaThumbnail(input.metaThumbnail);
  const normalizedInput = { ...input, metaThumbnail };

  const product = await scalevRequest<ScalevProductRecord>("/products", {
    method: "POST",
    body: JSON.stringify({
      name: normalizedInput.name,
      description: normalizedInput.description,
      public_name: normalizedInput.publicName,
      rich_description: normalizedInput.richDescription,
      item_type: normalizedInput.itemType,
      meta_thumbnail: normalizedInput.metaThumbnail,
      variants: normalizedInput.variants.map((variant) => ({
        price: variant.price,
        weight: variant.weight,
        metadata: variant.metadata,
        is_checked: true,
      })),
    }),
  }, { baseUrl: config.catalogApiBaseUrl });

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
  const config = getScalevConfig();
  const metaThumbnail = normalizeScalevMetaThumbnail(input.metaThumbnail);
  const normalizedInput = { ...input, metaThumbnail };

  await scalevRequest<ScalevProductRecord>(`/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: normalizedInput.name,
      description: normalizedInput.description,
      public_name: normalizedInput.publicName,
      rich_description: normalizedInput.richDescription,
      item_type: normalizedInput.itemType,
      meta_thumbnail: normalizedInput.metaThumbnail,
    }),
  }, { baseUrl: config.catalogApiBaseUrl });

  const targetVariant = normalizedInput.variants[0];
  if (!targetVariant) {
    throw new Error("Scalev product update requires a primary variant");
  }

  await scalevRequest<void>(
    `/products/${id}/variants/bulk`,
    {
      method: "PATCH",
      body: JSON.stringify({
        field: "price",
        value: targetVariant.price,
      }),
    },
    {
      baseUrl: config.catalogApiBaseUrl,
      allowEmptyResponse: true,
    }
  );

  const product = await getScalevProduct(id);

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
      product_discount: input.productDiscount,
      payment_method: input.paymentMethod,
      sub_payment_method: input.subPaymentMethod,
      metadata: input.metadata,
      notes: input.notes,
    }),
  });
}

export async function createScalevPaymentIntent(orderPk: string) {
  return scalevRequest<ScalevPaymentIntentResponse>(`/order/${orderPk}/payment`, {
    method: "POST",
  });
}

export async function retrieveScalevOrder(orderPk: string) {
  return scalevRequest<ScalevOrderRecord>(`/order/${orderPk}`);
}

export async function getScalevOrderByPgReference(pgReferenceId: string) {
  const data = await scalevRequest<{ id: string }>(
    `/order/retrieve-by-pg-reference-id?pg_reference_id=${encodeURIComponent(pgReferenceId)}`
  );

  if (!data.id) {
    return null;
  }

  return retrieveScalevOrder(data.id);
}

export async function checkScalevPaymentStatus(orderPk: string) {
  return scalevRequest<ScalevPaymentStatusResponse>(`/order/${orderPk}/check-payment`);
}

export async function checkScalevSettlementStatus(orderPk: string) {
  return scalevRequest<ScalevSettlementStatusResponse>(
    `/order/${orderPk}/check-settlement`
  );
}
