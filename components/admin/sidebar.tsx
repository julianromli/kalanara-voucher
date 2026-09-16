"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Tag01Icon,
  UserGroupIcon,
  Megaphone01Icon,
} from "@hugeicons/core-free-icons";
import { AdminPermission } from "@/lib/auth/admin-rbac";
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
    requiredPermission: AdminPermission.DASHBOARD_VIEW_OPERATIONAL,
  },
  {
    icon: SparklesIcon,
    label: "Services",
    href: "/admin/services",
    requiredPermission: AdminPermission.SERVICES_MANAGE,
  },
  {
    icon: ShoppingBag01Icon,
    label: "Purchases",
    href: "/admin/purchases",
    requiredPermission: AdminPermission.ORDERS_VIEW,
  },
  {
    icon: Tag01Icon,
    label: "Promo Codes",
    href: "/admin/discount-codes",
    requiredPermission: AdminPermission.DISCOUNT_CODES_MANAGE,
  },
  {
    icon: StarIcon,
    label: "Reviews",
    href: "/admin/reviews",
    requiredPermission: AdminPermission.REVIEWS_MANAGE,
  },
  {
    icon: Megaphone01Icon,
    label: "CRM",
    href: "/admin/crm",
    requiredPermission: AdminPermission.CRM_MANAGE,
  },
  {
    icon: Ticket01Icon,
    label: "Vouchers",
    href: "/admin/vouchers",
    requiredPermission: AdminPermission.VOUCHERS_MANAGE,
  },
  {
    icon: UserGroupIcon,
    label: "Users",
    href: "/admin/users",
    requiredPermission: AdminPermission.USERS_MANAGE,
  },
];

export function AdminSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const router = useRouter();
  const { hasPermission, logout, user } = useAuth();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [navQuery, setNavQuery] = useState("");
  const [optimisticActiveRoute, setOptimisticActiveRoute] = useState<{
    href: string;
    sourcePathname: string;
  } | null>(null);
  const activeHref =
    optimisticActiveRoute?.sourcePathname === pathname
      ? optimisticActiveRoute.href
      : pathname;
  const visibleNavItems = navItems.filter((item) =>
    hasPermission(item.requiredPermission),
  );
  const filteredNavItems = useMemo(() => {
    const query = navQuery.trim().toLowerCase();
    if (!query) {
      return visibleNavItems;
    }

    return visibleNavItems.filter((item) =>
      item.label.toLowerCase().includes(query),
    );
  }, [navQuery, visibleNavItems]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const activateRouteOptimistically = (href: string) => {
    setOptimisticActiveRoute({ href, sourcePathname: pathname });
  };

  const handleLogout = async () => {
    await logout();
    router.push("/admin/login");
  };

  return (
    <Sidebar className="lg:border-r-0!" collapsible="offcanvas" {...props}>
      <SidebarHeader className="pb-0">
        <div className="px-2 py-3">
          <div className="flex items-center justify-between">
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => activateRouteOptimistically("/admin/dashboard")}
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-sage-500 to-sage-700 text-white shadow-sm">
                <HugeiconsIcon icon={Leaf01Icon} size={18} />
              </div>
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="text-sm font-semibold text-sidebar-foreground">
                  Kalanara Spa
                </span>
                <span className="text-xs text-muted-foreground">Admin Panel</span>
              </div>
            </Link>
          </div>

          <div className="relative mt-4">
            <label htmlFor="admin-nav-search" className="sr-only">
              Search navigation
            </label>
            <HugeiconsIcon
              icon={Search01Icon}
              size={16}
              className="pointer-events-none absolute top-1/2 left-2.5 z-10 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              ref={searchInputRef}
              id="admin-nav-search"
              type="search"
              value={navQuery}
              onChange={(event) => setNavQuery(event.target.value)}
              placeholder="Search pages..."
              className="h-8 bg-background pr-12 pl-8 text-sm placeholder:text-muted-foreground"
            />
            <div className="pointer-events-none absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-sidebar px-1.5 py-0.5">
              <span className="text-[10px] leading-none font-medium text-muted-foreground">
                ⌘
              </span>
              <Kbd className="h-auto min-w-0 border-0 bg-transparent px-0 py-0 text-[10px] leading-none">
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
              {filteredNavItems.length === 0 ? (
                <p className="px-2 py-2 text-xs text-muted-foreground">
                  No matching pages
                </p>
              ) : (
                filteredNavItems.map((item) => {
                  const isActive = activeHref === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="h-9 text-sm"
                      >
                        <Link
                          href={item.href}
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => activateRouteOptimistically(item.href)}
                        >
                          <HugeiconsIcon icon={item.icon} size={16} />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {hasPermission(AdminPermission.SETTINGS_MANAGE_SENSITIVE) && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={activeHref === "/admin/settings"}
                    className="h-9 text-sm"
                  >
                    <Link
                      href="/admin/settings"
                      aria-current={
                        activeHref === "/admin/settings" ? "page" : undefined
                      }
                      onClick={() =>
                        activateRouteOptimistically("/admin/settings")
                      }
                    >
                      <HugeiconsIcon icon={Settings02Icon} size={16} />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={activeHref === "/admin/help"}
                  className="h-9 text-sm"
                >
                  <Link
                    href="/admin/help"
                    aria-current={
                      activeHref === "/admin/help" ? "page" : undefined
                    }
                    onClick={() => activateRouteOptimistically("/admin/help")}
                  >
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
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-muted/50 px-2 py-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
            {user?.name?.charAt(0).toUpperCase() || "A"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name || "Admin"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user?.email || "admin@kalanara.com"}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <HugeiconsIcon icon={Logout01Icon} size={16} />
          Logout
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
