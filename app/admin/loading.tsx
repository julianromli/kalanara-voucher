import { Skeleton } from "@/components/ui/skeleton";

function StatCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-32" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="size-12 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function ChartCardSkeleton() {
  return (
    <div className="relative rounded-xl border border-border bg-card p-6 h-[400px]">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-7 w-28 rounded-md" />
      </div>
      <div className="mb-4 flex items-center justify-center gap-4">
        <div className="flex items-center gap-1.5">
          <Skeleton className="size-3 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-[280px] w-full rounded-lg" />
    </div>
  );
}

function RecentOrdersSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card h-[400px] flex flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-4">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-7 w-[180px] rounded-md" />
      </div>
      <div className="px-4 pb-4 space-y-2 flex-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-lg border border-border bg-sidebar px-3 py-2"
          >
            <div className="flex items-center justify-between h-full gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-4 w-20 ml-auto" />
                <Skeleton className="h-3 w-14 ml-auto" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VoucherSummarySkeleton() {
  return (
    <div className="space-y-6">
      {/* Voucher Stats */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-5 w-8" />
            </div>
          ))}
        </div>
      </div>

      {/* Recent Reviews */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border-l-2 border-border pl-3 space-y-1">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="size-3 rounded" />
                ))}
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border bg-card/50">
      <div className="space-y-1">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  );
}

export default function AdminLoading() {
  return (
    <>
      <DashboardHeaderSkeleton />
      <div className="w-full overflow-y-auto overflow-x-hidden p-4 md:p-6 h-full">
        <div className="mx-auto w-full space-y-6">
          {/* Stats Grid - 4 cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCardSkeleton />
            <RecentOrdersSkeleton />
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {/* Quick Stats - 4 smaller cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <StatCardSkeleton key={i} />
                ))}
              </div>
            </div>
            <VoucherSummarySkeleton />
          </div>
        </div>
      </div>
    </>
  );
}
