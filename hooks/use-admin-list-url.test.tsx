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
    initialQuery: "",
    initialFilter: "ALL",
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
    mocks.replace.mockImplementation((url: string) => {
      mocks.search = url.split("?")[1] ?? "";
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("preserves a local filter change when pagination happens before navigation settles", () => {
    render(<HookProbe />);

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "PENDING" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));

    expect(mocks.replace).toHaveBeenLastCalledWith(
      "/admin/purchases?status=PENDING&page=2",
      { scroll: false }
    );
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
});
