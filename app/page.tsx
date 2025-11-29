"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock, ArrowRight, Star, Quote } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { formatCurrency } from "@/lib/constants";

export default function LandingPage() {
  const { services, reviews } = useStore();

  const displayedReviews = reviews
    .filter((r) => r.rating >= 4)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="relative h-[85vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-primary">
          <Image
            src="https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1920&q=80"
            alt="Spa Background"
            fill
            sizes="100vw"
            priority
            className="object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <span className="text-muted-foreground tracking-[0.2em] text-sm md:text-base uppercase mb-4 block animate-fade-in">
            Welcome to Kalanara
          </span>
          <h1 className="font-sans font-semibold text-5xl md:text-7xl text-primary-foreground mb-6 leading-tight">
            Rejuvenate Your <br />
            <span className="italic text-primary-foreground/70">Body & Soul</span>
          </h1>
          <p className="text-primary-foreground/90 text-lg md:text-xl mb-10 max-w-2xl mx-auto font-light">
            Experience the ancient healing traditions of Java in a modern
            sanctuary. Book your escape today.
          </p>
          <a
            href="#services"
            className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-8 py-4 rounded-full text-lg font-medium hover:bg-accent/90 transition-all transform hover:scale-105 shadow-lg shadow-primary/20"
          >
            Explore Treatments
          </a>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
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
              services.map((service) => (
                <div
                  key={service.id}
                  className="group bg-card rounded-2xl overflow-hidden shadow-spa hover:shadow-spa-lg transition-all duration-300 border border-border"
                >
                  <div className="relative h-64 overflow-hidden">
                    <Image
                      src={service.image || "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80"}
                      alt={service.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover group-hover:scale-110 transition-transform duration-700"
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
                        className="text-muted-foreground font-medium hover:text-foreground flex items-center gap-1 text-sm uppercase tracking-wide"
                      >
                        Details <ArrowRight size={16} />
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

      {/* Testimonials Section */}
      {displayedReviews.length > 0 && (
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-card">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="font-sans font-semibold text-4xl text-foreground mb-4">
                Guest Experiences
              </h2>
              <div className="h-1 w-20 bg-accent mx-auto rounded-full"></div>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                Read what our guests have to say about their journey with us.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {displayedReviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-background p-8 rounded-2xl border border-border relative"
                >
                  <Quote
                    className="absolute top-6 right-6 text-muted-foreground/30"
                    size={40}
                  />
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={16}
                        className={`${
                          i < review.rating
                            ? "text-accent fill-accent"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-muted-foreground italic mb-6 min-h-[80px]">
                    &quot;{review.comment}&quot;
                  </p>
                  <div className="border-t border-border pt-4">
                    <p className="font-bold text-foreground">
                      {review.customerName}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Trust/Features */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <div>
            <div className="w-16 h-16 mx-auto bg-primary-foreground/10 rounded-full flex items-center justify-center mb-4 text-primary-foreground/70">
              <Clock size={32} />
            </div>
            <h3 className="font-sans font-semibold text-xl mb-2">Instant Delivery</h3>
            <p className="text-primary-foreground/70 text-sm">
              Vouchers are sent automatically via WhatsApp & Email immediately
              after purchase.
            </p>
          </div>
          <div>
            <div className="w-16 h-16 mx-auto bg-primary-foreground/10 rounded-full flex items-center justify-center mb-4 text-primary-foreground/70">
              <Star size={32} />
            </div>
            <h3 className="font-sans font-semibold text-xl mb-2">Valid for 12 Months</h3>
            <p className="text-primary-foreground/70 text-sm">
              Flexible redemption period to suit your schedule.
            </p>
          </div>
          <div>
            <div className="w-16 h-16 mx-auto bg-primary-foreground/10 rounded-full flex items-center justify-center mb-4 text-primary-foreground/70">
              <Quote size={32} />
            </div>
            <h3 className="font-sans font-semibold text-xl mb-2">Secure Payment</h3>
            <p className="text-primary-foreground/70 text-sm">
              Trusted payments via QRIS, Bank Transfer, and Credit Cards.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground/80 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="font-sans font-semibold text-2xl text-primary-foreground mb-2">KALANARA</h2>
          <p className="text-primary-foreground/60 text-sm mb-6">Harmony in Every Touch</p>
          <p className="text-primary-foreground/50 text-xs">
            © {new Date().getFullYear()} Kalanara Spa. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
