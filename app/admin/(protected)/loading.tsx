import { Skeleton } from "@/components/ui/skeleton";

export default function ProtectedAdminLoading() {
  return (
    <main className="flex h-full w-full flex-col overflow-hidden">
      <div className="border-b bg-background/95 px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-72 max-w-[70vw]" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-20" />
                </div>
                <Skeleton className="size-10 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        <div className="grid flex-1 gap-4 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-52" />
              </div>
              <Skeleton className="h-9 w-24" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 7 }, (_, index) => (
                <Skeleton key={index} className="h-11 w-full" />
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-5 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-44" />
            </div>
            <div className="space-y-4">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
