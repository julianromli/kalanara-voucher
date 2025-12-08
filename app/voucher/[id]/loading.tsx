import { Skeleton } from "@/components/ui/skeleton";

export default function VoucherLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-12 space-y-10">
        <Skeleton className="h-6 w-24" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <Skeleton className="h-[400px] lg:h-[500px] w-full rounded-2xl" />

          <div className="space-y-6">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-12 w-3/4" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-spa">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-4 w-2/3 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
