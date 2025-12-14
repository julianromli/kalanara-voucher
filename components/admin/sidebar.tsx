"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  DashboardSquare01Icon,
  SparklesIcon,
  Ticket01Icon,
  Settings02Icon,
  HelpCircleIcon,
  Logout01Icon,
  Leaf01Icon,
  ShoppingBag01Icon,
  StarIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  {
    icon: DashboardSquare01Icon,
    label: "Dashboard",
    href: "/admin/dashboard",
  },
  {
    icon: SparklesIcon,
    label: "Services",
    href: "/admin/services",
  },
  {
    icon: ShoppingBag01Icon,
    label: "Purchases",
    href: "/admin/purchases",
  },
  {
    icon: StarIcon,
    label: "Reviews",
    href: "/admin/reviews",
  },
  {
    icon: Ticket01Icon,
    label: "Vouchers",
    href: "/admin/vouchers",
  },
  {
    icon: UserGroupIcon,
    label: "Users",
    href: "/admin/users",
  },
];

export function AdminSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push("/admin/login");
  };

  return (
    <Sidebar className="lg:border-r-0!" collapsible="offcanvas" {...props}>
      <SidebarHeader className="pb-0">
        <div className="px-2 py-3">
          <div className={cn(
            "flex items-center justify-between",
            isMounted ? "animate-fade-slide-down" : "opacity-0"
          )}>
            <Link href="/admin/dashboard" className="flex items-center gap-2">
              <div className="size-8 bg-gradient-to-br from-sage-500 to-sage-700 rounded-lg shadow flex items-center justify-center text-white">
                <HugeiconsIcon icon={Leaf01Icon} size={20} />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm">Kalanara Spa</span>
                <span className="text-xs text-muted-foreground">Admin Panel</span>
              </div>
            </Link>
          </div>

          <div className="mt-4 relative">
            <HugeiconsIcon icon={Search01Icon} size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
            <Input
              type="search"
              placeholder="Search..."
              className="pl-8 pr-12 h-8 text-sm text-muted-foreground placeholder:text-muted-foreground bg-background"
            />
            <div className="flex items-center gap-0.5 rounded border border-border bg-sidebar px-1.5 py-0.5 shrink-0 absolute right-2 top-1/2 -translate-y-1/2">
              <span className="text-[10px] font-medium text-muted-foreground leading-none">
                ⌘
              </span>
              <Kbd className="h-auto min-w-0 px-0 py-0 text-[10px] leading-none bg-transparent border-0">
                K
              </Kbd>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item, index) => {
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem 
                    key={item.href}
                    className={cn(
                      isMounted ? "animate-slide-in-left" : "opacity-0"
                    )}
                    style={{ animationDelay: `${150 + index * 50}ms` }}
                  >
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="h-9 text-sm nav-item-hover"
                    >
                      <Link href={item.href}>
                        <HugeiconsIcon icon={item.icon} size={16} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="h-9 text-sm">
                  <Link href="/admin/settings">
                    <HugeiconsIcon icon={Settings02Icon} size={16} />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="h-9 text-sm">
                  <Link href="/admin/help">
                    <HugeiconsIcon icon={HelpCircleIcon} size={16} />
                    <span>Help Center</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div 
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-lg bg-muted/50 mb-3",
            isMounted ? "animate-fade-slide-up" : "opacity-0"
          )}
          style={{ animationDelay: "400ms" }}
        >
          <div className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
            {user?.name?.charAt(0).toUpperCase() || "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || "Admin"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email || "admin@kalanara.com"}</p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className={cn(
            "w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30",
            isMounted ? "animate-fade-slide-up" : "opacity-0"
          )}
          style={{ animationDelay: "450ms" }}
        >
          <HugeiconsIcon icon={Logout01Icon} size={16} />
          Logout
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
