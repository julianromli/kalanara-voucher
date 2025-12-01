"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  LockIcon,
  Mail01Icon,
  ViewIcon,
  ViewOffIcon,
  Loading03Icon,
  Leaf01Icon,
} from "@hugeicons/core-free-icons";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push("/admin/dashboard");
    }
  }, [isAuthenticated, authLoading, router]);

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <HugeiconsIcon icon={Loading03Icon} className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  // Don't render form if authenticated (redirect in progress)
  if (isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await login(email, password);

    if (result.success) {
      showToast("Welcome back!", "success");
      router.push("/admin/dashboard");
    } else {
      setError(result.error || "Login failed");
      showToast(result.error || "Login failed", "error");
    }

    setIsSubmitting(false);
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Form */}
      <div className="flex items-center justify-center w-full lg:w-1/3 bg-background px-6 py-12 lg:px-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div
            className={cn(isMounted ? "animate-fade-slide-down" : "opacity-0")}
          >
            <div className="flex items-center gap-3 mb-12">
              <div className="size-10 bg-gradient-to-br from-sage-500 to-sage-700 rounded-xl shadow-lg flex items-center justify-center text-white">
                <HugeiconsIcon icon={Leaf01Icon} className="size-6" />
              </div>
              <div>
                <span className="font-semibold text-lg text-foreground">
                  Kalanara Spa
                </span>
                <p className="text-xs text-muted-foreground">Admin Portal</p>
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="text-base mt-3 text-muted-foreground text-balance">
              Sign in to access your admin dashboard and manage spa operations.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="mt-10 space-y-5">
            {error && (
              <div
                className={cn(
                  "bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm",
                  isMounted ? "animate-fade-slide-up" : "opacity-0",
                )}
              >
                {error}
              </div>
            )}

            {/* Email */}
            <div
              className={cn(isMounted ? "animate-fade-slide-up" : "opacity-0")}
              style={{ animationDelay: "150ms" }}
            >
              <label
                htmlFor="email"
                className="block text-sm font-medium text-muted-foreground mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <HugeiconsIcon
                  icon={Mail01Icon}
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-10 h-10 bg-background border-border ring-1 ring-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  required
                  disabled={isSubmitting}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div
              className={cn(isMounted ? "animate-fade-slide-up" : "opacity-0")}
              style={{ animationDelay: "225ms" }}
            >
              <label
                htmlFor="password"
                className="block text-sm font-medium text-muted-foreground mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 pr-10 bg-background border-border ring-1 ring-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  required
                  disabled={isSubmitting}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isSubmitting}
                  tabIndex={-1}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <HugeiconsIcon icon={ViewOffIcon} size={16} />
                  ) : (
                    <HugeiconsIcon icon={ViewIcon} size={16} />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div
              className={cn(
                "flex items-center gap-2",
                isMounted ? "animate-fade-slide-up" : "opacity-0",
              )}
              style={{ animationDelay: "300ms" }}
            >
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                disabled={isSubmitting}
                className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <label
                htmlFor="remember"
                className="text-sm font-medium text-muted-foreground cursor-pointer select-none"
              >
                Remember me for 30 days
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "w-full h-10 font-medium btn-hover-lift",
                isMounted ? "animate-fade-slide-up" : "opacity-0",
              )}
              style={{ animationDelay: "375ms" }}
            >
              {isSubmitting ? (
                <>
                  <HugeiconsIcon icon={Loading03Icon} className="size-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Right Side - Image */}
      <div className="relative hidden lg:block lg:w-2/3 overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=1200&q=80"
          alt="Spa atmosphere"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-primary/75" />

        {/* Quote Overlay */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-start justify-end p-10",
            isMounted ? "animate-fade-slide-up" : "opacity-0",
          )}
          style={{ animationDelay: "400ms" }}
        >
          <div className="max-w-lg">
            <p className="text-xl md:text-2xl lg:text-3xl font-semibold text-primary-foreground text-balance leading-snug">
              Elevate your guests&apos; experience with seamless voucher
              management.
            </p>
            <p className="text-base mt-4 text-primary-foreground/80 text-balance">
              Kalanara Spa — Where wellness meets hospitality.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
