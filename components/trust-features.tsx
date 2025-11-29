import { Zap, CalendarCheck, ShieldCheck, LucideIcon } from "lucide-react";

interface FeatureItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

const features: FeatureItem[] = [
  {
    icon: Zap,
    title: "Instant Delivery",
    description:
      "Vouchers are sent automatically via WhatsApp & Email immediately after purchase.",
  },
  {
    icon: CalendarCheck,
    title: "Valid for 12 Months",
    description: "Flexible redemption period to suit your schedule.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Payment",
    description: "Trusted payments via QRIS, Bank Transfer, and Credit Cards.",
  },
];

const TrustFeatures = () => {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-sans font-semibold text-4xl mb-4">
            Why Choose Us
          </h2>
          <div className="h-1 w-20 bg-accent mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group bg-primary-foreground/5 backdrop-blur-sm rounded-2xl p-8 border border-primary-foreground/10 hover:bg-primary-foreground/10 transition-all duration-300 text-center"
            >
              <div className="w-20 h-20 mx-auto bg-primary-foreground/10 rounded-2xl flex items-center justify-center mb-6 text-primary-foreground/80 group-hover:scale-110 group-hover:bg-accent group-hover:text-accent-foreground transition-all duration-300 shadow-lg shadow-primary-foreground/5">
                <feature.icon size={36} />
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
      </div>
    </section>
  );
};

export { TrustFeatures };
