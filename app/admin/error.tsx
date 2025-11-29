"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin section error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-card rounded-2xl shadow-lg p-8 space-y-6">
          <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-warning" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-sans font-semibold text-foreground">
              Admin Error
            </h1>
            <p className="text-muted-foreground">
              An error occurred in the admin section. This could be due to a
              connection issue or temporary server problem.
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
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
            >
              <RefreshCw size={18} />
              Retry
            </button>
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border text-muted-foreground rounded-full hover:bg-accent transition-colors"
            >
              <LayoutDashboard size={18} />
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
