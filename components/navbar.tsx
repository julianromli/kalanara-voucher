"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ShoppingBag, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    // Check initial scroll position
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Hide navbar on checkout, voucher detail, and admin pages
  if (pathname.startsWith("/checkout") || pathname.startsWith("/voucher") || pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <nav
      className={`fixed top-0 z-50 w-full transition-all duration-500 ease-out ${
        isScrolled
          ? "bg-background/80 backdrop-blur-md border-b border-border shadow-sm text-foreground"
          : "bg-transparent border-b border-transparent text-primary-foreground"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span
              className={`font-sans text-2xl tracking-wider font-bold transition-colors duration-500 ${
                isScrolled ? "text-foreground" : "text-primary-foreground"
              }`}
            >
              KALANARA
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/"
              className={`font-medium transition-colors duration-500 ${
                isScrolled
                  ? "text-foreground hover:text-muted-foreground"
                  : "text-primary-foreground/90 hover:text-primary-foreground"
              }`}
            >
              Home
            </Link>
            <Link
              href="/#services"
              className={`font-medium transition-colors duration-500 ${
                isScrolled
                  ? "text-foreground hover:text-muted-foreground"
                  : "text-primary-foreground/90 hover:text-primary-foreground"
              }`}
            >
              Treatments
            </Link>
            <Link
              href="/verify"
              className={`font-medium transition-colors duration-500 flex items-center gap-1 ${
                isScrolled
                  ? "text-foreground hover:text-muted-foreground"
                  : "text-primary-foreground/90 hover:text-primary-foreground"
              }`}
            >
              <ShieldCheck size={16} /> Verify
            </Link>

            {isAuthenticated && !isLoading ? (
              <Link
                href="/admin/dashboard"
                className={`text-sm font-semibold transition-colors duration-500 ${
                  isScrolled
                    ? "text-foreground hover:text-muted-foreground"
                    : "text-primary-foreground hover:text-primary-foreground/80"
                }`}
              >
                Dashboard
              </Link>
            ) : !isLoading ? (
              <Link
                href="/admin/login"
                className={`text-sm transition-colors duration-500 ${
                  isScrolled
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-primary-foreground/70 hover:text-primary-foreground"
                }`}
              >
                Staff Login
              </Link>
            ) : null}

            <Link
              href="/#services"
              className={`px-5 py-2 rounded-full transition-all duration-500 flex items-center gap-2 ${
                isScrolled
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-accent text-accent-foreground hover:bg-accent/90"
              }`}
            >
              <ShoppingBag size={18} />
              <span>Buy Voucher</span>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`p-2 transition-colors duration-500 ${
                isScrolled ? "text-foreground" : "text-primary-foreground"
              }`}
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden absolute top-20 left-0 w-full p-4 shadow-lg bg-background text-foreground">
          <div className="flex flex-col space-y-4">
            <Link
              href="/"
              onClick={() => setIsOpen(false)}
              className="block py-2"
            >
              Home
            </Link>
            <Link
              href="/#services"
              onClick={() => setIsOpen(false)}
              className="block py-2"
            >
              Treatments
            </Link>
            <Link
              href="/verify"
              onClick={() => setIsOpen(false)}
              className="block py-2 flex items-center gap-2"
            >
              <ShieldCheck size={16} /> Verify Voucher
            </Link>
            {isAuthenticated && !isLoading ? (
              <Link
                href="/admin/dashboard"
                onClick={() => setIsOpen(false)}
                className="block py-2 font-bold"
              >
                Dashboard
              </Link>
            ) : !isLoading ? (
              <Link
                href="/admin/login"
                onClick={() => setIsOpen(false)}
                className="block py-2 text-sm opacity-70"
              >
                Staff Login
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </nav>
  );
}
