import { Skeleton } from "@/components/ui/skeleton";

export default function ReviewLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted to-background py-12">
      <div className="max-w-xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-3">
          <Skeleton className="h-10 w-64 mx-auto" />
          <Skeleton className="h-4 w-72 mx-auto" />
        </div>

        <div className="bg-card p-4 rounded-xl flex gap-4 items-center border border-border">
          <Skeleton className="h-16 w-16 rounded-lg" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>

        <div className="bg-card p-8 rounded-2xl shadow-spa space-y-8">
          <div className="space-y-2 text-center">
            <Skeleton className="h-5 w-48 mx-auto" />
            <Skeleton className="h-4 w-32 mx-auto" />
          </div>
          <div className="flex justify-center gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-10 rounded-full" />
            ))}
          </div>

          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full" />
          </div>

          <div className="space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-28 w-full" />
          </div>

          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
