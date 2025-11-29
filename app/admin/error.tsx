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
    <div className="min-h-screen bg-sand-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-sans font-semibold text-sage-900">
              Admin Error
            </h1>
            <p className="text-sage-600">
              An error occurred in the admin section. This could be due to a
              connection issue or temporary server problem.
            </p>
          </div>

          {error.digest && (
            <p className="text-xs text-sage-400 font-mono">
              Error ID: {error.digest}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-sage-800 text-white rounded-full hover:bg-sage-700 transition-colors"
            >
              <RefreshCw size={18} />
              Retry
            </button>
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-sage-300 text-sage-700 rounded-full hover:bg-sage-50 transition-colors"
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
