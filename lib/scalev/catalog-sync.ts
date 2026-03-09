import "server-only";

import {
  attachProductToScalevStore,
  createScalevProduct,
  getScalevProduct,
  listScalevProducts,
  updateScalevProduct,
} from "@/lib/scalev/client";
import { type ScalevCatalogProductInput } from "@/lib/scalev/types";
import type { Service } from "@/lib/database.types";
import {
  getActiveServicesForScalevSync,
  updateServiceScalevMapping,
} from "@/lib/actions/services";

function buildProductPayload(service: Service, variantId?: number): ScalevCatalogProductInput {
  return {
    name: service.name,
    description: service.description || undefined,
    publicName: service.name,
    richDescription: service.description || undefined,
    itemType: "digital",
    metaThumbnail: service.image_url || undefined,
    variants: [
      {
        variantId,
        name: `${service.name} Voucher`,
        price: service.price,
        weight: 1,
        metadata: {
          service_id: service.id,
          service_name: service.name,
          duration: service.duration,
        },
      },
    ],
  };
}

async function findExistingScalevProductForService(service: Service) {
  const products = await listScalevProducts(service.name);

  return (
    products.find((product) =>
      product.variants.some((variant) => {
        const metadata = variant.metadata as
          | { service_id?: string; service_name?: string }
          | undefined;

        return metadata?.service_id === service.id;
      })
    ) ||
    products.find((product) => product.name === service.name) ||
    null
  );
}

export async function ensureScalevServiceMapping(service: Service) {
  if (service.scalev_product_id && service.scalev_variant_id) {
    const product = await getScalevProduct(service.scalev_product_id);
    const variant =
      product.variants.find((item) => item.id === service.scalev_variant_id) ||
      product.variants[0];

    const updated = await updateScalevProduct(
      product.id,
      buildProductPayload(service, variant?.id)
    );

    await updateServiceScalevMapping(service.id, {
      scalev_product_id: updated.product.id,
      scalev_variant_id: updated.primaryVariant.id,
      scalev_variant_unique_id: updated.primaryVariant.unique_id,
      scalev_sync_status: "synced",
      scalev_last_synced_at: new Date().toISOString(),
    });

    return updated;
  }

  const existingProduct = await findExistingScalevProductForService(service);
  if (existingProduct) {
    const existingVariant = existingProduct.variants[0];
    const updated = await updateScalevProduct(
      existingProduct.id,
      buildProductPayload(service, existingVariant?.id)
    );

    await updateServiceScalevMapping(service.id, {
      scalev_product_id: updated.product.id,
      scalev_variant_id: updated.primaryVariant.id,
      scalev_variant_unique_id: updated.primaryVariant.unique_id,
      scalev_sync_status: "synced",
      scalev_last_synced_at: new Date().toISOString(),
    });

    return updated;
  }

  const created = await createScalevProduct(buildProductPayload(service));
  await attachProductToScalevStore(created.product.id);

  await updateServiceScalevMapping(service.id, {
    scalev_product_id: created.product.id,
    scalev_variant_id: created.primaryVariant.id,
    scalev_variant_unique_id: created.primaryVariant.unique_id,
    scalev_sync_status: "synced",
    scalev_last_synced_at: new Date().toISOString(),
  });

  return created;
}

export async function syncActiveServicesToScalev() {
  const services = await getActiveServicesForScalevSync();

  return Promise.all(
    services.map(async (service) => {
      try {
        await ensureScalevServiceMapping(service);
        return { serviceId: service.id, success: true as const };
      } catch (error) {
        await updateServiceScalevMapping(service.id, {
          scalev_sync_status: "failed",
        });

        return {
          serviceId: service.id,
          success: false as const,
          error: error instanceof Error ? error.message : "Unknown Scalev sync error",
        };
      }
    })
  );
}
