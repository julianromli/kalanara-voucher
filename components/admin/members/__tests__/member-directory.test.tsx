import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { MemberDirectory } from "@/components/admin/members/member-directory";
import { buildAdminPage } from "@/lib/actions/admin-pagination";
import type { MemberListRow } from "@/lib/membership/list";

function row(overrides: Partial<MemberListRow> = {}): MemberListRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Rina Maharani",
    phone: "6281234564471",
    effectiveTier: 1,
    stampCount: 9,
    lastVisitAt: "2026-11-20T04:00:00Z",
    createdAt: "2026-03-12T03:00:00Z",
    nextMilestone: 10,
    nextRewardName: "Treatment gratis",
    waConsent: true,
    ...overrides,
  };
}

const noop = {
  onQueryChange: vi.fn(),
  onTierChange: vi.fn(),
  onPageChange: vi.fn(),
  onSelect: vi.fn(),
};

describe("MemberDirectory", () => {
  test("treats a whitespace-only query as no filter in the empty state", () => {
    render(
      <MemberDirectory
        page={buildAdminPage([], 1, 0)}
        followUp={{ nearReward: [], frequent: [] }}
        query="   "
        tier="all"
        {...noop}
      />,
    );
    expect(screen.getByText("Belum ada member")).toBeInTheDocument();
    expect(screen.queryByText("Tidak ada member")).not.toBeInTheDocument();
  });

  test("shows why a member is ready to follow up, with last visit and a WhatsApp action", () => {
    render(
      <MemberDirectory
        page={buildAdminPage([row()], 1, 1)}
        followUp={{ nearReward: [row()], frequent: [] }}
        query=""
        tier="all"
        {...noop}
      />,
    );

    expect(screen.getByText("Siap follow up")).toBeInTheDocument();
    expect(screen.getAllByText("1 orang").length).toBeGreaterThan(0);
    expect(screen.getByText("1 stamp lagi buat Treatment gratis")).toBeInTheDocument();
    expect(screen.getByText(/Terakhir 20 Nov 2026/)).toBeInTheDocument();
    expect(screen.getAllByText(/9 stamp/).length).toBeGreaterThan(0);

    const wa = screen.getByRole("link", { name: "Buka WhatsApp Rina Maharani" });
    expect(wa).toHaveAttribute("href", expect.stringContaining("https://wa.me/6281234564471?text="));
    expect(decodeURIComponent(wa.getAttribute("href") ?? "")).toContain(
      "tinggal 1 stamp lagi buat Treatment gratis",
    );
  });

  test("hides the WhatsApp action when WhatsApp consent is off", () => {
    const declined = row({ waConsent: false });
    render(
      <MemberDirectory
        page={buildAdminPage([declined], 1, 1)}
        followUp={{ nearReward: [declined], frequent: [] }}
        query=""
        tier="all"
        {...noop}
      />,
    );
    expect(screen.getByText("1 stamp lagi buat Treatment gratis")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Buka WhatsApp/ })).not.toBeInTheDocument();
  });

  test("hides the WhatsApp action when the phone cannot be opened in WhatsApp", () => {
    const invalid = row({ phone: "081234564471" });
    render(
      <MemberDirectory
        page={buildAdminPage([invalid], 1, 1)}
        followUp={{ nearReward: [invalid], frequent: [] }}
        query=""
        tier="all"
        {...noop}
      />,
    );
    expect(screen.getByText("1 stamp lagi buat Treatment gratis")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Buka WhatsApp/ })).not.toBeInTheDocument();
  });

  test("hides follow-up when a search or level filter is on", () => {
    render(
      <MemberDirectory
        page={buildAdminPage([row()], 1, 1)}
        followUp={{ nearReward: [row()], frequent: [] }}
        query="rina"
        tier="all"
        {...noop}
      />,
    );
    expect(screen.queryByText("Siap follow up")).not.toBeInTheDocument();
  });

  test("shows a loading state instead of a blank list", () => {
    render(
      <MemberDirectory
        page={buildAdminPage([], 1, 0)}
        followUp={{ nearReward: [], frequent: [] }}
        query=""
        tier="all"
        loading
        {...noop}
      />,
    );
    expect(screen.getByRole("status", { name: "Memuat daftar member" })).toBeInTheDocument();
    expect(screen.getByText("Memuat daftar member…")).toBeInTheDocument();
  });

  test("shows the visible range and page number", () => {
    const rows = Array.from({ length: 25 }, (_, index) =>
      row({
        id: `11111111-1111-4111-8111-${String(index + 26).padStart(12, "0")}`,
        name: `Member ${index + 26}`,
      }),
    );
    render(
      <MemberDirectory
        page={{
          rows,
          page: 2,
          pageSize: 25,
          totalCount: 1001,
          totalPages: 41,
        }}
        followUp={{ nearReward: [], frequent: [] }}
        query=""
        tier="all"
        {...noop}
      />,
    );
    expect(screen.getByText("Menampilkan 26–50 dari 1001 member")).toBeInTheDocument();
    expect(screen.getByText("Halaman 2 dari 41")).toBeInTheDocument();
  });
});
