"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminListPaginationProps {
  itemLabel: string;
  page: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  pageSize?: number;
  className?: string;
}

export function AdminListPagination({
  itemLabel,
  page,
  totalCount,
  totalPages,
  onPageChange,
  disabled = false,
  pageSize,
  className,
}: AdminListPaginationProps) {
  const rangeLabel =
    pageSize && totalCount > 0
      ? `Menampilkan ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalCount)} dari ${totalCount} ${itemLabel}`
      : `${totalCount} ${itemLabel}`;

  return (
    <nav
      aria-label={`Navigasi halaman ${itemLabel}`}
      className={cn(
        "flex flex-col gap-3 border-t border-border px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-muted-foreground tabular-nums" aria-live="polite">
        {rangeLabel}
      </p>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Sebelumnya
        </Button>
        <span
          aria-current="page"
          className="min-w-24 text-center text-muted-foreground tabular-nums"
        >
          Halaman {page} dari {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </nav>
  );
}
