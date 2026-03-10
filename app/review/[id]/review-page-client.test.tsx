import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ToastProvider } from "@/context/ToastContext";
import { ReviewPageClient } from "@/app/review/[id]/review-page-client";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
  }),
}));

describe("ReviewPageClient", () => {
  test("submits review data for a server-provided voucher", async () => {
    const submitReview = vi
      .fn()
      .mockResolvedValue({ success: true, error: undefined });

    render(
      <ToastProvider>
        <ReviewPageClient
          voucher={{
            id: "voucher-1",
            code: "KSP-2026-ABCDEFGH",
            recipientName: "Faiz",
            expiryDate: "2026-12-31T00:00:00.000Z",
            isRedeemed: false,
            amount: 450000,
            service: {
              name: "Relaxing Massage",
              duration: 90,
              image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=200&q=80",
            },
          }}
          submitReview={submitReview}
        />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /beri rating 1 bintang/i }));
    fireEvent.change(screen.getByPlaceholderText("How should we call you?"), {
      target: { value: "Faiz" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("What did you enjoy most about your experience?"),
      {
        target: { value: "Great treatment" },
      }
    );
    fireEvent.click(screen.getByRole("button", { name: /Submit Review/i }));

    await waitFor(() => {
      expect(submitReview).toHaveBeenCalledWith({
        rating: 1,
        comment: "Great treatment",
        customerName: "Faiz",
      });
    });

    expect(await screen.findByText("Thank You!")).toBeInTheDocument();
  });

  test("shows an error toast when submitReview rejects", async () => {
    const submitReview = vi.fn().mockRejectedValue(new Error("network failure"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ToastProvider>
        <ReviewPageClient
          voucher={{
            id: "voucher-1",
            code: "KSP-2026-ABCDEFGH",
            recipientName: "Faiz",
            expiryDate: "2026-12-31T00:00:00.000Z",
            isRedeemed: false,
            amount: 450000,
            service: {
              name: "Relaxing Massage",
              duration: 90,
              image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=200&q=80",
            },
          }}
          submitReview={submitReview}
        />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /beri rating 1 bintang/i }));
    fireEvent.click(screen.getByRole("button", { name: /Submit Review/i }));

    expect(
      await screen.findByText("Gagal mengirim review. Silakan coba lagi.")
    ).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
