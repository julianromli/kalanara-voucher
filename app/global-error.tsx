"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error("Global application error:", error);
  }, [error]);

  return (
    <html lang="id">
      <body className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-card rounded-2xl shadow-lg p-8 space-y-6">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-sans font-semibold text-foreground">
                Something went wrong
              </h1>
              <p className="text-muted-foreground">
                Terjadi gangguan tak terduga. Tim kami sudah bisa melacak error
                ini melalui monitoring.
              </p>
            </div>

            {error.digest && (
              <p className="text-xs text-muted-foreground font-mono">
                Error ID: {error.digest}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <RefreshCw size={18} />
                Coba Lagi
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border text-muted-foreground rounded-lg hover:bg-muted transition-colors"
              >
                <Home size={18} />
                Kembali ke Beranda
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
