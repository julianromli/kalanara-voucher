import { Skeleton } from "@/components/ui/skeleton";

export function CheckoutLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background px-4 pb-28 pt-8 md:pb-8">
      <div className="mx-auto max-w-6xl">
        <Skeleton className="mb-8 h-6 w-24" />
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <Skeleton className="mx-auto h-9 w-64" />
          <Skeleton className="mx-auto h-5 w-full max-w-md" />
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            {[0, 1, 2].map((item) => (
              <section
                key={item}
                className="space-y-4 rounded-2xl border border-border bg-card p-6"
              >
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </section>
            ))}
          </div>
          <aside className="h-fit space-y-5 rounded-2xl border border-border bg-card p-6">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-14 w-full" />
          </aside>
        </div>
        <p className="sr-only">Sedang menyiapkan metode pembayaran.</p>
      </div>
    </div>
  );
}

export default CheckoutLoadingSkeleton;
