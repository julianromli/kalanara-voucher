import { notFound } from "next/navigation";
import { CheckoutPageClient } from "@/app/checkout/[id]/checkout-page-client";
import { getServiceById } from "@/lib/actions/services";
import { ServiceCategory, type Service } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

function toServiceModel(service: Awaited<ReturnType<typeof getServiceById>>): Service | null {
  if (!service || !service.is_active) {
    return null;
  }

  return {
    id: service.id,
    name: service.name,
    description: service.description ?? "",
    duration: service.duration,
    price: service.price,
    category: service.category as ServiceCategory,
    image: service.image_url ?? "/images/services/placeholder.jpg",
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
