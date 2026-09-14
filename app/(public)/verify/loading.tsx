import { Skeleton } from "@/components/ui/skeleton";

export default function VerifyLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted to-background">
      <div className="bg-primary py-16 px-4 text-center space-y-3">
        <Skeleton className="h-10 w-64 mx-auto" />
        <Skeleton className="h-4 w-80 mx-auto" />
      </div>

      <div className="max-w-xl mx-auto px-4 -mt-8">
        <div className="bg-card rounded-2xl shadow-spa-lg overflow-hidden border border-border">
          <div className="flex border-b border-border">
            <Skeleton className="h-12 w-1/2" />
            <Skeleton className="h-12 w-1/2" />
          </div>
          <div className="p-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <div className="flex gap-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-28" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-card rounded-2xl p-8 shadow-spa space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
