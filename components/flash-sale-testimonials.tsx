"use client";

import { Quote } from "lucide-react";
import { useInView } from "@/hooks/useInView";
import { SiteContainer } from "@/components/site-container";

interface Testimonial {
  id: string;
  for: string;
  quote: string;
  initials: string;
  name: string;
  location: string;
}

const testimonials: Testimonial[] = [
  {
    id: "t1",
    for: "untuk mama",
    quote:
      "Mama nangis pas buka hadiahnya. Dia bilang ini pertama kalinya dia ngerasa beneran dipamerin. Bukan bunga, bukan kue — tapi waktu buat dia sendiri.",
    initials: "AR",
    name: "Arika R.",
    location: "Jakarta Selatan",
  },
  {
    id: "t2",
    for: "untuk pasangan",
    quote:
      "Udah lama pengen kasih sesuatu yang beda buat istri. Dia selalu bilang fine, tapi aku tahu dia capek. Akhirnya nemu yang pas di sini.",
    initials: "DH",
    name: "Dimas H.",
    location: "Bekasi",
  },
  {
    id: "t3",
    for: "untuk sahabat",
    quote:
      "Ultah dia tinggal seminggu lagi dan aku bingung. Teman-teman bilang “kue aja”, tapi aku mau yang dia ceritain ke orang lain. Ini jawabannya.",
    initials: "NW",
    name: "Nadia W.",
    location: "Depok",
  },
  {
    id: "t4",
    for: "untuk diri sendiri",
    quote:
      "Aku pesan buat diri sendiri. Sudah lama banget nggak meluangkan waktu beneran. Setelah sesi-nya — aku lupa kapan terakhir ngerasa se-tenang ini.",
    initials: "SR",
    name: "Sari R.",
    location: "Tangerang",
  },
];

export function FlashSaleTestimonials() {
  const [sectionRef, isInView] = useInView<HTMLElement>({ threshold: 0.1 });

  return (
    <section ref={sectionRef} className="bg-card py-24 relative overflow-hidden">
      <SiteContainer className="relative z-10">
        <div
          className={`text-center mb-16 max-w-3xl mx-auto ${
            isInView ? "animate-fade-slide-up" : "opacity-0"
          }`}
        >
          <h2 className="font-sans font-semibold text-3xl sm:text-4xl text-foreground mb-4 sm:mb-6 leading-tight">
            500+ Perempuan sudah merasakannya. <i className="font-normal text-primary">Kamu bisa juga.</i>
          </h2>
          <div className="h-1 w-20 bg-accent mx-auto rounded-full mb-6"></div>
          <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
            Hadiah yang paling diingat adalah yang terasa paling personal — bukan yang paling mahal.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 mb-16">
          {testimonials.map((t, index) => (
            <div
              key={t.id}
              className={`bg-background p-8 rounded-2xl border border-border/50 relative shadow-sm card-hover-lift ${
                isInView ? "animate-fade-slide-up" : "opacity-0"
              }`}
              style={{
                animationDelay: isInView ? `${(index + 1) * 150}ms` : "0ms",
              }}
            >
              <Quote
                className="absolute top-6 right-6 text-primary/10"
                size={48}
                aria-hidden="true"
              />
              <div className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-wider mb-6">
                {t.for}
              </div>
              <p className="text-foreground text-lg italic mb-8 leading-relaxed relative z-10">
                “{t.quote}”
              </p>
              <div className="flex items-center gap-4 mt-auto border-t border-border/50 pt-6">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-primary/10 flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.dicebear.com/9.x/notionists/svg?seed=${t.name}`}
                    alt={`${t.name} avatar`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-bold text-foreground text-base">{t.name}</p>
                  <p className="text-sm text-muted-foreground">{t.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SiteContainer>
    </section>
  );
}
