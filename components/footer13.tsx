"use client";

import {
  ArrowRight,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInView } from "@/hooks/useInView";

const navigation = [
  {
    title: "Spa Vouchers",
    links: [
      { name: "Gift Vouchers", href: "/vouchers" },
      { name: "Massage Treatments", href: "/vouchers#massage" },
      { name: "Body Treatments", href: "/vouchers#body" },
      { name: "Facial Treatments", href: "/vouchers#facial" },
    ],
  },
  {
    title: "Kalanara Spa",
    links: [
      { name: "About Us", href: "/about" },
      { name: "Our Treatments", href: "/treatments" },
      { name: "Contact Us", href: "/contact" },
    ],
  },
  {
    title: "Help",
    links: [
      { name: "How It Works", href: "/how-it-works" },
      { name: "FAQs", href: "/faq" },
      { name: "Redeem Voucher", href: "/redeem" },
    ],
  },
  {
    title: "Legal",
    links: [
      { name: "Terms of Service", href: "/terms" },
      { name: "Privacy Policy", href: "/privacy" },
    ],
  },
];

const socialLinks = [
  { icon: Facebook, href: "https://facebook.com", label: "Facebook" },
  { icon: Twitter, href: "https://twitter.com", label: "Twitter" },
  { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn" },
  { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
];

const Footer13 = () => {
  const [footerRef, isInView] = useInView<HTMLElement>({ threshold: 0.1 });

  return (
    <section ref={footerRef} className="bg-background text-foreground py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <footer>
          {/* CTA Box - Primary background */}
          <div
            className={`bg-primary text-primary-foreground mb-16 rounded-2xl p-8 md:p-12 lg:p-16 ${
              isInView ? "animate-scale-in" : "opacity-0"
            }`}
          >
            <div className="flex flex-col items-center text-center">
              <h2
                className={`max-w-[800px] text-balance text-4xl font-semibold leading-tight tracking-tight md:text-5xl lg:text-6xl ${
                  isInView ? "animate-fade-slide-up animate-stagger-1" : "opacity-0"
                }`}
              >
                Gift the Joy of
                <span className="text-accent relative inline-block ml-3">
                  Relaxation
                  <span className="bg-accent/30 absolute bottom-1 left-0 h-1 w-full rounded-full"></span>
                </span>
              </h2>
              <p
                className={`text-primary-foreground/80 mt-4 max-w-[600px] text-lg ${
                  isInView ? "animate-fade-slide-up animate-stagger-2" : "opacity-0"
                }`}
              >
                Premium spa vouchers for someone special.
              </p>
              <div
                className={`mt-8 flex flex-col gap-4 sm:flex-row ${
                  isInView ? "animate-fade-slide-up animate-stagger-3" : "opacity-0"
                }`}
              >
                <Button asChild size="lg" className="btn-hover-lift group bg-accent text-accent-foreground hover:bg-accent/90">
                  <a href="/#services" className="flex items-center gap-2">
                    Shop Spa Vouchers Now
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </a>
                </Button>
              </div>
            </div>
          </div>

          {/* Newsletter Section */}
          <div
            className={`border-border mb-14 border-b pb-14 ${
              isInView ? "animate-fade-slide-up animate-stagger-4" : "opacity-0"
            }`}
          >
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-2xl font-medium text-foreground">
                  Wellness Tips & Exclusive Offers
                </h3>
                <p className="text-muted-foreground max-w-md">
                  Subscribe for spa insights, seasonal promotions, and early
                  access to new treatment packages.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative grow">
                  <Input
                    type="email"
                    placeholder="Your email address"
                    className="border-border bg-muted/50 h-12 pl-4"
                  />
                </div>
                <Button type="submit" className="btn-hover-lift h-12 px-6 bg-primary text-primary-foreground hover:bg-primary/90">
                  Subscribe
                </Button>
              </div>
            </div>
          </div>

          {/* Navigation Section */}
          <nav className="border-border grid grid-cols-2 gap-x-6 gap-y-10 border-b py-10 sm:grid-cols-4 lg:py-16">
            {navigation.map((section, index) => (
              <div
                key={section.title}
                className={isInView ? "animate-fade-slide-up" : "opacity-0"}
                style={{ animationDelay: isInView ? `${500 + index * 100}ms` : "0ms" }}
              >
                <h3 className="mb-5 text-lg font-semibold text-foreground">{section.title}</h3>
                <ul className="space-y-4">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      <a
                        href={link.href}
                        className="text-muted-foreground hover:text-primary inline-block transition-colors duration-200 hover:translate-x-1 transform"
                      >
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* Bottom Section */}
          <div className="mx-auto mt-4 py-8">
            <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
              <p
                className={`text-muted-foreground font-medium ${
                  isInView ? "animate-fade-slide-up" : "opacity-0"
                }`}
                style={{ animationDelay: isInView ? "900ms" : "0ms" }}
              >
                © {new Date().getFullYear()} Kalanara Spa. Luxury wellness
                experiences in Indonesia.
              </p>
              <div className="flex items-center gap-6">
                {socialLinks.map((link, index) => (
                  <a
                    aria-label={link.label}
                    key={link.href}
                    href={link.href}
                    className={`text-muted-foreground hover:text-primary transition-all ${
                      isInView ? "animate-scale-in" : "opacity-0"
                    }`}
                    style={{ animationDelay: isInView ? `${950 + index * 50}ms` : "0ms" }}
                  >
                    <link.icon
                      size={20}
                      className="transition-transform hover:scale-125"
                    />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </div>
    </section>
  );
};

export { Footer13 };
