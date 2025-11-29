import {
  ArrowRight,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  return (
    <section className="bg-primary text-primary-foreground py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <footer>
          <div className="bg-primary-foreground/5 mb-16 rounded-2xl p-8 backdrop-blur-sm md:p-12 lg:p-16">
            <div className="flex flex-col items-center text-center">
              <h2 className="max-w-[800px] text-balance text-4xl font-semibold leading-tight tracking-tight md:text-5xl lg:text-6xl">
                Gift the Joy of
                <span className="text-sand-600 relative inline-block ml-3">
                  Relaxation
                  <span className="bg-sand-600/30 absolute bottom-1 left-0 h-1 w-full rounded-full"></span>
                </span>
              </h2>
              <p className="text-primary-foreground/80 mt-4 max-w-[600px] text-lg">
                Premium spa vouchers for someone special.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Button asChild variant="secondary" size="lg" className="group">
                  <a href="/vouchers" className="flex items-center gap-2">
                    Shop Spa Vouchers Now
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </a>
                </Button>
              </div>
            </div>
          </div>

          {/* Newsletter Section */}
          <div className="border-sand-600/20 mb-14 border-b pb-14">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-2xl font-medium">
                  Wellness Tips & Exclusive Offers
                </h3>
                <p className="text-primary-foreground/70 max-w-md">
                  Subscribe for spa insights, seasonal promotions, and early
                  access to new treatment packages.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative grow">
                  <Input
                    type="email"
                    placeholder="Your email address"
                    className="border-primary-foreground/20 bg-primary-foreground/10 h-12 pl-10"
                  />
                </div>
                <Button variant="secondary" type="submit" className="h-12 px-6">
                  Subscribe
                </Button>
              </div>
            </div>
          </div>

          {/* Navigation Section */}
          <nav className="border-sand-600/20 grid grid-cols-2 gap-x-6 gap-y-10 border-b py-10 sm:grid-cols-4 lg:py-16">
            {navigation.map((section) => (
              <div key={section.title}>
                <h3 className="mb-5 text-lg font-semibold">{section.title}</h3>
                <ul className="space-y-4">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      <a
                        href={link.href}
                        className="text-primary-foreground/80 hover:text-primary-foreground inline-block transition-colors duration-200"
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
              <p className="text-primary-foreground/80 font-medium">
                © {new Date().getFullYear()} Kalanara Spa. Luxury wellness
                experiences in Indonesia.
              </p>
              <div className="flex items-center gap-6">
                {socialLinks.map((link) => (
                  <a
                    aria-label={link.label}
                    key={link.href}
                    href={link.href}
                    className="text-primary-foreground/70 hover:text-primary-foreground/100 transition-colors"
                  >
                    <link.icon
                      size={20}
                      className="transition-transform hover:scale-110"
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
