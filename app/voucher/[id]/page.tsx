"use client";

import { use } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Clock, ChevronLeft, Gift, Star, Calendar } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { formatCurrency, APP_CONFIG } from "@/lib/constants";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function VoucherDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { services } = useStore();

  const service = services.find((s) => s.id === id);

  if (!service) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-sans font-semibold text-3xl text-foreground mb-4">
            Service Not Found
          </h1>
          <p className="text-muted-foreground mb-6">
            The service you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 justify-center"
          >
            <ChevronLeft size={20} /> Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-4 pt-8 animate-slide-in-left">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ChevronLeft
            size={20}
            className="group-hover:-translate-x-1 transition-transform"
          />
          <span>Back</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Image */}
          <div className="animate-scale-in relative rounded-2xl overflow-hidden shadow-spa-lg h-[400px] lg:h-[500px]">
            <Image
              src={
                service.image ||
                "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80"
              }
              alt={service.name}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
              className="object-cover"
            />
            <div className="absolute top-4 right-4 bg-card/90 backdrop-blur px-4 py-2 rounded-full flex items-center gap-2 shadow-sm">
              <Clock size={16} className="text-muted-foreground" />
              <span className="font-medium text-foreground">
                {service.duration} minutes
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col">
            <span className="animate-fade-slide-up text-muted-foreground uppercase tracking-wider text-sm mb-2">
              {service.category.replace("_", " ")}
            </span>
            <h1 className="animate-fade-slide-up animate-stagger-1 font-sans font-semibold text-4xl lg:text-5xl text-foreground mb-6">
              {service.name}
            </h1>
            <p className="animate-fade-slide-up animate-stagger-2 text-muted-foreground text-lg leading-relaxed mb-8">
              {service.description}
            </p>

            {/* Features */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="animate-scale-in animate-stagger-3 bg-card p-4 rounded-xl border border-border card-hover-lift">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                    <Clock size={20} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="font-semibold text-foreground">
                      {service.duration} mins
                    </p>
                  </div>
                </div>
              </div>
              <div className="animate-scale-in animate-stagger-4 bg-card p-4 rounded-xl border border-border card-hover-lift">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                    <Calendar size={20} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valid For</p>
                    <p className="font-semibold text-foreground">
                      {APP_CONFIG.voucherValidity} days
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Price & CTA */}
            <div className="animate-fade-slide-up animate-stagger-5 mt-auto bg-card p-6 rounded-2xl border border-border shadow-spa">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Voucher Price
                  </p>
                  <p className="font-sans font-semibold text-3xl text-foreground">
                    {formatCurrency(service.price)}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-accent">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} className="fill-current" />
                  ))}
                </div>
              </div>

              <Link href={`/checkout/${service.id}`}>
                <Button className="btn-hover-lift w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 text-lg flex items-center justify-center gap-2">
                  <Gift size={20} />
                  Purchase Voucher
                </Button>
              </Link>

              <p className="text-center text-muted-foreground text-sm mt-4">
                Instant delivery via Email & WhatsApp
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
