import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Footer13 } from "@/components/footer13";
import { TrustFeatures } from "@/components/trust-features";
import { ServicesSection } from "@/components/services-section";
import { MeTimeSection } from "@/components/me-time-section";
import { FlashSaleTestimonials } from "@/components/flash-sale-testimonials";
import { SiteContainer } from "@/components/site-container";
import { getServices } from "@/lib/actions/services";
import { getActiveTestimonials, getSiteSetting } from "@/lib/actions/crm";
import type { ServiceWithCategory } from "@/lib/actions/services";
import type { Service } from "@/lib/types";
import { resolveServiceImageUrl } from "@/lib/utils/serviceImages";

function adaptDBServiceToFrontend(dbService: ServiceWithCategory): Service {
  return {
    id: dbService.id,
    name: dbService.name,
    description: dbService.description ?? "",
    duration: dbService.duration,
    price: dbService.price,
    category: dbService.category_relation
      ? {
          id: dbService.category_relation.id,
          slug: dbService.category_relation.slug,
          name: dbService.category_relation.name,
          isActive: dbService.category_relation.is_active,
        }
      : {
          id: dbService.category_id ?? "",
          slug: "",
          name: "Layanan",
          isActive: true,
        },
    image: resolveServiceImageUrl(dbService.image_url),
  };
}

export default async function LandingPage() {
  const [dbServices, heroImageSetting, activeTestimonials] = await Promise.all([
    getServices(),
    getSiteSetting("hero_image_url"),
    getActiveTestimonials(),
  ]);

  const services = dbServices.map(adaptDBServiceToFrontend);
  const heroImageUrl =
    heroImageSetting?.value ||
    "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1920&q=80";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="relative flex min-h-[100dvh] items-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-primary">
          <Image
            src={heroImageUrl}
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

        {/* Content aligned to the same container as the navbar */}
        <div className="relative z-10 w-full pt-20">
          <SiteContainer>
            <div className="max-w-3xl">
              <span className="animate-fade-slide-up text-primary-foreground/60 tracking-[0.3em] text-xs md:text-sm uppercase mb-6 block">
                Selamat Datang di Kalanara
              </span>
              <h1 className="animate-fade-slide-up animate-stagger-1 font-sans font-semibold text-4xl sm:text-5xl md:text-6xl lg:text-6xl xl:text-7xl text-primary-foreground mb-8 leading-[1.2] text-wrap-balance max-w-2xl hero-headline">
                Hadiah Spesial
                <br />
                untuk{" "}
                <span className="italic font-normal text-primary-foreground/70">
                  Me Time
                </span>
              </h1>
              <p className="animate-fade-slide-up animate-stagger-2 text-primary-foreground/80 text-base sm:text-lg md:text-xl mb-10 max-w-xl font-light leading-relaxed">
                Voucher spa premium untuk diri sendiri atau orang tersayang.
                Nikmati perawatan terbaik dari terapis profesional di Kalanara Spa Galaxy, Bekasi.
              </p>
              <div className="animate-fade-slide-up animate-stagger-3 flex flex-col sm:flex-row items-start gap-4">
                <a
                  href="#services"
                  className="btn-hover-lift inline-flex items-center gap-3 bg-accent text-accent-foreground px-8 py-4 rounded-lg text-base sm:text-lg font-medium hover:bg-accent/90 transition-all shadow-xl"
                >
                  Lihat Paket Voucher
                  <ArrowRight size={20} aria-hidden="true" />
                </a>
                <Link
                  href="/verify"
                  className="inline-flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground px-4 py-4 text-base font-medium transition-colors"
                >
                  Cek Voucher Kamu
                </Link>
              </div>
            </div>
          </SiteContainer>
        </div>
      </section>

      {/* Me Time Section */}
      <MeTimeSection />

      {/* Services Section */}
      <ServicesSection services={services} />

      {/* Testimonials Section */}
      <FlashSaleTestimonials testimonials={activeTestimonials} />

      {/* Trust/Features */}
      <TrustFeatures />

      {/* Footer */}
      <Footer13 />
    </div>
  );
}
