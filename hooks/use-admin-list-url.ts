"use client";

import { useEffect, useRef, useState } from "react";
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
  const [filter, setLocalFilter] = useState(initialFilter);
  const queryRef = useRef(initialQuery);
  const filterRef = useRef(initialFilter);
  const hasLocalQueryEditRef = useRef(false);
  const hasLocalFilterEditRef = useRef(false);
  const debounceTimerRef = useRef<number | null>(null);
  const serializedSearchParams = searchParams.toString();
  const urlParamsStringRef = useRef(serializedSearchParams);

  useEffect(() => {
    const settledParams = new URLSearchParams(serializedSearchParams);
    urlParamsStringRef.current = serializedSearchParams;
    if (!hasLocalQueryEditRef.current) {
      queryRef.current = settledParams.get("query") ?? "";
    }
    if (!hasLocalFilterEditRef.current) {
      filterRef.current = settledParams.get(filterParam) ?? "ALL";
    }
  }, [filterParam, serializedSearchParams]);

  const replaceParams = (update: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(urlParamsStringRef.current);
    update(nextParams);
    const serialized = nextParams.toString();
    urlParamsStringRef.current = serialized;
    router.replace(serialized ? `${pathname}?${serialized}` : pathname, {
      scroll: false,
    });
  };

  useEffect(() => {
    if (query === initialQuery) {
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
    // searchParams is intentionally represented by its serialized value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, pathname, query, router, serializedSearchParams]);

  const setQueryValue = (nextQuery: string) => {
    hasLocalQueryEditRef.current = true;
    queryRef.current = nextQuery;
    setQuery(nextQuery);
  };

  const setFilter = (nextFilter: string) => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    hasLocalFilterEditRef.current = true;
    filterRef.current = nextFilter;
    setLocalFilter(nextFilter);
    replaceParams((params) => {
      const queryToPreserve = queryRef.current;
      const currentQuery = queryToPreserve.trim().slice(0, 100);
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
      const currentQuery = queryRef.current.trim().slice(0, 100);
      if (currentQuery) {
        params.set("query", currentQuery);
      } else {
        params.delete("query");
      }
      if (filterRef.current === "ALL") {
        params.delete(filterParam);
      } else {
        params.set(filterParam, filterRef.current);
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
    setQuery: setQueryValue,
    filter,
    setFilter,
    setPage,
  };
}
