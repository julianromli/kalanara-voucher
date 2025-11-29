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
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-16 flex-col border-r border-sage-200/60 bg-white/80 backdrop-blur-sm">
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-sage-200/60">
          <Link href="/admin/dashboard" className="group">
            <div className="flex size-10 items-center justify-center rounded-xl bg-sage-800 text-sand-100 transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-sage-800/20">
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
                        ? "bg-sage-100 text-sage-800 shadow-sm"
                        : "text-sage-500 hover:bg-sage-50 hover:text-sage-700"
                    )}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <span className="absolute -left-2 h-6 w-1 rounded-full bg-sage-600" />
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
                  className="border-sage-200 bg-sage-900 px-3 py-1.5 text-sm font-medium text-sand-100"
                >
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-sage-200/60 p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className="group flex size-11 w-full items-center justify-center rounded-xl text-sage-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="size-5 transition-transform duration-200 group-hover:scale-110" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="border-red-200 bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
            >
              Logout
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
