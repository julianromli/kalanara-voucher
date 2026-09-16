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
      className="relative overflow-hidden bg-background py-24 scroll-mt-36"
    >
      {/* Gradient Mesh Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sage-100/30 dark:bg-sage-900/20 rounded-full blur-3xl opacity-50" />
      </div>

      <SiteContainer className="relative z-10">
        <div className={`text-center mb-16 ${servicesInView ? "animate-fade-slide-up" : "opacity-0"}`}>
          <h2 className="font-sans font-semibold text-3xl sm:text-4xl text-foreground mb-4 sm:mb-6 leading-tight text-balance">
            Pilihan Paket Voucher
          </h2>
          <div className="h-1 w-20 bg-accent mx-auto rounded-full"></div>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-pretty">
            Pilih voucher spa untuk diri sendiri atau hadiah spesial untuk orang tersayang.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-6 md:gap-8 lg:grid-cols-3">
          {services.length > 0 ? (
            services.map((service, index) => {
              const categoryName = service.category?.name || "Lantai 2 - Kalanara Outlet";

              return (
                <div
                  key={service.id}
                  className={`group flex flex-col bg-card rounded-2xl overflow-hidden border border-border shadow-sm transition-[box-shadow,transform] duration-300 hover:shadow-md hover:-translate-y-1 ${
                    servicesInView ? "animate-fade-slide-up" : "opacity-0"
                  }`}
                  style={{ animationDelay: servicesInView ? `${(index + 1) * 100}ms` : "0ms" }}
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden">
                    <Image
                      src={resolveServiceImageUrl(service.image)}
                      alt={service.name}
                      fill
                      sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent opacity-60 pointer-events-none"></div>

                    <div className="absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2 md:inset-x-4 md:top-4">
                      <div
                        title={categoryName}
                        className="min-w-0 max-w-[calc(100%-7.5rem)] truncate rounded-full bg-primary/90 px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm backdrop-blur-sm md:px-4 md:text-sm"
                      >
                        {categoryName}
                      </div>
                      <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm md:px-4 md:text-sm">
                        <Clock size={14} className="shrink-0 text-foreground" aria-hidden="true" />
                        <span className="whitespace-nowrap tabular-nums">
                          {service.duration} menit
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-5 md:p-6">
                    <h3 className="mb-2 font-sans text-xl font-semibold text-foreground text-balance break-words md:text-2xl">
                      {service.name}
                    </h3>
                    <p className="mb-6 line-clamp-2 text-sm text-muted-foreground leading-relaxed text-pretty">
                      {service.description || "Kembalikan vitalitas dan kesegaran tubuh serta pikiran Anda dengan layanan ini."}
                    </p>

                    <div className="mt-auto">
                      <div className="mb-5 h-px w-full bg-border/60"></div>
                      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <span className="min-w-0 text-lg font-semibold tabular-nums text-foreground md:text-xl">
                          {formatCurrency(service.price)}
                        </span>
                        <Link
                          href={`/voucher/${service.id}`}
                          className="inline-flex shrink-0 items-center gap-1 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                        >
                          Detail <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
                        </Link>
                      </div>
                      <AddToCartButton
                        service={service}
                        layout="card"
                        className="rounded-xl shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-1 py-12 text-center text-muted-foreground sm:col-span-2 lg:col-span-3">
              Belum ada paket tersedia saat ini.
            </div>
          )}
        </div>
      </SiteContainer>
    </section>
  );
}
