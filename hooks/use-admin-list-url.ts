"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface UseAdminListUrlOptions {
  filterParam: "status" | "rating";
}

export function useAdminListUrl({
  filterParam,
}: UseAdminListUrlOptions) {
  const { replace } = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceTimerRef = useRef<number | null>(null);
  const serializedSearchParams = searchParams.toString();
  const committedQuery = searchParams.get("query") ?? "";
  const filter = searchParams.get(filterParam) ?? "ALL";
  const [query, setQuery] = useState(committedQuery);

  useEffect(() => {
    setQuery(committedQuery);
  }, [committedQuery]);

  const replaceParams = useCallback(
    (update: (params: URLSearchParams) => void) => {
      const nextParams = new URLSearchParams(serializedSearchParams);
      update(nextParams);
      const serialized = nextParams.toString();
      replace(serialized ? `${pathname}?${serialized}` : pathname, {
        scroll: false,
      });
    },
    [pathname, replace, serializedSearchParams],
  );

  useEffect(() => {
    if (query === committedQuery) {
      return;
    }

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      replaceParams((params) => {
        if (query.trim()) {
          params.set("query", query.trim().slice(0, 100));
        } else {
          params.delete("query");
        }
        params.delete("page");
      });
    }, 300);

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [committedQuery, query, replaceParams]);

  const setFilter = (nextFilter: string) => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    replaceParams((params) => {
      const currentQuery = query.trim().slice(0, 100);
      if (currentQuery) {
        params.set("query", currentQuery);
      } else {
        params.delete("query");
      }
      if (nextFilter === "ALL") {
        params.delete(filterParam);
      } else {
        params.set(filterParam, nextFilter);
      }
      params.delete("page");
    });
  };

  const setPage = (page: number) => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    replaceParams((params) => {
      const currentQuery = query.trim().slice(0, 100);
      if (currentQuery) {
        params.set("query", currentQuery);
      } else {
        params.delete("query");
      }
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
    filter,
    setFilter,
    setPage,
  };
}
