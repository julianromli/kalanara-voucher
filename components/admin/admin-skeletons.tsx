import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPageBody, AdminSurface } from "@/components/admin/admin-page";
import { cn } from "@/lib/utils";

interface AdminLoadingRegionProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function AdminLoadingRegion({
  label,
  children,
  className,
}: AdminLoadingRegionProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={className}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function AdminHeaderSkeleton({
  showActions = false,
}: {
  showActions?: boolean;
}) {
  return (
    <div className="sticky top-0 z-10 flex w-full items-center justify-between border-b border-border bg-background px-3 py-2.5 sm:px-4 sm:py-3 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Skeleton className="size-8 shrink-0 rounded-lg" />
        <Skeleton className="h-6 w-40 sm:h-7 sm:w-56" />
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {showActions ? (
          <div className="hidden items-center gap-3 lg:flex">
            <Skeleton className="h-8 w-[92px] rounded-lg" />
            <Skeleton className="h-8 w-[88px] rounded-lg" />
          </div>
        ) : null}
        <Skeleton className="size-8 rounded-lg" />
      </div>
    </div>
  );
}

export function AdminStatCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="admin-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className={cn("h-8 w-28", compact && "h-7 w-16")} />
        </div>
        <div className="flex flex-col items-end gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="size-12 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function AdminTableRowSkeleton({ columns }: { columns: number }) {
  return (
    <div className="grid items-center gap-4 border-b border-border px-4 py-3.5 last:border-b-0"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: columns }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn(
            "h-4 w-24",
            index === columns - 1 && "ml-auto w-16",
            index === 0 && "w-28",
          )}
        />
      ))}
    </div>
  );
}

export function AdminTablePageSkeleton({
  columns = 6,
  rows = 6,
  showStats = false,
  showIntroAction = false,
  label = "Memuat halaman admin",
}: {
  columns?: number;
  rows?: number;
  showStats?: boolean;
  showIntroAction?: boolean;
  label?: string;
}) {
  return (
    <AdminLoadingRegion label={label}>
      <AdminHeaderSkeleton />
      <AdminPageBody>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-64 max-w-[70vw]" />
            <Skeleton className="h-4 w-48 max-w-[60vw]" />
          </div>
          {showIntroAction ? <Skeleton className="h-10 w-36 rounded-lg" /> : null}
        </div>

        {showStats ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="admin-surface p-4">
                <Skeleton className="mb-2 h-4 w-16" />
                <Skeleton className="h-7 w-12" />
              </div>
            ))}
          </div>
        ) : null}

        <AdminSurface padded={false}>
          <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:p-5">
            <Skeleton className="h-9 w-full md:flex-1" />
            <Skeleton className="h-9 w-full md:w-44" />
          </div>
          <div className="border-b border-border bg-muted/40 px-4 py-3">
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: columns }).map((_, index) => (
                <Skeleton key={index} className="h-3.5 w-16" />
              ))}
            </div>
          </div>
          {Array.from({ length: rows }).map((_, index) => (
            <AdminTableRowSkeleton key={index} columns={columns} />
          ))}
          <div className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-4 w-28" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          </div>
        </AdminSurface>
      </AdminPageBody>
    </AdminLoadingRegion>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <AdminLoadingRegion label="Memuat dasbor">
      <AdminHeaderSkeleton showActions />
      <AdminPageBody>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <AdminStatCardSkeleton key={index} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="admin-surface flex h-[400px] flex-col p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-7 w-28 rounded-md" />
            </div>
            <div className="mb-4 flex justify-center">
              <div className="flex items-center gap-1.5">
                <Skeleton className="size-3 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="min-h-0 flex-1 w-full rounded-lg" />
          </div>

          <div className="admin-surface flex h-[400px] flex-col">
            <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-7 w-[180px] rounded-md" />
            </div>
            <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="flex h-14 items-center justify-between gap-3 rounded-lg border border-border bg-sidebar px-3"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-8 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <div className="space-y-1.5 text-right">
                    <Skeleton className="ml-auto h-3.5 w-20" />
                    <Skeleton className="ml-auto h-3 w-14" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:col-span-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <AdminStatCardSkeleton key={index} compact />
            ))}
          </div>
          <div className="space-y-6">
            <div className="admin-surface p-5">
              <div className="mb-4 flex items-center gap-2">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-4 rounded" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-5 w-8" />
                  </div>
                ))}
              </div>
            </div>
            <div className="admin-surface p-5">
              <div className="mb-4 flex items-center gap-2">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="space-y-1.5 border-l-2 border-border pl-3">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, starIndex) => (
                        <Skeleton key={starIndex} className="size-3 rounded" />
                      ))}
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AdminPageBody>
    </AdminLoadingRegion>
  );
}

export function AdminServicesSkeleton() {
  return (
    <AdminLoadingRegion label="Memuat layanan">
      <AdminHeaderSkeleton />
      <AdminPageBody>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72 max-w-[70vw]" />
          </div>
          <Skeleton className="h-11 w-full rounded-lg sm:w-40" />
        </div>

        <AdminSurface>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3.5 w-48" />
              </div>
            </div>
            <Skeleton className="size-9 rounded-lg" />
          </div>
        </AdminSurface>

        <AdminSurface>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
            <div className="space-y-2 lg:w-[240px]">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
            <Skeleton className="h-4 w-36 lg:mb-3" />
          </div>
        </AdminSurface>

        <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="admin-surface overflow-hidden">
              <Skeleton className="h-44 w-full rounded-none sm:h-40" />
              <div className="space-y-3 p-4 sm:p-5">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center justify-between pt-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
                  <Skeleton className="h-11 w-full rounded-lg" />
                  <Skeleton className="h-11 w-full rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </AdminPageBody>
    </AdminLoadingRegion>
  );
}

export function AdminReviewsSkeleton() {
  return (
    <AdminLoadingRegion label="Memuat ulasan">
      <AdminHeaderSkeleton />
      <AdminPageBody>
        <Skeleton className="h-4 w-64" />
        <AdminSurface>
          <div className="mb-6 flex flex-col gap-3 md:flex-row">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-full md:w-40" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-border p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Skeleton className="h-5 w-28" />
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, starIndex) => (
                      <Skeleton key={starIndex} className="size-4 rounded" />
                    ))}
                  </div>
                </div>
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="mb-4 h-4 w-3/4" />
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <Skeleton className="h-5 w-12 rounded-full" />
                  <Skeleton className="h-8 w-16 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </AdminSurface>
      </AdminPageBody>
    </AdminLoadingRegion>
  );
}

export function AdminSettingsSkeleton() {
  return (
    <AdminLoadingRegion label="Memuat pengaturan">
      <AdminHeaderSkeleton />
      <AdminPageBody>
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
          <div className="flex gap-1 border-b border-border">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="mb-px h-9 w-28 rounded-none" />
            ))}
          </div>
          <div className="admin-surface p-6">
            <Skeleton className="mb-6 h-5 w-40" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
          </div>
        </div>
      </AdminPageBody>
    </AdminLoadingRegion>
  );
}

export function AdminHelpSkeleton() {
  return (
    <AdminLoadingRegion label="Memuat bantuan">
      <AdminHeaderSkeleton />
      <AdminPageBody>
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <div className="space-y-3 text-center">
            <Skeleton className="mx-auto h-8 w-56" />
            <Skeleton className="mx-auto h-4 w-80 max-w-[80vw]" />
            <Skeleton className="mx-auto h-9 w-full max-w-md" />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="admin-surface p-6">
                  <Skeleton className="mb-5 h-5 w-40" />
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-64" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-52" />
                      <Skeleton className="h-4 w-5/6" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-6">
              <div className="admin-surface p-6">
                <Skeleton className="mb-4 h-5 w-16" />
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="mb-2 h-10 w-full rounded-lg" />
                ))}
              </div>
              <div className="admin-surface p-6">
                <Skeleton className="mb-3 h-5 w-36" />
                <Skeleton className="mb-4 h-4 w-full" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </AdminPageBody>
    </AdminLoadingRegion>
  );
}

export function AdminCrmSkeleton() {
  return (
    <AdminLoadingRegion label="Memuat CRM">
      <AdminHeaderSkeleton />
      <AdminPageBody>
        <Skeleton className="h-4 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="admin-surface p-6">
              <Skeleton className="mb-2 h-5 w-40" />
              <Skeleton className="mb-5 h-4 w-56" />
              <Skeleton className="mb-3 h-9 w-full" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <div className="admin-surface p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-52" />
            </div>
            <Skeleton className="h-8 w-36 rounded-lg" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-4"
              >
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-full" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="size-9 rounded-lg" />
                  <Skeleton className="size-9 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </AdminPageBody>
    </AdminLoadingRegion>
  );
}

export function AdminPageChromeSkeleton() {
  return (
    <>
      <AdminHeaderSkeleton />
      <AdminPageBody>
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72 max-w-[70vw]" />
        </div>
        <AdminSurface padded={false}>
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        </AdminSurface>
      </AdminPageBody>
    </>
  );
}

export function AdminFallbackSkeleton() {
  return (
    <AdminLoadingRegion label="Memuat halaman admin">
      <AdminPageChromeSkeleton />
    </AdminLoadingRegion>
  );
}

export function AdminLoginSkeleton() {
  return (
    <AdminLoadingRegion
      label="Memuat halaman masuk"
      className="flex min-h-screen"
    >
      <div className="flex w-full items-center justify-center bg-background px-6 py-12 lg:w-1/3 lg:px-8">
        <div className="w-full max-w-md">
          <div className="mb-12 flex items-center gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-4/5" />
          <div className="mt-10 space-y-5">
            <Skeleton className="h-14 w-full rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-primary lg:block lg:w-2/3">
        <div className="absolute inset-0 flex flex-col items-start justify-end p-10">
          <Skeleton className="h-8 w-3/4 bg-primary-foreground/20" />
          <Skeleton className="mt-3 h-8 w-2/3 bg-primary-foreground/20" />
          <Skeleton className="mt-4 h-4 w-1/2 bg-primary-foreground/15" />
        </div>
      </div>
    </AdminLoadingRegion>
  );
}

export function AdminShellBootstrapSkeleton() {
  return (
    <AdminLoadingRegion
      label="Memuat panel admin"
      className="flex h-svh bg-sidebar"
    >
      <div className="hidden w-64 shrink-0 flex-col p-4 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2 py-3">
          <Skeleton className="size-8 rounded-lg" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="mb-6 h-8 w-full rounded-md" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full rounded-md" />
          ))}
        </div>
        <div className="mt-auto space-y-3">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
      </div>
      <div className="h-full min-w-0 flex-1 overflow-hidden lg:p-2">
        <div className="flex h-full flex-col overflow-hidden bg-background lg:rounded-xl lg:border">
          <AdminPageChromeSkeleton />
        </div>
      </div>
    </AdminLoadingRegion>
  );
}
