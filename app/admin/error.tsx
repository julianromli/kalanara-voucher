"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert01Icon, RefreshIcon, DashboardSquare01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error("Admin section error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="space-y-6 rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-warning/10">
            <HugeiconsIcon icon={Alert01Icon} className="size-8 text-warning" />
          </div>

          <div className="space-y-2">
            <h1 className="font-sans text-2xl font-semibold text-foreground">
              Admin Error
            </h1>
            <p className="text-pretty text-muted-foreground">
              An error occurred in the admin section. This could be due to a
              connection issue or temporary server problem.
            </p>
          </div>

          {error.digest ? (
            <p className="font-mono text-xs text-muted-foreground">
              Error ID: {error.digest}
            </p>
          ) : null}

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button onClick={reset} className="gap-2">
              <HugeiconsIcon icon={RefreshIcon} size={18} />
              Retry
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/dashboard" className="gap-2">
                <HugeiconsIcon icon={DashboardSquare01Icon} size={18} />
                Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
