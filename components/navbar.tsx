"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ShoppingBag, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  // Hide navbar on checkout and admin pages (admin uses sidebar navigation)
  if (pathname.startsWith("/checkout") || pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border text-foreground transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="font-sans text-2xl tracking-wider font-bold text-foreground">
              KALANARA
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/"
              className="hover:text-muted-foreground font-medium transition-colors"
            >
              Home
            </Link>
            <Link
              href="/#services"
              className="hover:text-muted-foreground font-medium transition-colors"
            >
              Treatments
            </Link>
            <Link
              href="/verify"
              className="hover:text-muted-foreground font-medium transition-colors flex items-center gap-1"
            >
              <ShieldCheck size={16} /> Verify
            </Link>

            {isAuthenticated && !isLoading ? (
              <Link
                href="/admin/dashboard"
                className="text-sm font-semibold text-foreground hover:text-muted-foreground"
              >
                Dashboard
              </Link>
            ) : !isLoading ? (
              <Link
                href="/admin/login"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Staff Login
              </Link>
            ) : null}

            <Link
              href="/#services"
              className="bg-primary text-primary-foreground px-5 py-2 rounded-full hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <ShoppingBag size={18} />
              <span>Buy Voucher</span>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setIsOpen(!isOpen)} className="p-2">
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
