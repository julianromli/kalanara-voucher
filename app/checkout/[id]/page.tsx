import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CheckoutPageClient } from "@/app/checkout/[id]/checkout-page-client";
import { CheckoutLoadingSkeleton } from "@/app/checkout/[id]/loading";
import { getServiceById } from "@/lib/actions/services";
import {
  getScalevCheckoutConfig,
  getUnavailableScalevCheckoutConfig,
} from "@/lib/scalev/checkout-config";
import type { Service } from "@/lib/types";
import type { ServiceWithCategory } from "@/lib/actions/services";
import { resolveServiceImageUrl } from "@/lib/utils/serviceImages";

interface PageProps {
  params: Promise<{ id: string }>;
}

function toServiceModel(service: ServiceWithCategory | null): Service | null {
  if (!service || !service.is_active) {
    return null;
  }

  return {
    id: service.id,
    name: service.name,
    description: service.description ?? "",
    duration: service.duration,
    price: service.price,
    category: service.category_relation
      ? {
          id: service.category_relation.id,
          slug: service.category_relation.slug,
          name: service.category_relation.name,
          isActive: service.category_relation.is_active,
        }
      : {
          id: service.category_id ?? "",
          slug: "",
          name: "Layanan",
          isActive: true,
        },
    image: resolveServiceImageUrl(service.image_url),
  };
}

export default function CheckoutPage({ params }: PageProps) {
  return (
    <Suspense fallback={<CheckoutLoadingSkeleton />}>
      <ProviderCheckout params={params} />
    </Suspense>
  );
}

async function ProviderCheckout({ params }: PageProps) {
  const { id } = await params;
  const serviceResult = await getServiceById(id);
  const service = toServiceModel(serviceResult);

  if (!service || !service.id) {
    notFound();
  }

  const initialPaymentConfig = await getScalevCheckoutConfig().catch((error) => {
    console.error("[Scalev] Failed to preload single checkout config:", error);
    return getUnavailableScalevCheckoutConfig();
  });

  return (
    <CheckoutPageClient
      service={service}
      initialPaymentConfig={initialPaymentConfig}
    />
  );
}
