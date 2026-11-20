"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/admin/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";

interface AdminShellProps {
  children: ReactNode;
  followUpCount?: number;
}

export function AdminShell({ children, followUpCount = 0 }: AdminShellProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [authLoading, isAuthenticated, router]);

  if (!isAuthenticated && !authLoading) {
    return null;
  }

  return (
    <SidebarProvider className="bg-sidebar">
      <AdminSidebar followUpCount={followUpCount} />
      <div className="h-svh w-full overflow-hidden lg:p-2">
        <div className="flex h-full w-full flex-col items-center justify-start overflow-hidden bg-background lg:rounded-xl lg:border">
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}
