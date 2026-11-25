export const SUPABASE_PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  build: () => {
    order: (
      column: string,
      options: { ascending: boolean },
    ) => {
      range: (
        from: number,
        to: number,
      ) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>;
    };
  },
): Promise<{ data: T[]; error: { message?: string } | null }> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await build()
      .order("id", { ascending: true })
      .range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) return { data: [], error };
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < SUPABASE_PAGE_SIZE) return { data: rows, error: null };
    from += SUPABASE_PAGE_SIZE;
  }
}
