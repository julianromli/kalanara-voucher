"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mail01Icon,
  ViewIcon,
  ViewOffIcon,
  Loading03Icon,
  Leaf01Icon,
} from "@hugeicons/core-free-icons";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { AdminLoginSkeleton } from "@/components/admin/admin-skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

function getLoginNotice(authError: string | null) {

  switch (authError) {
    case "invite_invalid":
      return "Link undangan sudah tidak valid atau sudah kedaluwarsa. Minta super admin mengirim ulang undangan.";
    case "no_admin_access":
      return "Akun ini tidak lagi memiliki akses admin. Hubungi super admin untuk bantuan.";
    default:
      return "";
  }
}

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const notice = getLoginNotice(searchParams.get("error"));

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push("/admin/dashboard");
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading) {
    return <AdminLoginSkeleton />;
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
      showToast("Selamat datang kembali!", "success");
      router.push("/admin/dashboard");
    } else {
      setError(result.error || "Login gagal");
      showToast(result.error || "Login gagal", "error");
    }

    setIsSubmitting(false);
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Form */}
      <div className="flex items-center justify-center w-full lg:w-1/3 bg-background px-6 py-12 lg:px-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div>
            <div className="flex items-center gap-3 mb-12">
              <div className="size-10 bg-gradient-to-br from-sage-500 to-sage-700 rounded-xl shadow-lg flex items-center justify-center text-white">
                <HugeiconsIcon icon={Leaf01Icon} className="size-6" />
              </div>
              <div>
                <span className="font-semibold text-lg text-foreground">
                  Kalanara Spa
                </span>
                <p className="text-xs text-muted-foreground">Portal Admin</p>
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              Masuk ke dashboard admin
            </h1>
            <p className="text-base mt-3 text-muted-foreground text-balance">
              Gunakan akun admin aktif untuk mengelola voucher, pesanan, dan operasional spa.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="mt-10 space-y-5">
            <div
              className="rounded-lg border border-border bg-accent/30 px-4 py-3 text-sm text-muted-foreground"
            >
              Jika Anda menerima undangan admin baru, buka link pada email undangan terlebih dahulu untuk mengatur password.
            </div>

            {notice ? (
              <div
                className="rounded-lg bg-accent px-4 py-3 text-sm text-foreground"
              >
                {notice}
              </div>
            ) : null}

            {error && (
              <div
                className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm"
              >
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-muted-foreground mb-1.5"
              >
                 Email
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
                  placeholder="admin@kalanaraspa.com"
                  className="pl-10 h-10 bg-background border-border ring-1 ring-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-[border-color,box-shadow]"
                  required
                  disabled={isSubmitting}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
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
                  placeholder="Masukkan password"
                  className="h-10 pr-10 bg-background border-border ring-1 ring-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-[border-color,box-shadow]"
                  required
                  disabled={isSubmitting}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  disabled={isSubmitting}
                  aria-label="Tampilkan atau sembunyikan password"
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
              className="flex items-center gap-2"
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
                Ingat saya selama 30 hari
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 font-medium"
            >
              {isSubmitting ? (
                <>
                  <HugeiconsIcon icon={Loading03Icon} className="size-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                "Masuk"
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
        <div className="absolute inset-0 flex flex-col items-start justify-end p-10">
          <div className="max-w-lg">
            <p className="text-xl md:text-2xl lg:text-3xl font-semibold text-primary-foreground text-balance leading-snug">
              Kelola pengalaman tamu dengan sistem voucher yang rapi,
              cepat, dan mudah diawasi.
            </p>
            <p className="text-base mt-4 text-primary-foreground/80 text-balance">
              Kalanara Spa - operasional admin yang selaras dengan layanan premium.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
