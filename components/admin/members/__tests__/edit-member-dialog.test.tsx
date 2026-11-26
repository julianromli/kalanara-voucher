import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = MockResizeObserver as unknown as typeof window.ResizeObserver;
import type { MemberSummary } from "@/lib/membership/summary";

const { updateMember } = vi.hoisted(() => ({
  updateMember: vi.fn(),
}));

vi.mock("@/lib/actions/members", () => ({
  updateMember,
}));

import { EditMemberDialog } from "@/components/admin/members/edit-member-dialog";

const MEMBER_ID = "11111111-1111-4111-8111-111111111111";

function summary(): MemberSummary {
  return {
    id: MEMBER_ID,
    name: "Rina Maharani",
    phone: "6281234564471",
    birthDate: "1994-03-12",
    waConsent: true,
    memberCode: "7KQ2X9",
    source: "cashier",
    createdAt: "2026-03-12T03:00:00Z",
    cardToken: "a".repeat(48),
    stampCount: 4,
    baseTier: 0,
    effectiveTier: 0,
    cycleStart: "2026-03-12",
    rolledCycles: 0,
    tierBefore: null,
    resetOn: "2027-03-12",
    birthday: {
      eligible: false,
      redeemed: false,
      occurrence: "2027-03-12",
      windowStart: "2027-03-09",
      windowEnd: "2027-03-15",
      birthdayYear: 2027,
    },
    lastTreatment: null,
    rewards: [],
    stamps: [],
    claims: [],
    birthdayRedemptions: [],
  };
}

describe("EditMemberDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("fills the current data and warns that a birthday change moves the window", () => {
    render(
      <EditMemberDialog
        open
        summary={summary()}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Nama panggilan")).toHaveValue("Rina Maharani");
    expect(screen.getByLabelText("Nomor HP (WhatsApp)")).toHaveValue("6281234564471");
    expect(screen.getByLabelText("Tanggal lahir")).toHaveTextContent("12 Maret 1994");
    expect(screen.getByText(/jendela diskon ultah ikut pindah/)).toBeInTheDocument();
  });

  test("shows a duplicate phone error inline and keeps the dialog open", async () => {
    updateMember.mockResolvedValueOnce({
      status: "duplicate",
      message: "Nomor ini sudah dipakai member lain",
    });
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <EditMemberDialog
        open
        summary={summary()}
        onOpenChange={onOpenChange}
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nomor HP (WhatsApp)"), {
      target: { value: "082212347221" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nomor ini sudah dipakai member lain",
    );
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  test("saves and reports the updated summary", async () => {
    const next = { ...summary(), name: "Rina M" };
    updateMember.mockResolvedValueOnce({ status: "ok", summary: next });
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <EditMemberDialog
        open
        summary={summary()}
        onOpenChange={onOpenChange}
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nama panggilan"), {
      target: { value: "Rina M" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(next, MEMBER_ID));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(updateMember).toHaveBeenCalledWith({
      memberId: MEMBER_ID,
      name: "Rina M",
      phone: "6281234564471",
      birthDate: "1994-03-12",
      waConsent: true,
    });
  });
});
