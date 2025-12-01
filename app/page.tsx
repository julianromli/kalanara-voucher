import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Footer13 } from "@/components/footer13";
import { TrustFeatures } from "@/components/trust-features";
import { ServicesSection } from "@/components/services-section";
import { TestimonialsSection } from "@/components/testimonials-section";
import { getServices } from "@/lib/actions/services";
import { getReviews } from "@/lib/actions/reviews";
import { ServiceCategory } from "@/lib/types";
import type { Service, Review } from "@/lib/types";
import type { Service as DBService, Review as DBReview } from "@/lib/database.types";

function adaptDBServiceToFrontend(dbService: DBService): Service {
  return {
    id: dbService.id,
    name: dbService.name,
    description: dbService.description ?? "",
    duration: dbService.duration,
    price: dbService.price,
    category: dbService.category as ServiceCategory,
    image: dbService.image_url ?? "/images/services/placeholder.jpg",
  };
}

function adaptDBReviewToFrontend(dbReview: DBReview): Review {
  return {
    id: dbReview.id,
    voucherId: dbReview.voucher_id,
    rating: dbReview.rating,
    comment: dbReview.comment ?? "",
    customerName: dbReview.customer_name,
    createdAt: new Date(dbReview.created_at),
  };
}

export default async function LandingPage() {
  const [dbServices, dbReviews] = await Promise.all([
    getServices(),
    getReviews(),
  ]);

  const services = dbServices.map(adaptDBServiceToFrontend);
  const reviews = dbReviews.map(adaptDBReviewToFrontend);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section - Full Width Desktop */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-primary">
          <Image
            src="https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1920&q=80"
            alt="Spa Background"
            fill
            sizes="100vw"
            priority
            className="object-cover opacity-50"
          />
          {/* Gradient overlays for depth */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-transparent to-primary/30" />
        </div>

        {/* Content - Full width on desktop */}
        <div className="relative z-10 w-full px-6 sm:px-8 lg:px-16 xl:px-24 pt-20">
          <div className="max-w-none lg:max-w-[50%]">
            <span className="animate-fade-slide-up text-primary-foreground/60 tracking-[0.3em] text-xs md:text-sm uppercase mb-6 block">
              Welcome to Kalanara
            </span>
            <h1 className="animate-fade-slide-up animate-stagger-1 font-sans font-semibold text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl text-primary-foreground mb-8 leading-[1.1]">
              Rejuvenate <br className="hidden sm:block" />
              Your{" "}
              <span className="italic font-normal text-primary-foreground/70">
                Body & Soul
              </span>
            </h1>
            <p className="animate-fade-slide-up animate-stagger-2 text-primary-foreground/80 text-base sm:text-lg md:text-xl mb-10 max-w-xl font-light leading-relaxed">
              Experience the ancient healing traditions of Java in a modern
              sanctuary. Book your escape today.
            </p>
            <div className="animate-fade-slide-up animate-stagger-3 flex flex-col sm:flex-row items-start gap-4">
              <a
                href="#services"
                className="btn-hover-lift inline-flex items-center gap-3 bg-accent text-accent-foreground px-8 py-4 rounded-lg text-base sm:text-lg font-medium hover:bg-accent/90 transition-all shadow-xl"
              >
                Explore Treatments
                <ArrowRight size={20} />
              </a>
              <Link
                href="/verify"
                className="inline-flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground px-4 py-4 text-base font-medium transition-colors"
              >
                Verify Your Voucher
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <ServicesSection services={services} />

      {/* Testimonials Section */}
      <TestimonialsSection reviews={reviews} />

      {/* Trust/Features */}
      <TrustFeatures />

      {/* Footer */}
      <Footer13 />
    </div>
  );
}
