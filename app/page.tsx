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
        <div className="absolute inset-0 bg-sage-900">
          <Image
            src="https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1920&q=80"
            alt="Spa Background"
            fill
            sizes="100vw"
            priority
            className="object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-sage-900/80 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <span className="text-sand-300 tracking-[0.2em] text-sm md:text-base uppercase mb-4 block animate-fade-in">
            Welcome to Kalanara
          </span>
          <h1 className="font-serif text-5xl md:text-7xl text-sand-50 mb-6 leading-tight">
            Rejuvenate Your <br />
            <span className="italic text-sand-400">Body & Soul</span>
          </h1>
          <p className="text-sand-100/90 text-lg md:text-xl mb-10 max-w-2xl mx-auto font-light">
            Experience the ancient healing traditions of Java in a modern
            sanctuary. Book your escape today.
          </p>
          <a
            href="#services"
            className="inline-flex items-center gap-2 bg-sand-500 text-sage-900 px-8 py-4 rounded-full text-lg font-medium hover:bg-sand-400 transition-all transform hover:scale-105 shadow-lg shadow-sage-900/20"
          >
            Explore Treatments
          </a>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 px-4 sm:px-6 lg:px-8 bg-sand-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl text-sage-900 mb-4">
              Curated Packages
            </h2>
            <div className="h-1 w-20 bg-sand-500 mx-auto rounded-full"></div>
            <p className="mt-4 text-sage-600 max-w-2xl mx-auto">
              Select a voucher package below to gift yourself or a loved one.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.length > 0 ? (
              services.map((service) => (
                <div
                  key={service.id}
                  className="group bg-white rounded-2xl overflow-hidden shadow-spa hover:shadow-spa-lg transition-all duration-300 border border-sage-100"
                >
                  <div className="relative h-64 overflow-hidden">
                    <Image
                      src={service.image || "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80"}
                      alt={service.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur text-sage-900 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 shadow-sm">
                      <Clock size={14} />
                      {service.duration} mins
                    </div>
                  </div>

                  <div className="p-6">
                    <h3 className="font-serif text-2xl text-sage-900 mb-2 group-hover:text-sage-700 transition-colors">
                      {service.name}
                    </h3>
                    <p className="text-sage-600 text-sm mb-6 line-clamp-2">
                      {service.description}
                    </p>

                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-sage-100">
                      <span className="text-lg font-semibold text-sage-800">
                        {formatCurrency(service.price)}
                      </span>
                      <Link
                        href={`/voucher/${service.id}`}
                        className="text-sand-600 font-medium hover:text-sand-800 flex items-center gap-1 text-sm uppercase tracking-wide"
                      >
                        Details <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-12 text-sage-500">
                No services available at the moment.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      {displayedReviews.length > 0 && (
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="font-serif text-4xl text-sage-900 mb-4">
                Guest Experiences
              </h2>
              <div className="h-1 w-20 bg-sand-500 mx-auto rounded-full"></div>
              <p className="mt-4 text-sage-600 max-w-2xl mx-auto">
                Read what our guests have to say about their journey with us.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {displayedReviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-sand-50 p-8 rounded-2xl border border-sage-100 relative"
                >
                  <Quote
                    className="absolute top-6 right-6 text-sand-200"
                    size={40}
                  />
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={16}
                        className={`${
                          i < review.rating
                            ? "text-sand-500 fill-sand-500"
                            : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-sage-700 italic mb-6 min-h-[80px]">
                    &quot;{review.comment}&quot;
                  </p>
                  <div className="border-t border-sage-200 pt-4">
                    <p className="font-bold text-sage-900">
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
      <section className="py-20 bg-sage-800 text-sand-100">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <div>
            <div className="w-16 h-16 mx-auto bg-sage-700 rounded-full flex items-center justify-center mb-4 text-sand-400">
              <Clock size={32} />
            </div>
            <h3 className="font-serif text-xl mb-2">Instant Delivery</h3>
            <p className="text-sage-300 text-sm">
              Vouchers are sent automatically via WhatsApp & Email immediately
              after purchase.
            </p>
          </div>
          <div>
            <div className="w-16 h-16 mx-auto bg-sage-700 rounded-full flex items-center justify-center mb-4 text-sand-400">
              <Star size={32} />
            </div>
            <h3 className="font-serif text-xl mb-2">Valid for 12 Months</h3>
            <p className="text-sage-300 text-sm">
              Flexible redemption period to suit your schedule.
            </p>
          </div>
          <div>
            <div className="w-16 h-16 mx-auto bg-sage-700 rounded-full flex items-center justify-center mb-4 text-sand-400">
              <Quote size={32} />
            </div>
            <h3 className="font-serif text-xl mb-2">Secure Payment</h3>
            <p className="text-sage-300 text-sm">
              Trusted payments via QRIS, Bank Transfer, and Credit Cards.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-sage-900 text-sand-200 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="font-serif text-2xl text-sand-100 mb-2">KALANARA</h2>
          <p className="text-sage-400 text-sm mb-6">Harmony in Every Touch</p>
          <p className="text-sage-500 text-xs">
            © {new Date().getFullYear()} Kalanara Spa. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
