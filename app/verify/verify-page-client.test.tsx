import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { VerifyPageClient } from "@/app/verify/verify-page-client";

vi.mock("@/components/qr-scanner", () => ({
  default: () => <div>QR Scanner Mock</div>,
}));

describe("VerifyPageClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("uses the initial code prop to fetch voucher details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          found: true,
          voucher: {
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
          },
        }),
      })
    );

    render(<VerifyPageClient initialCode="ksp-2026-abcdefgh" />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/vouchers/public-lookup?code=KSP-2026-ABCDEFGH",
        { cache: "no-store" }
      );
    });

    expect(await screen.findByText("Relaxing Massage")).toBeInTheDocument();
    expect(screen.getByText("Faiz")).toBeInTheDocument();
  });
});
