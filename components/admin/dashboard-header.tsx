"use client";

import { Download, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

interface DashboardHeaderProps {
  title?: string;
  showActions?: boolean;
}

export function DashboardHeader({ title, showActions = true }: DashboardHeaderProps) {
  const { user } = useAuth();

  return (
    <div className="w-full sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-3 py-2.5 sm:px-4 sm:py-3 md:px-6">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <SidebarTrigger className="shrink-0" />
        <h1 className="text-base sm:text-xl md:text-2xl font-medium text-foreground truncate">
          {title || `Welcome back, ${user?.name?.split(" ")[0] || "Admin"} 👋`}
        </h1>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
        {showActions && (
          <div className="hidden lg:flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link href="/verify">
                <ScanLine className="size-4" />
                <span className="hidden xl:inline">Scan QR</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="size-4" />
              <span className="hidden xl:inline">Export</span>
            </Button>
          </div>
        )}
        <ThemeToggle />
      </div>
    </div>
  );
}
