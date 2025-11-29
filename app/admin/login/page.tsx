"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <Loader2 className="size-8 text-primary-foreground animate-spin" />
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
    <div className="min-h-screen bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className={cn(
          "text-center mb-8",
          isMounted ? "animate-fade-slide-down" : "opacity-0"
        )}>
          <h1 className="font-sans font-semibold text-3xl text-primary-foreground mb-2">KALANARA</h1>
          <p className="text-muted-foreground text-sm">Staff Portal</p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className={cn(
            "bg-card rounded-2xl p-8 shadow-2xl",
            isMounted ? "animate-scale-in" : "opacity-0"
          )}
          style={{ animationDelay: "150ms" }}
        >
          <h2 className="font-sans font-semibold text-2xl text-foreground mb-6 text-center">
            Sign In
          </h2>

          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Email */}
            <div className={cn(
              isMounted ? "animate-fade-slide-up" : "opacity-0"
            )} style={{ animationDelay: "250ms" }}>
              <label className="block text-muted-foreground text-sm mb-2">
                Email Address
              </label>
              <div className="relative">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="pl-10"
                  required
                  disabled={isSubmitting}
                  autoComplete="email"
                />
                <Mail
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
              </div>
            </div>

            {/* Password */}
            <div className={cn(
              isMounted ? "animate-fade-slide-up" : "opacity-0"
            )} style={{ animationDelay: "325ms" }}>
              <label className="block text-muted-foreground text-sm mb-2">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pl-10 pr-10"
                  required
                  disabled={isSubmitting}
                  autoComplete="current-password"
                />
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "w-full mt-8 bg-primary hover:bg-primary/90 text-primary-foreground py-3 btn-hover-lift",
              isMounted ? "animate-fade-slide-up" : "opacity-0"
            )}
            style={{ animationDelay: "400ms" }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
