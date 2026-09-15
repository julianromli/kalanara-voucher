export const ADMIN_PAGE_SIZE = 25;
export const ADMIN_QUERY_MAX_LENGTH = 100;
export const ADMIN_MAX_PAGE = 10_000;

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

export interface AdminPageRangeResult<T> {
  data: T[] | null;
  count: number | null;
  error: unknown | null;
}

interface FetchBoundedAdminPageOptions<T> {
  requestedPage: number;
  fetchRange: (
    from: number,
    to: number,
  ) => PromiseLike<AdminPageRangeResult<T>>;
}

interface RawAdminListParams {
  page?: string | string[];
  query?: string | string[];
  filter?: string | string[];
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeAdminListParams(
  input: RawAdminListParams,
  allowedFilters: readonly string[] = ["ALL"],
): AdminListParams {
  const parsedPage = Number.parseInt(firstParam(input.page) ?? "1", 10);
  const requestedFilter = (firstParam(input.filter) ?? "ALL")
    .trim()
    .toUpperCase();
  const page =
    Number.isFinite(parsedPage) && parsedPage > 0
      ? Math.min(parsedPage, ADMIN_MAX_PAGE)
      : 1;

  return {
    page,
    query: (firstParam(input.query) ?? "")
      .trim()
      .slice(0, ADMIN_QUERY_MAX_LENGTH),
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
  const totalPages = Math.min(
    ADMIN_MAX_PAGE,
    Math.max(1, Math.ceil(totalCount / ADMIN_PAGE_SIZE)),
  );

  return {
    rows,
    page: Math.min(Math.max(1, requestedPage), totalPages),
    pageSize: ADMIN_PAGE_SIZE,
    totalCount,
    totalPages,
  };
}

export async function fetchBoundedAdminPage<T>({
  requestedPage,
  fetchRange,
}: FetchBoundedAdminPageOptions<T>): Promise<AdminPage<T>> {
  const fetchPage = (page: number) => {
    const from = (page - 1) * ADMIN_PAGE_SIZE;
    return fetchRange(from, from + ADMIN_PAGE_SIZE - 1);
  };

  const firstResult = await fetchPage(requestedPage);
  if (firstResult.error) {
    throw firstResult.error;
  }

  const firstPage = buildAdminPage(
    firstResult.data ?? [],
    requestedPage,
    firstResult.count ?? 0,
  );
  if (firstPage.page === requestedPage || firstPage.totalCount === 0) {
    return firstPage;
  }

  const correctedResult = await fetchPage(firstPage.page);
  if (correctedResult.error) {
    throw correctedResult.error;
  }

  return buildAdminPage(
    correctedResult.data ?? [],
    firstPage.page,
    correctedResult.count ?? firstPage.totalCount,
  );
}
