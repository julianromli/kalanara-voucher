"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface UseAdminListUrlOptions {
  initialQuery: string;
  initialFilter: string;
  filterParam: "status" | "rating";
}

export function useAdminListUrl({
  initialQuery,
  initialFilter,
  filterParam,
}: UseAdminListUrlOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);

  const replaceParams = (update: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    update(nextParams);
    const serialized = nextParams.toString();
    router.replace(serialized ? `${pathname}?${serialized}` : pathname, {
      scroll: false,
    });
  };

  useEffect(() => {
    if (query === initialQuery) {
      return;
    }

    const timer = window.setTimeout(() => {
      replaceParams((params) => {
        if (query.trim()) {
          params.set("query", query.trim().slice(0, 100));
        } else {
          params.delete("query");
        }
        params.delete("page");
      });
    }, 300);

    return () => window.clearTimeout(timer);
    // searchParams is intentionally represented by its serialized value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, pathname, query, router, searchParams.toString()]);

  const setFilter = (filter: string) => {
    replaceParams((params) => {
      if (filter === "ALL") {
        params.delete(filterParam);
      } else {
        params.set(filterParam, filter);
      }
      params.delete("page");
    });
  };

  const setPage = (page: number) => {
    replaceParams((params) => {
      if (page <= 1) {
        params.delete("page");
      } else {
        params.set("page", String(page));
      }
    });
  };

  return {
    query,
    setQuery,
    filter: initialFilter,
    setFilter,
    setPage,
  };
}
