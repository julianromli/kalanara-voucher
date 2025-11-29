"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Sparkles, Ticket, LogOut, Leaf } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    href: "/admin/dashboard",
  },
  {
    icon: Sparkles,
    label: "Services",
    href: "/admin/services",
  },
  {
    icon: Ticket,
    label: "Vouchers",
    href: "/admin/vouchers",
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push("/admin/login");
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-16 flex-col border-r border-sidebar-border/60 bg-sidebar/80 backdrop-blur-sm">
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-sidebar-border/60">
          <Link href="/admin/dashboard" className="group">
            <div className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-primary/20">
              <Leaf className="size-5" />
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col items-center gap-2 px-2 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "group relative flex size-11 items-center justify-center rounded-xl transition-all duration-200",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <span className="absolute -left-2 h-6 w-1 rounded-full bg-sidebar-primary" />
                    )}
                    <item.icon
                      className={cn(
                        "size-5 transition-transform duration-200",
                        !isActive && "group-hover:scale-110"
                      )}
                    />
                  </Link>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="border-border bg-popover px-3 py-1.5 font-sans text-sm font-medium text-popover-foreground"
                >
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-sidebar-border/60 p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className="group flex size-11 w-full items-center justify-center rounded-xl text-sidebar-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="size-5 transition-transform duration-200 group-hover:scale-110" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="border-destructive/20 bg-destructive px-3 py-1.5 font-sans text-sm font-medium text-destructive-foreground"
            >
              Logout
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
