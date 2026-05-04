"use client";

import { useInView } from "@/hooks/useInView";
import { SiteContainer } from "@/components/site-container";
import { ArrowRight } from "lucide-react";
import React from "react";

interface Persona {
  emoji: string;
  quote: React.ReactNode;
  label: string;
}

const personas: Persona[] = [
  {
    emoji: "👩‍👧",
    quote: (
      <>
        “Mama kerja keras tiap hari, kapan aku kasih dia waktu buat dirinya
        sendiri?”
      </>
    ),
    label: "Hadiah yang lebih bermakna dari bunga atau kue",
  },
  {
    emoji: "💑",
    quote: (
      <>
        “Dia selalu support aku. Pengen kasih sesuatu yang beda, bukan yang
        biasa-biasa.”
      </>
    ),
    label: "Buat pasangan yang layak dipanjakan",
  },
  {
    emoji: "👯‍♀️",
    quote: (
      <>
        “Ultahnya sebentar lagi, dan aku mau kasih hadiah yang dia ingat
        terus.”
      </>
    ),
    label: "Hadiah yang terasa personal dan thoughtful",
  },
  {
    emoji: "🌙",
    quote: (
      <>
        “Aku sendiri juga udah lama nggak punya me-time. Ini saatnya.”
      </>
    ),
    label: "Karena merawat diri bukan kemewahan — itu kebutuhan",
  },
];

export function MeTimeSection() {
  const [sectionRef, isInView] = useInView<HTMLElement>({ threshold: 0.1 });

  return (
    <section
      id="me-time-gift"
      ref={sectionRef}
      className="relative overflow-hidden bg-background py-24"
    >
      {/* Decorative Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <SiteContainer className="relative z-10">
        {/* Header Section */}
        <div
          className={`text-center mb-16 max-w-3xl mx-auto ${
            isInView ? "animate-fade-slide-up" : "opacity-0"
          }`}
        >
          <span className="text-primary/60 tracking-[0.2em] text-xs md:text-sm uppercase mb-4 block font-semibold">
            Kamu pasti relate
          </span>
          <h2 className="font-sans font-semibold text-3xl sm:text-4xl text-foreground mb-4 sm:mb-6 leading-tight text-wrap-balance">
            Kapan terakhir kali dia benar-benar <i className="font-normal text-primary">me-time?</i>
          </h2>
          <div className="h-1 w-20 bg-accent mx-auto rounded-full mb-8" />
          <p className="text-lg text-muted-foreground leading-relaxed">
            Kamu tahu ia sudah capek. Kamu ingin berterima kasih. Tapi bingung
            mau kasih apa yang terasa bermakna.
          </p>
        </div>

        {/* Persona Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-24">
          {personas.map((persona, index) => (
            <div
              key={index}
              className={`bg-card rounded-2xl p-8 border border-border/50 shadow-sm transition-all duration-300 hover:shadow-md hover:border-border card-hover-lift ${
                isInView ? "animate-fade-slide-up" : "opacity-0"
              }`}
              style={{
                animationDelay: isInView ? `${(index + 1) * 150}ms` : "0ms",
              }}
            >
              <div className="text-4xl mb-4">{persona.emoji}</div>
              <p className="text-lg text-foreground font-medium mb-4 italic leading-relaxed">
                {persona.quote}
              </p>
              <p className="text-sm text-muted-foreground">
                {persona.label}
              </p>
            </div>
          ))}
        </div>

        {/* Value Bridge & CTA */}
        <div
          className={`bg-primary rounded-3xl p-10 md:p-16 text-center text-primary-foreground relative overflow-hidden shadow-2xl ${
            isInView ? "animate-fade-slide-up" : "opacity-0"
          }`}
          style={{ animationDelay: isInView ? "600ms" : "0ms" }}
        >
          {/* Inner Glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-accent/20 via-transparent to-accent/20 opacity-50" />
          
          <div className="relative z-10 max-w-3xl mx-auto">
            <span className="text-primary-foreground/70 tracking-widest text-xs md:text-sm uppercase mb-4 block">
              Yang kamu rasakan, bukan cuma kamu
            </span>
            <h3 className="font-sans font-semibold text-2xl sm:text-3xl md:text-4xl mb-6 leading-tight">
              Semua orang butuh waktu untuk <i className="font-normal text-primary-foreground/90">benar-benar istirahat</i> — bukan sekadar libur.
            </h3>
            <p className="text-primary-foreground/80 text-base md:text-lg mb-8 leading-relaxed max-w-2xl mx-auto">
              Dan hadiah terbaik yang bisa kamu berikan adalah waktu — waktu yang
              diisi dengan ketenangan, bukan kesibukan.
              <br />
              <br />
              <strong className="font-semibold text-primary-foreground">Biar kami yang urus sisanya.</strong>
            </p>
            <a
              href="#services"
              className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-8 py-4 rounded-full text-base font-semibold hover:bg-accent/90 transition-all hover:scale-105 shadow-xl mx-auto btn-hover-lift"
            >
              Lihat Pilihan Gift Voucher
              <ArrowRight size={20} aria-hidden="true" />
            </a>
          </div>
        </div>
      </SiteContainer>
    </section>
  );
}
