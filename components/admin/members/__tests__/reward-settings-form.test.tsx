import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/actions/members", () => ({ saveRewards: vi.fn() }));
vi.mock("@/context/ToastContext", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { RewardSettingsForm } from "@/components/admin/members/reward-settings-form";

const emptyRows = [5, 10, 15, 20, 25, 30].map((milestone) => ({
  milestone,
  name: "",
  note: "",
  updatedAt: "2026-11-18T03:00:00Z",
  reachedCount: 0,
}));

describe("RewardSettingsForm empty state", () => {
  test("opens empty fields and focuses the 5-stamp name without prefilling", () => {
    render(<RewardSettingsForm initialRows={emptyRows} loadError={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Isi reward 5 stamp" }));
    const field = screen.getByLabelText("Nama reward 5 stamp");
    expect(field).toHaveValue("");
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute("placeholder", "Contoh: Totok gratis");
    expect(screen.getByText("Semua tersimpan")).toBeInTheDocument();
  });

  test("counts every changed row", () => {
    render(<RewardSettingsForm initialRows={emptyRows} loadError={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Isi reward 5 stamp" }));
    fireEvent.change(screen.getByLabelText("Nama reward 5 stamp"), { target: { value: "Totok" } });
    fireEvent.change(screen.getByLabelText("Nama reward 10 stamp"), { target: { value: "Facial" } });
    expect(screen.getByText("2 perubahan belum disimpan")).toBeInTheDocument();
  });
});
