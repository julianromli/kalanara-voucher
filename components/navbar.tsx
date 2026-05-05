"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Menu01Icon,
  Cancel01Icon,
  Shield01Icon,
  Ticket01Icon,
} from "@hugeicons/core-free-icons";
import { SiteContainer } from "@/components/site-container";
import { CartNavLink } from "@/components/cart-nav-link";
import { AnnouncementBar } from "@/components/announcement-bar";

type NavItem = {
  href: string;
  label: string;
  icon?: IconSvgElement;
};

interface NavbarProps {
  announcementText?: string;
  announcementCountdownEndAt?: string;
}

export default function Navbar({
  announcementText,
  announcementCountdownEndAt,
}: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Trigger mount animation after a small delay for smooth reveal
    const mountTimer = setTimeout(() => setIsMounted(true), 100);

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    // Check initial scroll position
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(mountTimer);
    };
  }, []);

  // Hide navbar on checkout, voucher detail, and admin pages
  if (
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/voucher") ||
    pathname.startsWith("/admin")
  ) {
    return null;
  }

  // Nav items for staggered animation
  const navItems: NavItem[] = [
    { href: "/", label: "Beranda" },
    { href: "/#services", label: "Paket Voucher" },
    { href: "/verify", label: "Cek Voucher", icon: Shield01Icon },
  ];

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-500 ease-out flex flex-col ${isMounted ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        }`}
    >
      <AnnouncementBar
        text={announcementText}
        countdownEndAt={announcementCountdownEndAt}
      />
      <div
        className={`w-full transition-all duration-500 ${isScrolled
            ? "bg-background/80 backdrop-blur-md border-b border-border shadow-sm text-foreground"
            : "bg-transparent border-b border-transparent text-primary-foreground"
          }`}
      >
        <SiteContainer>
          <div className="flex justify-between h-20 items-center">
            {/* Logo */}
            <Link
              href="/"
              className={`flex items-center transition-all duration-500 ${isMounted ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"
                }`}
              style={{ transitionDelay: isMounted ? "200ms" : "0ms" }}
            >
              <div className="relative h-8 w-32">
                <Image
                  src="/logo-kalanara-light.png"
                  alt="Kalanara Spa"
                  fill
                  className={`object-contain transition-opacity duration-500 ${
                    isScrolled ? "opacity-0" : "opacity-100"
                  }`}
                  priority
                />
                <Image
                  src="/logo-kalanara-dark.png"
                  alt="Kalanara Spa"
                  fill
                  className={`object-contain transition-opacity duration-500 ${
                    isScrolled ? "opacity-100" : "opacity-0"
                  }`}
                  priority
                />
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav
              aria-label="Menu utama"
              className="hidden md:flex items-center space-x-8"
            >
              {navItems.map((item, index) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`font-medium transition-all duration-500 flex items-center gap-1 ${isMounted ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
                    } ${isScrolled
                      ? "text-foreground hover:text-muted-foreground"
                      : "text-primary-foreground/90 hover:text-primary-foreground"
                    }`}
                  style={{ transitionDelay: isMounted ? `${300 + index * 75}ms` : "0ms" }}
                >
                  {item.icon ? (
                    <HugeiconsIcon icon={item.icon} size={16} className="shrink-0" aria-hidden />
                  ) : null}
                  {item.label}
                </Link>
              ))}

              <Link
                href="/#services"
                className={`btn-hover-lift px-5 py-2 rounded-lg transition-all duration-500 flex items-center gap-2 ${isMounted ? "translate-y-0 opacity-100 scale-100" : "-translate-y-2 opacity-0 scale-95"
                  } ${isScrolled
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-accent text-accent-foreground hover:bg-accent/90"
                  }`}
                style={{ transitionDelay: isMounted ? "600ms" : "0ms" }}
              >
                <HugeiconsIcon icon={Ticket01Icon} size={18} aria-hidden />
                <span>Beli Voucher</span>
              </Link>
              <CartNavLink
                className={`font-medium transition-all duration-500 ${isMounted ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
                  } ${isScrolled
                    ? "text-foreground hover:text-muted-foreground"
                    : "text-primary-foreground/90 hover:text-primary-foreground"
                  }`}
                style={{ transitionDelay: isMounted ? "675ms" : "0ms" }}
              />
            </nav>

            {/* Mobile Menu Button */}
            <div
              className={`md:hidden flex items-center transition-all duration-500 ${isMounted ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
                }`}
              style={{ transitionDelay: isMounted ? "300ms" : "0ms" }}
            >
              <CartNavLink
                className={`font-medium transition-all duration-500 mr-2 ${isMounted ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
                  } ${isScrolled ? "text-foreground" : "text-primary-foreground"}`}
                style={{ transitionDelay: isMounted ? "350ms" : "0ms" }}
              />
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls="primary-mobile-menu"
                aria-label={isOpen ? "Tutup menu utama" : "Buka menu utama"}
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 transition-colors duration-500 ${isScrolled ? "text-foreground" : "text-primary-foreground"
                  }`}
              >
                <HugeiconsIcon
                  icon={isOpen ? Cancel01Icon : Menu01Icon}
                  size={24}
                  aria-hidden
                />
              </button>
            </div>
          </div>
        </SiteContainer>
      </div>

      {/* Mobile Menu with slide animation */}
      <nav
        id="primary-mobile-menu"
        aria-label="Menu utama"
        className={`md:hidden absolute top-full left-0 w-full shadow-lg bg-background text-foreground overflow-hidden transition-all duration-300 ease-out ${isOpen
          ? "visible max-h-96 opacity-100"
          : "invisible pointer-events-none max-h-0 opacity-0"
          }`}
        aria-hidden={!isOpen}
      >
        <div className="p-4 flex flex-col space-y-4">
          {navItems.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={`block py-2 flex items-center gap-2 transition-all duration-300 ${isOpen ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"
                }`}
              style={{ transitionDelay: isOpen ? `${index * 50}ms` : "0ms" }}
            >
              {item.icon ? (
                <HugeiconsIcon icon={item.icon} size={16} className="shrink-0" aria-hidden />
              ) : null}
              {item.label === "Cek Voucher" ? "Cek Voucher Kamu" : item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
