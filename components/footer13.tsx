"use client";

import Link from "next/link";
import {
  ArrowRight,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInView } from "@/hooks/useInView";
import type { FooterCopy } from "@/lib/landing-copy";

const SOCIAL_ICONS: LucideIcon[] = [Facebook, Twitter, Linkedin, Instagram];

interface Footer13Props {
  copy: FooterCopy;
}

const Footer13 = ({ copy }: Footer13Props) => {
  const [footerRef, isInView] = useInView<HTMLElement>({ threshold: 0.1 });
  const visibleSocial = copy.social
    .map((link, index) => ({
      ...link,
      icon: SOCIAL_ICONS[index] ?? Facebook,
    }))
    .filter((link) => link.href.trim() !== "");

  return (
    <section
      id="footer"
      ref={footerRef}
      className="bg-background text-foreground py-16 md:py-24 scroll-mt-36"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <footer>
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
                {copy.ctaTitleBefore}
                <span className="text-accent relative inline-block ml-3">
                  {copy.ctaEmphasis}
                  <span className="bg-accent/30 absolute bottom-1 left-0 h-1 w-full rounded-full"></span>
                </span>
              </h2>
              <p
                className={`text-primary-foreground/80 mt-4 max-w-[600px] text-lg ${
                  isInView ? "animate-fade-slide-up animate-stagger-2" : "opacity-0"
                }`}
              >
                {copy.ctaDescription}
              </p>
              <div
                className={`mt-8 flex flex-col gap-4 sm:flex-row ${
                  isInView ? "animate-fade-slide-up animate-stagger-3" : "opacity-0"
                }`}
              >
                <Button asChild size="lg" className="btn-hover-lift group bg-accent text-accent-foreground hover:bg-accent/90">
                  <Link href="/#services" className="flex items-center gap-2">
                    {copy.ctaButton}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div
            className={`border-border mb-14 border-b pb-14 ${
              isInView ? "animate-fade-slide-up animate-stagger-4" : "opacity-0"
            }`}
          >
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-2xl font-medium text-foreground">
                  {copy.newsletterTitle}
                </h3>
                <p className="text-muted-foreground max-w-md">
                  {copy.newsletterDescription}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative grow">
                  <Input
                    type="email"
                    placeholder={copy.newsletterPlaceholder}
                    className="border-border bg-muted/50 h-12 pl-4"
                  />
                </div>
                <Button type="submit" className="btn-hover-lift h-12 px-6 bg-primary text-primary-foreground hover:bg-primary/90">
                  {copy.newsletterButton}
                </Button>
              </div>
            </div>
          </div>

          <nav className="border-border grid grid-cols-2 gap-x-6 gap-y-10 border-b py-10 sm:grid-cols-4 lg:py-16">
            {copy.columns.map((section, index) => (
              <div
                key={section.title}
                className={isInView ? "animate-fade-slide-up" : "opacity-0"}
                style={{ animationDelay: isInView ? `${500 + index * 100}ms` : "0ms" }}
              >
                <h3 className="mb-5 text-lg font-semibold text-foreground">{section.title}</h3>
                <ul className="space-y-4">
                  {section.links.map((link) => (
                    <li key={`${link.name}-${link.href}`}>
                      <Link
                        href={link.href}
                        className="text-muted-foreground hover:text-primary inline-block transition-colors duration-200 hover:translate-x-1 transform"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="mx-auto mt-4 py-8">
            <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
              <p
                className={`text-muted-foreground font-medium ${
                  isInView ? "animate-fade-slide-up" : "opacity-0"
                }`}
                style={{ animationDelay: isInView ? "900ms" : "0ms" }}
              >
                © {new Date().getFullYear()} {copy.copyright}
              </p>
              {visibleSocial.length > 0 ? (
                <div className="flex items-center gap-6">
                  {visibleSocial.map((link, index) => (
                    <a
                      aria-label={link.label}
                      key={`${link.label}-${link.href}`}
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
              ) : null}
            </div>
          </div>
        </footer>
      </div>
    </section>
  );
};

export { Footer13 };
