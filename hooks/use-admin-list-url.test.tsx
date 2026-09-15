import { act, fireEvent, render, screen } from "@testing-library/react";
import { useAdminListUrl } from "@/hooks/use-admin-list-url";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => "/admin/purchases",
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

function HookProbe() {
  const { query, setQuery, filter, setFilter, setPage } = useAdminListUrl({
    filterParam: "status",
  });

  return (
    <>
      <input
        aria-label="Query"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <select
        aria-label="Status"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      >
        <option value="ALL">All</option>
        <option value="PENDING">Pending</option>
      </select>
      <button type="button" onClick={() => setPage(2)}>
        Page 2
      </button>
    </>
  );
}

describe("useAdminListUrl", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.replace.mockReset();
    mocks.search = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses committed URL values for the query and filter", () => {
    mocks.search = "query=pelanggan+lama&status=PENDING&page=2";
    const { rerender } = render(<HookProbe />);

    expect(screen.getByLabelText("Query")).toHaveValue("pelanggan lama");
    expect(screen.getByLabelText("Status")).toHaveValue("PENDING");

    mocks.search = "query=pelanggan+baru";
    rerender(<HookProbe />);

    expect(screen.getByLabelText("Query")).toHaveValue("pelanggan baru");
    expect(screen.getByLabelText("Status")).toHaveValue("ALL");
  });

  it("flushes a pending query into pagination and cancels its page-reset debounce", () => {
    render(<HookProbe />);

    fireEvent.change(screen.getByLabelText("Query"), {
      target: { value: "  pelanggan baru  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));

    expect(mocks.replace).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenLastCalledWith(
      "/admin/purchases?query=pelanggan+baru&page=2",
      { scroll: false }
    );

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(mocks.replace).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Query")).toHaveValue("  pelanggan baru  ");
  });

  it("commits a filter with the pending query but renders the URL-owned filter", () => {
    const { rerender } = render(<HookProbe />);

    fireEvent.change(screen.getByLabelText("Query"), {
      target: { value: " pelanggan baru " },
    });
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "PENDING" },
    });

    expect(mocks.replace).toHaveBeenLastCalledWith(
      "/admin/purchases?query=pelanggan+baru&status=PENDING",
      { scroll: false }
    );
    expect(screen.getByLabelText("Status")).toHaveValue("ALL");

    mocks.search = "query=pelanggan+baru&status=PENDING";
    rerender(<HookProbe />);
    expect(screen.getByLabelText("Status")).toHaveValue("PENDING");
  });

  it("cancels a stale query debounce when the committed URL changes", () => {
    const { rerender } = render(<HookProbe />);

    fireEvent.change(screen.getByLabelText("Query"), {
      target: { value: "akan dibatalkan" },
    });

    mocks.search = "query=pelanggan+lama";
    rerender(<HookProbe />);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Query")).toHaveValue("pelanggan lama");
  });
});
