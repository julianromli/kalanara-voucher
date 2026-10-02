import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { DiscountCheckoutLimitNotice } from "@/components/admin/discount-checkout-limit-notice";

describe("DiscountCheckoutLimitNotice", () => {
  test("tells admins that a zero total is free and a remainder must be at least Rp 10.000", () => {
    render(<DiscountCheckoutLimitNotice />);

    expect(screen.getByText("Batas sisa pembayaran")).toBeInTheDocument();
    expect(screen.getByText(/minimal Rp 10\.000/)).toBeInTheDocument();
    expect(screen.getByText(/Rp 1 sampai Rp 9\.999/)).toBeInTheDocument();
    expect(screen.getByText(/pesanan gratis/)).toBeInTheDocument();
  });
});
