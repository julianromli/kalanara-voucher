"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, ShoppingBag, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, logout, user } = useAuth();
  const { showToast } = useToast();

  const isAdminRoute = pathname.startsWith("/admin");
  const useAdminStyle = isAdminRoute;

  // Hide navbar on checkout pages
  if (pathname.startsWith("/checkout")) return null;

  const handleLogout = () => {
    logout();
    showToast("Logged out successfully", "info");
    router.push("/");
  };

  return (
    <nav
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        useAdminStyle
          ? "bg-sage-900 text-white"
          : "bg-sand-100/80 backdrop-blur-md border-b border-sage-200 text-sage-900"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span
              className={`font-serif text-2xl tracking-wider font-semibold ${
                useAdminStyle ? "text-sand-100" : "text-sage-800"
              }`}
            >
              KALANARA
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            {!useAdminStyle ? (
              <>
                <Link
                  href="/"
                  className="hover:text-sage-600 font-medium transition-colors"
                >
                  Home
                </Link>
                <a
                  href="/#services"
                  className="hover:text-sage-600 font-medium transition-colors"
                >
                  Treatments
                </a>
                <Link
                  href="/verify"
                  className="hover:text-sage-600 font-medium transition-colors flex items-center gap-1"
                >
                  <ShieldCheck size={16} /> Verify
                </Link>

                {isAuthenticated ? (
                  <Link
                    href="/admin/dashboard"
                    className="text-sm font-semibold text-sage-800 hover:text-sage-600"
                  >
                    Dashboard ({user?.role})
                  </Link>
                ) : (
                  <Link
                    href="/admin/login"
                    className="text-sm text-sage-500 hover:text-sage-800"
                  >
                    Staff Login
                  </Link>
                )}

                <a
                  href="/#services"
                  className="bg-sage-800 text-sand-100 px-5 py-2 rounded-full hover:bg-sage-700 transition-colors flex items-center gap-2"
                >
                  <ShoppingBag size={18} />
                  <span>Buy Voucher</span>
                </a>
              </>
            ) : (
              <div className="flex items-center space-x-6">
                <span className="text-sm text-sand-300">
                  Welcome, {user?.name || "Staff"}
                </span>
                <Link
                  href="/"
                  className="text-xs border border-sand-500 px-3 py-1 rounded hover:bg-sand-500 hover:text-sage-900 transition"
                >
                  Back to Site
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-red-300 hover:text-red-100"
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            )}
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
        <div
          className={`md:hidden absolute top-20 left-0 w-full p-4 shadow-lg ${
            useAdminStyle
              ? "bg-sage-900 text-white"
              : "bg-sand-100 text-sage-900"
          }`}
        >
          <div className="flex flex-col space-y-4">
            {!useAdminStyle ? (
              <>
                <Link
                  href="/"
                  onClick={() => setIsOpen(false)}
                  className="block py-2"
                >
                  Home
                </Link>
                <a
                  href="/#services"
                  onClick={() => setIsOpen(false)}
                  className="block py-2"
                >
                  Treatments
                </a>
                <Link
                  href="/verify"
                  onClick={() => setIsOpen(false)}
                  className="block py-2 flex items-center gap-2"
                >
                  <ShieldCheck size={16} /> Verify Voucher
                </Link>
                {isAuthenticated ? (
                  <Link
                    href="/admin/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="block py-2 font-bold"
                  >
                    Dashboard
                  </Link>
                ) : (
                  <Link
                    href="/admin/login"
                    onClick={() => setIsOpen(false)}
                    className="block py-2 text-sm opacity-70"
                  >
                    Staff Login
                  </Link>
                )}
              </>
            ) : (
              <>
                <div className="py-2 text-sm text-sand-300">
                  Signed in as {user?.role}
                </div>
                <button
                  onClick={handleLogout}
                  className="text-left py-2 text-red-300"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
