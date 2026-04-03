import { notFound } from "next/navigation";
import { CheckoutPageClient } from "@/app/checkout/[id]/checkout-page-client";
import { getServiceById } from "@/lib/actions/services";
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

export default async function CheckoutPage({ params }: PageProps) {
  const { id } = await params;
  const service = toServiceModel(await getServiceById(id));

  if (!service || !service.id) {
    notFound();
  }

  return <CheckoutPageClient service={service} />;
}
