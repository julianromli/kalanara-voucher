"use client";

import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <SidebarProvider className="bg-sidebar">
        <AdminSidebar />
        <div className="h-svh overflow-hidden lg:p-2 w-full">
          <div className="lg:border lg:rounded-xl overflow-hidden flex flex-col items-center justify-start bg-background h-full w-full">
            {children}
          </div>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
}
