import { Skeleton } from "@/components/ui/skeleton";

function SettingsSectionSkeleton() {
  return (
    <div className="bg-card rounded-2xl shadow-spa border border-border p-6 space-y-4">
      <Skeleton className="h-6 w-48" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

export default function AdminSettingsLoading() {
  return (
    <div className="w-full p-4 md:p-6 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SettingsSectionSkeleton />
        <SettingsSectionSkeleton />
        <SettingsSectionSkeleton />
        <SettingsSectionSkeleton />
      </div>
    </div>
  );
}
