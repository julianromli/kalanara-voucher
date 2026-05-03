"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock, ArrowRight } from "lucide-react";
import { useInView } from "@/hooks/useInView";
import { SiteContainer } from "@/components/site-container";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { formatCurrency } from "@/lib/constants";
import type { Service } from "@/lib/types";
import { resolveServiceImageUrl } from "@/lib/utils/serviceImages";

interface ServicesSectionProps {
  services: Service[];
}

export function ServicesSection({ services }: ServicesSectionProps) {
  const [servicesRef, servicesInView] = useInView<HTMLElement>({ threshold: 0.1 });

  return (
    <section
      ref={servicesRef}
      id="services"
      className="relative overflow-hidden bg-background py-24"
    >
      {/* Gradient Mesh Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sage-100/30 dark:bg-sage-900/20 rounded-full blur-3xl opacity-50" />
      </div>

      <SiteContainer className="relative z-10">
        <div className={`text-center mb-16 ${servicesInView ? "animate-fade-slide-up" : "opacity-0"}`}>
          <h2 className="font-sans font-semibold text-4xl text-foreground mb-4">
            Pilihan Paket Voucher
          </h2>
          <div className="h-1 w-20 bg-accent mx-auto rounded-full"></div>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Pilih voucher spa untuk diri sendiri atau hadiah spesial untuk orang tersayang.
          </p>
        </div>

        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
          {services.length > 0 ? (
            services.map((service, index) => (
              <div
                key={service.id}
                className={`group bg-card rounded-2xl overflow-hidden shadow-spa hover:shadow-spa-lg border border-border card-hover-lift ${
                  servicesInView ? "animate-fade-slide-up" : "opacity-0"
                }`}
                style={{ animationDelay: servicesInView ? `${(index + 1) * 100}ms` : "0ms" }}
              >
                <div className="relative h-48 overflow-hidden img-hover-zoom md:h-64">
                  <Image
                    src={resolveServiceImageUrl(service.image)}
                    alt={service.name}
                    fill
                    sizes="(max-width: 379px) 100vw, (max-width: 768px) 50vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover"
                  />
                  {service.category?.name && (
                    <div className="absolute left-2 top-2 rounded-full bg-primary px-2 py-1 text-xs font-medium text-primary-foreground shadow-sm md:left-4 md:top-4 md:px-3 md:text-sm">
                      {service.category.name}
                    </div>
                  )}
                  <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-card/90 px-2 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur md:right-4 md:top-4 md:px-3 md:text-sm">
                    <Clock size={14} />
                    {service.duration} menit
                  </div>
                </div>

                <div className="flex h-[calc(100%-12rem)] flex-col p-4 md:h-[calc(100%-16rem)] md:p-6">
                  <h3 className="mb-2 font-sans text-lg font-semibold text-foreground transition-colors group-hover:text-muted-foreground md:text-2xl">
                    {service.name}
                  </h3>
                  <p className="mb-4 line-clamp-2 text-xs text-muted-foreground md:mb-6 md:text-sm">
                    {service.description}
                  </p>

                  <div className="mt-auto space-y-3 border-t border-border pt-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
                      <span className="text-base font-semibold text-foreground md:text-lg">
                        {formatCurrency(service.price)}
                      </span>
                      <Link
                        href={`/voucher/${service.id}`}
                        className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground md:text-sm"
                      >
                        Detail <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                      </Link>
                    </div>
                    <AddToCartButton
                      service={service}
                      size="sm"
                      className="w-full gap-2 bg-primary px-2 text-xs text-primary-foreground hover:bg-primary/90 md:px-3 md:text-sm"
                    />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-1 py-12 text-center text-muted-foreground min-[380px]:col-span-2 lg:col-span-3">
              Belum ada paket tersedia saat ini.
            </div>
          )}
        </div>
      </SiteContainer>
    </section>
  );
}
