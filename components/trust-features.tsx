"use client";

import { Zap, CalendarCheck, ShieldCheck, LucideIcon } from "lucide-react";
import { useInView } from "@/hooks/useInView";
import { SiteContainer } from "@/components/site-container";

interface FeatureItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

const features: FeatureItem[] = [
  {
    icon: Zap,
    title: "Langsung Dikirim",
    description:
      "Voucher otomatis terkirim via WhatsApp dan Email setelah pembayaran berhasil.",
  },
  {
    icon: CalendarCheck,
    title: "Berlaku 12 Bulan",
    description: "Fleksibel digunakan kapan saja sesuai jadwal kamu.",
  },
  {
    icon: ShieldCheck,
    title: "Pembayaran Aman",
    description: "Transaksi terpercaya via QRIS, Transfer Bank, dan Kartu Kredit.",
  },
];

const TrustFeatures = () => {
  const [sectionRef, isInView] = useInView<HTMLElement>({ threshold: 0.1 });

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-primary py-24 text-primary-foreground">
      {/* Gradient Mesh - Soft organic shapes */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-primary-foreground/10 rounded-full blur-3xl" />
      </div>

      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/50 to-primary" />

      {/* Content */}
      <SiteContainer className="relative z-10">
        <div className={`text-center mb-16 ${isInView ? "animate-fade-slide-up" : "opacity-0"}`}>
          <h2 className="font-sans font-semibold text-4xl mb-4">
            Kenapa Pilih Kami
          </h2>
          <div className="h-1 w-20 bg-accent mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`group rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-8 text-center backdrop-blur-sm transition-[background-color,box-shadow,transform] duration-300 hover:bg-primary-foreground/10 card-hover-lift ${
                isInView ? "animate-fade-slide-up" : "opacity-0"
              }`}
              style={{ animationDelay: isInView ? `${(index + 1) * 100}ms` : "0ms" }}
            >
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-foreground/10 text-primary-foreground/80 shadow-lg shadow-primary-foreground/5 transition-[background-color,color,transform] duration-300 group-hover:scale-110 group-hover:bg-accent group-hover:text-accent-foreground">
                <feature.icon size={36} aria-hidden="true" />
              </div>
              <h3 className="font-sans font-semibold text-xl mb-3 group-hover:text-accent transition-colors">
                {feature.title}
              </h3>
              <p className="text-primary-foreground/70 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </SiteContainer>
    </section>
  );
};

export { TrustFeatures };
