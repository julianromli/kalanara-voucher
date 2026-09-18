import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Footer13 } from "@/components/footer13";
import { TrustFeatures } from "@/components/trust-features";
import { ServicesSection } from "@/components/services-section";
import { MeTimeSection } from "@/components/me-time-section";
import { FlashSaleTestimonials } from "@/components/flash-sale-testimonials";
import { SiteContainer } from "@/components/site-container";
import {
  getPublicLandingData,
  type PublicServiceWithCategory,
} from "@/lib/publicLandingData";
import type { Service } from "@/lib/types";
import { resolveServiceImageUrl } from "@/lib/utils/serviceImages";

function adaptDBServiceToFrontend(dbService: PublicServiceWithCategory): Service {
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
  const {
    services: dbServices,
    heroImageUrl: configuredHeroImageUrl,
    testimonials: activeTestimonials,
    landingCopy,
  } = await getPublicLandingData();

  const services = dbServices.map(adaptDBServiceToFrontend);
  const heroImageUrl =
    configuredHeroImageUrl ||
    "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1920&q=80";
  const hero = landingCopy.hero;

  return (
    <div className="min-h-screen flex flex-col">
      <section className="relative flex min-h-[100dvh] items-center overflow-hidden">
        <div className="absolute inset-0 bg-primary">
          <Image
            src={heroImageUrl}
            alt="Spa Background"
            fill
            sizes="100vw"
            priority
            className="object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-transparent to-primary/30" />
        </div>

        <div className="relative z-10 w-full pt-20">
          <SiteContainer>
            <div className="max-w-3xl">
              <span className="animate-fade-slide-up text-primary-foreground/60 tracking-[0.3em] text-xs md:text-sm uppercase mb-6 block">
                {hero.eyebrow}
              </span>
              <h1 className="animate-fade-slide-up animate-stagger-1 font-sans font-semibold text-4xl sm:text-5xl md:text-6xl lg:text-6xl xl:text-7xl text-primary-foreground mb-8 leading-[1.2] text-wrap-balance max-w-2xl hero-headline">
                {hero.titleLine1}
                <br />
                {hero.titleLine2Before}{" "}
                <span className="italic font-normal text-primary-foreground/70">
                  {hero.titleEmphasis}
                </span>
              </h1>
              <p className="animate-fade-slide-up animate-stagger-2 text-primary-foreground/80 text-base sm:text-lg md:text-xl mb-10 max-w-xl font-light leading-relaxed">
                {hero.description}
              </p>
              <div className="animate-fade-slide-up animate-stagger-3 flex flex-col sm:flex-row items-start gap-4">
                <a
                  href="#services"
                  className="btn-hover-lift inline-flex items-center gap-3 bg-accent text-accent-foreground px-8 py-4 rounded-lg text-base sm:text-lg font-medium hover:bg-accent/90 transition-all shadow-xl"
                >
                  {hero.primaryCta}
                  <ArrowRight size={20} aria-hidden="true" />
                </a>
                <Link
                  href="/verify"
                  className="inline-flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground px-4 py-4 text-base font-medium transition-colors"
                >
                  {hero.secondaryCta}
                </Link>
              </div>
            </div>
          </SiteContainer>
        </div>
      </section>

      <MeTimeSection copy={landingCopy.meTime} />
      <ServicesSection services={services} copy={landingCopy.services} />
      <FlashSaleTestimonials
        testimonials={activeTestimonials}
        copy={landingCopy.testimonials}
      />
      <TrustFeatures copy={landingCopy.trust} />
      <Footer13 copy={landingCopy.footer} />
    </div>
  );
}
