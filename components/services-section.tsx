"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock, ArrowRight } from "lucide-react";
import { useInView } from "@/hooks/useInView";
import { formatCurrency } from "@/lib/constants";
import type { Service } from "@/lib/types";

interface ServicesSectionProps {
  services: Service[];
}

export function ServicesSection({ services }: ServicesSectionProps) {
  const [servicesRef, servicesInView] = useInView<HTMLElement>({ threshold: 0.1 });

  return (
    <section
      ref={servicesRef}
      id="services"
      className="py-24 px-4 sm:px-6 lg:px-8 bg-background"
    >
      <div className="max-w-7xl mx-auto">
        <div className={`text-center mb-16 ${servicesInView ? "animate-fade-slide-up" : "opacity-0"}`}>
          <h2 className="font-sans font-semibold text-4xl text-foreground mb-4">
            Curated Packages
          </h2>
          <div className="h-1 w-20 bg-accent mx-auto rounded-full"></div>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Select a voucher package below to gift yourself or a loved one.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.length > 0 ? (
            services.map((service, index) => (
              <div
                key={service.id}
                className={`group bg-card rounded-2xl overflow-hidden shadow-spa hover:shadow-spa-lg border border-border card-hover-lift ${
                  servicesInView ? "animate-fade-slide-up" : "opacity-0"
                }`}
                style={{ animationDelay: servicesInView ? `${(index + 1) * 100}ms` : "0ms" }}
              >
                <div className="relative h-64 overflow-hidden img-hover-zoom">
                  <Image
                    src={
                      service.image ||
                      "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80"
                    }
                    alt={service.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover"
                  />
                  <div className="absolute top-4 right-4 bg-card/90 backdrop-blur text-foreground px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 shadow-sm">
                    <Clock size={14} />
                    {service.duration} mins
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="font-sans font-semibold text-2xl text-foreground mb-2 group-hover:text-muted-foreground transition-colors">
                    {service.name}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6 line-clamp-2">
                    {service.description}
                  </p>

                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
                    <span className="text-lg font-semibold text-foreground">
                      {formatCurrency(service.price)}
                    </span>
                    <Link
                      href={`/voucher/${service.id}`}
                      className="text-muted-foreground font-medium hover:text-foreground flex items-center gap-1 text-sm uppercase tracking-wide transition-colors"
                    >
                      Details <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center py-12 text-muted-foreground">
              No services available at the moment.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
