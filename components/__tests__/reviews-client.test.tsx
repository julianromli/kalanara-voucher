import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ReviewsClient } from "@/components/admin/reviews-client";
import { ToastProvider } from "@/context/ToastContext";
import { deleteReview } from "@/lib/actions/reviews";
import type { ReviewAdminListRow } from "@/lib/actions/reviews";
import type { AdminPage } from "@/lib/actions/admin-pagination";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh }),
  usePathname: () => "/admin/reviews",
  useSearchParams: () => new URLSearchParams("page=2&query=awal&rating=5"),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock("@/components/admin/dashboard-header", () => ({
  DashboardHeader: () => <div data-testid="dashboard-header" />,
}));

vi.mock("@/lib/actions/reviews", () => ({
  deleteReview: vi.fn(),
}));

const review: ReviewAdminListRow = {
  id: "review-1",
  rating: 5,
  comment: "Sangat nyaman",
  customer_name: "Ayu",
};

const initialPage: AdminPage<ReviewAdminListRow> = {
  rows: [review],
  page: 2,
  pageSize: 25,
  totalCount: 26,
  totalPages: 2,
};

function renderComponent() {
  return render(
    <ToastProvider>
      <ReviewsClient initialPage={initialPage} initialQuery="awal" initialFilter="5" />
    </ToastProvider>,
  );
}

describe("ReviewsClient pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("debounces URL-owned search for 300ms, resets page, and preserves scroll", () => {
    vi.useFakeTimers();
    renderComponent();

    fireEvent.change(screen.getByPlaceholderText("Search reviews..."), {
      target: { value: "ayu spa" },
    });

    expect(replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(299));
    expect(replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));

    expect(replace).toHaveBeenCalledWith(
      "/admin/reviews?query=ayu+spa&rating=5",
      { scroll: false },
    );
  });

  test("filter changes immediately and include the current typed query before debounce", () => {
    vi.useFakeTimers();
    renderComponent();

    fireEvent.change(screen.getByPlaceholderText("Search reviews..."), {
      target: { value: "query terbaru" },
    });
    const ratingFilter = screen.getByRole("combobox");
    fireEvent.change(ratingFilter, { target: { value: "4" } });

    expect(ratingFilter).toHaveValue("4");
    expect(replace).toHaveBeenCalledWith(
      "/admin/reviews?query=query+terbaru&rating=4",
      { scroll: false },
    );
  });

  test("renders only supplied rows, shows count/page controls, and refreshes after mutation", async () => {
    vi.mocked(deleteReview).mockResolvedValue(true);
    renderComponent();

    expect(screen.getByText("Ayu")).toBeInTheDocument();
    expect(screen.getByText("26 ulasan")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Navigasi halaman ulasan" }),
    ).toBeInTheDocument();
    expect(screen.getByText("26 ulasan")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Halaman 2 dari 2")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("button", { name: "Sebelumnya" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Berikutnya" }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteReview).toHaveBeenCalledWith("review-1");
      expect(refresh).toHaveBeenCalled();
    });
  });
});
