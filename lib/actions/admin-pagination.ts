export const ADMIN_PAGE_SIZE = 25;
export const ADMIN_QUERY_MAX_LENGTH = 100;

export interface AdminListParams {
  page: number;
  query: string;
  filter: string;
}

export interface AdminPage<T> {
  rows: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

interface RawAdminListParams {
  page?: string;
  query?: string;
  filter?: string;
}

export function normalizeAdminListParams(
  input: RawAdminListParams,
  allowedFilters: readonly string[] = ["ALL"],
): AdminListParams {
  const parsedPage = Number.parseInt(input.page ?? "1", 10);
  const requestedFilter = (input.filter ?? "ALL").trim().toUpperCase();

  return {
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    query: (input.query ?? "").trim().slice(0, ADMIN_QUERY_MAX_LENGTH),
    filter: allowedFilters.includes(requestedFilter) ? requestedFilter : "ALL",
  };
}

export function escapePostgrestLike(value: string) {
  return value.replace(/[\\%_,()"]/g, "\\$&");
}

export function buildAdminPage<T>(
  rows: T[],
  requestedPage: number,
  totalCount: number,
): AdminPage<T> {
  const totalPages = Math.max(1, Math.ceil(totalCount / ADMIN_PAGE_SIZE));

  return {
    rows,
    page: Math.min(Math.max(1, requestedPage), totalPages),
    pageSize: ADMIN_PAGE_SIZE,
    totalCount,
    totalPages,
  };
}
