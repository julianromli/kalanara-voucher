import { Skeleton } from "@/components/ui/skeleton";

function ServiceCardSkeleton({ delay }: { delay?: string }) {
  return (
    <div
      className="bg-card rounded-2xl shadow-spa border border-border overflow-hidden"
      style={delay ? { animationDelay: delay } : undefined}
    >
      <Skeleton className="h-40 w-full" />
      <div className="p-5 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function AdminServicesLoading() {
  return (
    <div className="w-full p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>

      <div className="bg-card rounded-2xl shadow-spa border border-border p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <Skeleton className="h-10 w-full md:w-1/2" />
          <Skeleton className="h-10 w-full md:w-48" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <ServiceCardSkeleton key={i} delay={`${100 + i * 50}ms`} />
        ))}
      </div>
    </div>
  );
}
