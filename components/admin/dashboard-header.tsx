"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { QrCode01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

interface DashboardHeaderProps {
  title?: string;
  showActions?: boolean;
}

export function DashboardHeader({
  title,
  showActions = true,
}: DashboardHeaderProps) {
  const { user } = useAuth();
  const heading = title || `Welcome back, ${user?.name?.split(" ")[0] || "Admin"}`;

  return (
    <header className="sticky top-0 z-10 flex w-full items-center justify-between border-b border-border bg-background px-3 py-2.5 sm:px-4 sm:py-3 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <SidebarTrigger className="shrink-0" />
        <h1 className="truncate text-base font-medium tracking-tight text-foreground text-wrap-balance sm:text-xl md:text-2xl">
          {heading}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {showActions ? (
          <Button
            variant="outline"
            size="sm"
            className="hidden gap-2 lg:inline-flex"
            asChild
          >
            <Link href="/verify">
              <HugeiconsIcon icon={QrCode01Icon} className="size-4" />
              <span className="hidden xl:inline">Scan QR</span>
            </Link>
          </Button>
        ) : null}
        <ThemeToggle />
      </div>
    </header>
  );
}
