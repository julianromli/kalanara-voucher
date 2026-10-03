"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { AdminListPagination } from "@/components/admin/admin-list-pagination";
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminPageBody,
  AdminPageIntro,
  AdminSurface,
} from "@/components/admin/admin-page";
import { useAuth } from "@/context/AuthContext";
import { useAdminListUrl } from "@/hooks/use-admin-list-url";
import type { AdminBuyer } from "@/lib/actions/buyers";
import type { AdminPage } from "@/lib/actions/admin-pagination";
import { buyerPath, formatBuyerPhone } from "@/lib/admin/buyer-phone";
import { Input } from "@/components/ui/input";

interface BuyersClientProps {
  initialPage: AdminPage<AdminBuyer>;
}

function formatBuyerDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function BuyerCard({ buyer }: { buyer: AdminBuyer }) {
  return (
    <Link
      href={buyerPath(buyer.phone)}
      className="block rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{buyer.customerName}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatBuyerPhone(buyer.phone)}
          </p>
          <p className="truncate text-sm text-muted-foreground">{buyer.customerEmail}</p>
        </div>
        <p className="shrink-0 text-sm text-muted-foreground">
          {formatBuyerDate(buyer.lastOrderAt)}
        </p>
      </div>
      <div className="mt-4 flex gap-4 text-sm">
        <span className="text-foreground">{buyer.orderCount} pembelian</span>
        <span className="text-muted-foreground">{buyer.voucherCount} voucher</span>
      </div>
    </Link>
  );
}

export function BuyersClient({ initialPage }: BuyersClientProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { query: searchQuery, setQuery: setSearchQuery, setPage } = useAdminListUrl({
    filterParam: "status",
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [authLoading, isAuthenticated, router]);

  if (!isAuthenticated && !authLoading) {
    return null;
  }

  const buyers = initialPage.rows;

  return (
    <>
      <DashboardHeader title="Pembeli" showActions={false} />
      <AdminPageBody>
        <AdminPageIntro description="Satu orang per nomor WhatsApp. Nama yang tampil mengikuti pembelian terakhir." />
        <AdminSurface>
          <AdminFilterBar>
            <div className="relative flex-1">
              <label htmlFor="buyer-search" className="sr-only">
                Cari pembeli
              </label>
              <HugeiconsIcon
                icon={Search01Icon}
                size={18}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="buyer-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cari nama, WhatsApp, email, atau kode voucher"
                className="h-11 pl-10"
              />
            </div>
          </AdminFilterBar>
        </AdminSurface>

        {buyers.length === 0 ? (
          <AdminSurface padded={false}>
            <AdminEmptyState
              icon={<HugeiconsIcon icon={UserGroupIcon} size={22} />}
              title="Tidak ada pembeli"
              description={
                searchQuery
                  ? "Coba kata lain. Pencarian memakai nama, WhatsApp, email, atau kode voucher."
                  : "Pembeli muncul setelah ada pembelian."
              }
            />
          </AdminSurface>
        ) : (
          <AdminSurface padded={false}>
            <div className="space-y-3 p-4 md:hidden">
              {buyers.map((buyer) => (
                <BuyerCard key={buyer.phone} buyer={buyer} />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">Nama</th>
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">WhatsApp</th>
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">Pembelian</th>
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">Voucher</th>
                    <th className="p-4 text-left text-sm font-medium text-muted-foreground">Terakhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {buyers.map((buyer) => (
                    <tr key={buyer.phone} className="transition-colors hover:bg-muted/30">
                      <td className="p-4">
                        <Link href={buyerPath(buyer.phone)} className="font-medium text-foreground hover:underline">
                          {buyer.customerName}
                        </Link>
                        <p className="text-xs text-muted-foreground">{buyer.customerEmail}</p>
                      </td>
                      <td className="p-4 text-sm text-foreground">{formatBuyerPhone(buyer.phone)}</td>
                      <td className="p-4 text-sm tabular-nums">{buyer.orderCount}</td>
                      <td className="p-4 text-sm tabular-nums">{buyer.voucherCount}</td>
                      <td className="p-4 text-sm text-muted-foreground">{formatBuyerDate(buyer.lastOrderAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminListPagination
              itemLabel="pembeli"
              page={initialPage.page}
              totalCount={initialPage.totalCount}
              totalPages={initialPage.totalPages}
              onPageChange={setPage}
            />
          </AdminSurface>
        )}
      </AdminPageBody>
    </>
  );
}
