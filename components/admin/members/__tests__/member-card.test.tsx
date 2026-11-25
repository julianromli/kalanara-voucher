import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { MemberCard } from "@/components/admin/members/member-card";
import type { MemberSummary } from "@/lib/membership/summary";

function summary(): MemberSummary {
  return {
    id: "11111111-1111-4111-8111-111111111111",
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

const actions = {
  onSendLink: vi.fn(),
  onCopyLink: vi.fn(),
  onRotateLink: vi.fn(),
  onEdit: vi.fn(),
};

describe("MemberCard edit and audit", () => {
  test("shows Edit data and the audit list for Manager+", () => {
    render(
      <MemberCard
        summary={summary()}
        canManageSettings
        auditStatus="ok"
        auditRows={[
          {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            field: "name",
            oldValue: "Rina",
            newValue: "Rina Maharani",
            changedByEmail: "manager@kalanaraspa.com",
            changedByRole: "MANAGER",
            createdAt: "2026-11-25T03:00:00Z",
          },
        ]}
        {...actions}
      />,
    );

    expect(screen.getByRole("button", { name: "Edit data" })).toBeInTheDocument();
    expect(screen.getByText("Riwayat perubahan")).toBeInTheDocument();
    expect(screen.getByText(/Nama: Rina → Rina Maharani/)).toBeInTheDocument();
  });

  test("hides Edit data and the audit list for Staff", () => {
    render(
      <MemberCard
        summary={summary()}
        canManageSettings={false}
        auditRows={[
          {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            field: "phone",
            oldValue: "6281234564471",
            newValue: "6282212347221",
            changedByEmail: null,
            changedByRole: null,
            createdAt: "2026-11-25T03:00:00Z",
          },
        ]}
        {...actions}
      />,
    );

    expect(screen.queryByRole("button", { name: "Edit data" })).not.toBeInTheDocument();
    expect(screen.queryByText("Riwayat perubahan")).not.toBeInTheDocument();
  });

  test("shows labeled facts and a WhatsApp action when consent is on", () => {
    render(
      <MemberCard
        summary={summary()}
        canManageSettings={false}
        {...actions}
      />,
    );

    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("Member sejak")).toBeInTheDocument();
    expect(screen.getByText("12 Mar 2026")).toBeInTheDocument();
    expect(screen.getByText("Periode reset")).toBeInTheDocument();
    expect(screen.getByText("12 Mar 2027")).toBeInTheDocument();
    expect(screen.getByText("Belum ada kunjungan")).toBeInTheDocument();
    expect(screen.getByText("4 stamp")).toBeInTheDocument();
    const wa = screen.getByRole("link", { name: "Buka WhatsApp" });
    expect(wa).toHaveAttribute("href", expect.stringContaining("https://wa.me/6281234564471?text="));
  });

  test("hides the WhatsApp action when consent is off", () => {
    render(
      <MemberCard
        summary={{ ...summary(), waConsent: false }}
        canManageSettings={false}
        {...actions}
      />,
    );
    expect(screen.queryByRole("link", { name: "Buka WhatsApp" })).not.toBeInTheDocument();
  });
});
