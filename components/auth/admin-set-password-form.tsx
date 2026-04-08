"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/context/ToastContext";
import { createClient } from "@/lib/supabase/client";

interface AdminSetPasswordFormProps {
  email: string;
  name: string;
}

export function AdminSetPasswordForm({ email, name }: AdminSetPasswordFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validatePassword = () => {
    if (password.length < 8) {
      return "Password minimal 8 karakter.";
    }

    if (password !== confirmPassword) {
      return "Konfirmasi password harus sama.";
    }

    return "";
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = validatePassword();

    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message || "Gagal menyimpan password baru.");
        showToast(updateError.message || "Gagal menyimpan password baru.", "error");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        await supabase.auth.signOut();
        router.replace("/admin/login?error=invite_invalid");
        return;
      }

      const { data: admin } = await supabase
        .from("admins")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!admin) {
        await supabase.auth.signOut();
        router.replace("/admin/login?error=no_admin_access");
        return;
      }

      showToast("Password berhasil disimpan. Mengalihkan ke dashboard…", "success");
      router.replace("/admin/dashboard");
      router.refresh();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Terjadi kesalahan saat menyimpan password baru.";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-spa md:p-8">
      <div className="mb-6 space-y-2">
        <p className="text-sm font-medium text-primary">Undangan Admin</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Atur password untuk akun Anda
        </h1>
        <p className="text-sm text-muted-foreground">
          Halo {name}, buat password baru untuk melanjutkan ke dashboard admin.
        </p>
        <p className="text-xs text-muted-foreground">Login email: {email}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="new-password" className="mb-1 block text-sm font-medium">Password baru</label>
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            autoComplete="new-password"
            placeholder="Minimal 8 karakter…"
            required
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium">Konfirmasi password</label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            autoComplete="new-password"
            placeholder="Ulangi password baru…"
            required
            disabled={isSubmitting}
          />
        </div>

        {error ? (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Menyimpan…" : "Simpan password dan masuk"}
        </Button>
      </form>
    </div>
  );
}
