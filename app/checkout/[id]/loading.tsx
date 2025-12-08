import { Skeleton } from "@/components/ui/skeleton";

export default function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-8">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-10 w-3/5 mx-auto" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {Array.from({ length: 4 }).map((_, sectionIndex) => (
              <div key={sectionIndex} className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <Skeleton className="h-5 w-36" />
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((__, rowIndex) => (
                    <div key={rowIndex} className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4 lg:col-span-1">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <Skeleton className="h-5 w-32" />
              <div className="flex gap-4">
                <Skeleton className="h-20 w-20 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
                <div className="flex justify-between border-t border-border pt-3">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
