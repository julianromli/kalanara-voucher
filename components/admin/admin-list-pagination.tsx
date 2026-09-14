"use client";

import { Button } from "@/components/ui/button";

interface AdminListPaginationProps {
  itemLabel: string;
  page: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function AdminListPagination({
  itemLabel,
  page,
  totalCount,
  totalPages,
  onPageChange,
}: AdminListPaginationProps) {
  return (
    <nav
      aria-label={`Navigasi halaman ${itemLabel}`}
      className="flex flex-col gap-3 border-t border-border px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-muted-foreground" aria-live="polite">
        {totalCount} {itemLabel}
      </p>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Sebelumnya
        </Button>
        <span
          aria-current="page"
          className="min-w-24 text-center text-muted-foreground"
        >
          Halaman {page} dari {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </nav>
  );
}
