import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { MemberSummary } from "@/lib/membership/summary";

const { actions, routerPush, hasPermission } = vi.hoisted(() => ({
  actions: {
    addStamp: vi.fn(),
    findMember: vi.fn(),
    getMember: vi.fn(),
    getMemberWaLink: vi.fn(),
    listRecentMembers: vi.fn(),
    listMembers: vi.fn(),
    searchMembers: vi.fn(),
    redeemBirthday: vi.fn(),
    rotateCardToken: vi.fn(),
    voidClaim: vi.fn(),
    voidStamp: vi.fn(),
    registerMember: vi.fn(),
    claimReward: vi.fn(),
  },
  routerPush: vi.fn(),
  hasPermission: vi.fn(() => true),
}));

vi.mock("@/lib/actions/members", () => actions);
vi.mock("@/lib/actions/buyers", () => ({
  getBuyerOrders: vi.fn().mockResolvedValue([]),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ hasPermission }),
}));
vi.mock("@/components/admin/dashboard-header", () => ({
  DashboardHeader: ({
    title,
    endSlot,
  }: {
    title: string;
    endSlot?: ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      {endSlot}
    </header>
  ),
}));

import { MembersClient } from "@/components/admin/members/members-client";
import { buildAdminPage } from "@/lib/actions/admin-pagination";
import type { MemberListRow } from "@/lib/membership/list";
import { ToastProvider } from "@/context/ToastContext";

const BRONZE_BANNER = /kebuka, dan Rina naik ke Bronze/;
const MEMBER_ID = "11111111-1111-4111-8111-111111111111";
const SERVICE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function listRow(overrides: Partial<MemberListRow> = {}): MemberListRow {
  return {
    id: MEMBER_ID,
    name: "Rina Maharani",
    phone: "6281234564471",
    effectiveTier: 0,
    stampCount: 4,
    lastVisitAt: "2026-11-20T04:00:00Z",
    createdAt: "2026-03-12T03:00:00Z",
    nextMilestone: 5,
    nextRewardName: "Totok gratis",
    ...overrides,
  };
}

function emptyListResult() {
  return {
    status: "ok" as const,
    page: buildAdminPage<MemberListRow>([], 1, 0),
    followUp: { nearReward: [] as MemberListRow[], frequent: [] as MemberListRow[] },
    milestones: [5, 10, 15, 20, 25, 30],
  };
}

function summary(count: number): MemberSummary {
  const tier = count >= 30 ? 3 : count >= 20 ? 2 : count >= 10 ? 1 : 0;
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
    stampCount: count,
    baseTier: 0,
    effectiveTier: tier,
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
    rewards: [5, 10, 15, 20, 25, 30].map((milestone) => ({
      milestone,
      name: milestone === 10 ? "Treatment gratis" : null,
      note: null,
      claimId: null,
      claimedName: null,
      claimedService: null,
      claimedAt: null,
      claimedByName: null,
    })),
    stamps: [],
    claims: [],
    birthdayRedemptions: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function stampResult(count: number, tierBefore: number, tierAfter: number, openedReward: string | null) {
  return {
    status: "ok",
    stampId: `99999999-9999-4999-8999-${String(count).padStart(12, "0")}`,
    count,
    serviceName: "Body Massage",
    tierBefore,
    tierAfter,
    openedReward,
    resetOn: "2027-03-12",
    createdAt: new Date().toISOString(),
  };
}

async function openRina(count: number) {
  actions.getMember.mockResolvedValueOnce({ status: "ok", summary: summary(count) });
  render(
    <ToastProvider>
      <MembersClient
        initialRecent={[
          {
            id: MEMBER_ID,
            name: "Rina Maharani",
            source: "cashier",
            created_at: "2026-03-12T03:00:00Z",
            stamp_count: count,
            last_stamp_at: null,
            last_stamp_service: null,
            last_claim_at: null,
            last_claim_name: null,
          },
        ]}
        services={[{ id: SERVICE_ID, name: "Body Massage", duration: 60 }]}
      />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Rina Maharani/ }));
  await waitFor(() => expect(shownCount()).toBe(String(count)));
}

function shownCount(): string {
  const figure = document.querySelector("p.text-4xl");
  return figure?.firstChild?.textContent?.trim() ?? "";
}

beforeEach(() => {
  vi.clearAllMocks();
  hasPermission.mockReturnValue(true);
  actions.listRecentMembers.mockResolvedValue({ status: "ok", members: [] });
  actions.listMembers.mockResolvedValue(emptyListResult());
  actions.searchMembers.mockResolvedValue({ status: "ok", members: [] });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(() => Promise.reject(new Error("denied"))) },
  });
});

describe("MembersClient stamp flow", () => {
  test("undo wins over the slower reload from the add (bug 1)", async () => {
    await openRina(9);
    expect(shownCount()).toBe("9");
    // Reward names keep the admin's casing.
    expect(screen.getByText("1 stamp lagi buat Treatment gratis")).toBeInTheDocument();

    const addReload = deferred<{ status: "ok"; summary: MemberSummary }>();
    actions.addStamp.mockResolvedValueOnce(stampResult(10, 0, 1, "Treatment gratis"));
    actions.getMember.mockReturnValueOnce(addReload.promise);
    actions.voidStamp.mockResolvedValueOnce({ status: "ok", memberId: MEMBER_ID });
    actions.getMember.mockResolvedValueOnce({ status: "ok", summary: summary(9) });

    fireEvent.click(screen.getByRole("button", { name: "Tambah stamp" }));
    const undo = await screen.findByRole("button", { name: "Batalkan" });
    fireEvent.click(undo);
    await waitFor(() => expect(actions.voidStamp).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(actions.getMember).toHaveBeenCalledTimes(3));
    expect(shownCount()).toBe("9");

    // The add's reload lands last with the pre-undo count. It must be ignored.
    await act(async () => {
      addReload.resolve({ status: "ok", summary: summary(10) });
      await addReload.promise;
    });
    expect(shownCount()).toBe("9");
  });

  test("the banner shows only the latest stamp's change (bug 2)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await openRina(9);

      actions.addStamp.mockResolvedValueOnce(stampResult(10, 0, 1, "Treatment gratis"));
      actions.getMember.mockResolvedValueOnce({ status: "ok", summary: summary(10) });
      fireEvent.click(screen.getByRole("button", { name: "Tambah stamp" }));
      expect(await screen.findByText(BRONZE_BANNER)).toBeInTheDocument();

      // "Udah dapat stamp hari ini" replaces the button for 6s.
      await act(async () => {
        vi.advanceTimersByTime(6100);
      });

      // A plain stamp clears the old tier-up banner.
      actions.addStamp.mockResolvedValueOnce(stampResult(11, 1, 1, null));
      actions.getMember.mockResolvedValueOnce({ status: "ok", summary: summary(11) });
      fireEvent.click(await screen.findByRole("button", { name: "Tambah stamp" }));
      await waitFor(() => expect(shownCount()).toBe("11"));
      expect(screen.queryByText(BRONZE_BANNER)).not.toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(6100);
      });

      // Reaching Gold with no reward set for 30 still names the new tier, not the old one.
      actions.addStamp.mockResolvedValueOnce(stampResult(30, 2, 3, null));
      actions.getMember.mockResolvedValueOnce({ status: "ok", summary: summary(30) });
      fireEvent.click(await screen.findByRole("button", { name: "Tambah stamp" }));
      expect(await screen.findByText("Rina naik ke Gold.")).toBeInTheDocument();
      expect(screen.queryByText(BRONZE_BANNER)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  test("undo clears the banner of the stamp it removes", async () => {
    await openRina(9);
    actions.addStamp.mockResolvedValueOnce(stampResult(10, 0, 1, "Treatment gratis"));
    actions.getMember.mockResolvedValueOnce({ status: "ok", summary: summary(10) });
    actions.voidStamp.mockResolvedValueOnce({ status: "ok", memberId: MEMBER_ID });
    actions.getMember.mockResolvedValueOnce({ status: "ok", summary: summary(9) });
    fireEvent.click(screen.getByRole("button", { name: "Tambah stamp" }));
    expect(await screen.findByText(BRONZE_BANNER)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Batalkan" }));
    await waitFor(() => expect(shownCount()).toBe("9"));
    expect(screen.queryByText(BRONZE_BANNER)).not.toBeInTheDocument();
  });

  test("shows the full phone on the member card, not a masked number", async () => {
    await openRina(9);
    expect(screen.getByText(/\+62 812 3456 4471/)).toBeInTheDocument();
    expect(screen.queryByText(/····/)).not.toBeInTheDocument();
  });

  test("puts Pengaturan member in the page header, not on the member card", async () => {
    const user = userEvent.setup();
    await openRina(9);
    await user.click(screen.getByRole("button", { name: "Pengaturan member" }));
    await user.click(await screen.findByRole("menuitem", { name: "Pengaturan member" }));
    expect(routerPush).toHaveBeenCalledWith("/admin/members/settings");
    await user.click(screen.getByRole("button", { name: "Menu member" }));
    expect(await screen.findByRole("menuitem", { name: "Kirim link kartu" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Pengaturan member" })).not.toBeInTheDocument();
  });
});

describe("MembersClient name search", () => {
  test("searching dinda calls searchMembers and does not show the QR rejected banner", async () => {
    actions.searchMembers.mockResolvedValue({
      status: "ok",
      members: [
        {
          id: MEMBER_ID,
          name: "Dinda Salsabilla",
          phone: "6282212347221",
          memberCode: "7KQ2X9",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Dinda Lestari",
          phone: "6281211112222",
          memberCode: "8LM3Y0",
        },
      ],
    });
    render(
      <ToastProvider>
        <MembersClient initialRecent={[]} services={[{ id: SERVICE_ID, name: "Body Massage", duration: 60 }]} />
      </ToastProvider>,
    );
    const input = screen.getByLabelText("Nama atau nomor HP member");
    fireEvent.change(input, { target: { value: "dinda" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByText("Dinda Salsabilla")).toBeInTheDocument();
    expect(actions.searchMembers).toHaveBeenCalledWith({ q: "dinda" });
    expect(actions.findMember).not.toHaveBeenCalled();
    expect(screen.queryByText("QR ini bukan kartu member Kalanara")).not.toBeInTheDocument();
    expect(screen.getByText("+62 822 1234 7221")).toBeInTheDocument();

    actions.getMember.mockResolvedValueOnce({ status: "ok", summary: { ...summary(4), name: "Dinda Salsabilla", phone: "6282212347221" } });
    fireEvent.click(screen.getByRole("button", { name: /Dinda Salsabilla/ }));
    expect(await screen.findByRole("heading", { name: "Dinda Salsabilla" })).toBeInTheDocument();
    expect(actions.getMember).toHaveBeenCalledWith(MEMBER_ID);
  });

  test("a phone lookup still uses findMember", async () => {
    actions.findMember.mockResolvedValue({ status: "not_found", scan: { kind: "phone", phone: "6281234567890" } });
    render(
      <ToastProvider>
        <MembersClient initialRecent={[]} services={[{ id: SERVICE_ID, name: "Body Massage", duration: 60 }]} />
      </ToastProvider>,
    );
    const input = screen.getByLabelText("Nama atau nomor HP member");
    fireEvent.change(input, { target: { value: "81234567890" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByText("Nomor ini belum terdaftar.")).toBeInTheDocument();
    expect(actions.findMember).toHaveBeenCalledWith({
      scan: "81234567890",
      origin: expect.any(String),
    });
    expect(actions.searchMembers).not.toHaveBeenCalled();
  });

  test("a failed name search resets the Cari button and does not show the QR banner", async () => {
    actions.searchMembers.mockResolvedValue({ status: "error" });
    render(
      <ToastProvider>
        <MembersClient initialRecent={[]} services={[{ id: SERVICE_ID, name: "Body Massage", duration: 60 }]} />
      </ToastProvider>,
    );
    const input = screen.getByLabelText("Nama atau nomor HP member");
    fireEvent.change(input, { target: { value: "dinda" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByText("Pencarian gagal. Coba lagi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cari" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Mencari…" })).not.toBeInTheDocument();
    expect(screen.queryByText("QR ini bukan kartu member Kalanara")).not.toBeInTheDocument();
  });

  test("a rejected name search also re-enables search and QR", async () => {
    actions.searchMembers.mockRejectedValue(new Error("network"));
    render(
      <ToastProvider>
        <MembersClient initialRecent={[]} services={[{ id: SERVICE_ID, name: "Body Massage", duration: 60 }]} />
      </ToastProvider>,
    );
    const input = screen.getByLabelText("Nama atau nomor HP member");
    fireEvent.change(input, { target: { value: "dinda" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByText("Pencarian gagal. Coba lagi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cari" })).toBeEnabled();
    expect(screen.queryByText("QR ini bukan kartu member Kalanara")).not.toBeInTheDocument();
  });

  test("a failed getMember on a single name match re-enables search", async () => {
    actions.searchMembers.mockResolvedValue({
      status: "ok",
      members: [
        {
          id: MEMBER_ID,
          name: "Dinda Salsabilla",
          phone: "6282212347221",
          memberCode: "7KQ2X9",
        },
      ],
    });
    actions.getMember.mockResolvedValue({ status: "error" });
    render(
      <ToastProvider>
        <MembersClient initialRecent={[]} services={[{ id: SERVICE_ID, name: "Body Massage", duration: 60 }]} />
      </ToastProvider>,
    );
    const input = screen.getByLabelText("Nama atau nomor HP member");
    fireEvent.change(input, { target: { value: "dinda" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByText("Kartu member gagal dibuka. Coba lagi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cari" })).toBeEnabled();
    expect(screen.queryByRole("heading", { name: "Dinda Salsabilla" })).not.toBeInTheDocument();
  });

  test("a rejected getMember on a single name match also re-enables search", async () => {
    actions.searchMembers.mockResolvedValue({
      status: "ok",
      members: [
        {
          id: MEMBER_ID,
          name: "Dinda Salsabilla",
          phone: "6282212347221",
          memberCode: "7KQ2X9",
        },
      ],
    });
    actions.getMember.mockRejectedValue(new Error("network"));
    render(
      <ToastProvider>
        <MembersClient initialRecent={[]} services={[{ id: SERVICE_ID, name: "Body Massage", duration: 60 }]} />
      </ToastProvider>,
    );
    const input = screen.getByLabelText("Nama atau nomor HP member");
    fireEvent.change(input, { target: { value: "dinda" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByText("Kartu member gagal dibuka. Coba lagi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cari" })).toBeEnabled();
  });

  test("a stale name-search response does not replace a newer submitted result", async () => {
    const first = deferred<{
      status: "ok";
      members: Array<{ id: string; name: string; phone: string; memberCode: string }>;
    }>();
    actions.searchMembers
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({
        status: "ok",
        members: [
          {
            id: MEMBER_ID,
            name: "Dinda Salsabilla",
            phone: "6282212347221",
            memberCode: "7KQ2X9",
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Dinda Lestari",
            phone: "6281211112222",
            memberCode: "8LM3Y0",
          },
        ],
      });
    render(
      <ToastProvider>
        <MembersClient initialRecent={[]} services={[{ id: SERVICE_ID, name: "Body Massage", duration: 60 }]} />
      </ToastProvider>,
    );
    const input = screen.getByLabelText("Nama atau nomor HP member");
    const form = input.closest("form")!;
    fireEvent.change(input, { target: { value: "din" } });
    fireEvent.submit(form);
    fireEvent.change(input, { target: { value: "dinda" } });
    fireEvent.submit(form);
    expect(await screen.findByText("Dinda Salsabilla")).toBeInTheDocument();
    expect(screen.getByText("Dinda Lestari")).toBeInTheDocument();

    await act(async () => {
      first.resolve({
        status: "ok",
        members: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            name: "Dini Other",
            phone: "6281299990000",
            memberCode: "9NP4Z1",
          },
        ],
      });
      await first.promise;
    });
    expect(screen.queryByText("Dini Other")).not.toBeInTheDocument();
    expect(screen.getByText("Dinda Salsabilla")).toBeInTheDocument();
  });

  test("submit cancels a pending debounce so it does not search again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      actions.searchMembers.mockResolvedValue({
        status: "ok",
        members: [
          {
            id: MEMBER_ID,
            name: "Dinda Salsabilla",
            phone: "6282212347221",
            memberCode: "7KQ2X9",
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Dinda Lestari",
            phone: "6281211112222",
            memberCode: "8LM3Y0",
          },
        ],
      });
      render(
        <ToastProvider>
          <MembersClient initialRecent={[]} services={[{ id: SERVICE_ID, name: "Body Massage", duration: 60 }]} />
        </ToastProvider>,
      );
      const input = screen.getByLabelText("Nama atau nomor HP member");
      fireEvent.change(input, { target: { value: "dinda" } });
      fireEvent.submit(input.closest("form")!);
      expect(await screen.findByText("Dinda Salsabilla")).toBeInTheDocument();
      expect(actions.searchMembers).toHaveBeenCalledTimes(1);
      await act(async () => {
        vi.advanceTimersByTime(400);
      });
      expect(actions.searchMembers).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("MembersClient directory", () => {
  test("shows Siap follow up and the full member list in the right pane", () => {
    const rina = listRow();
    const dinda = listRow({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Dinda Salsabilla",
      phone: "6282212347221",
      stampCount: 8,
      nextMilestone: 10,
      nextRewardName: "Treatment gratis",
      lastVisitAt: "2026-11-18T04:00:00Z",
    });
    render(
      <ToastProvider>
        <MembersClient
          initialRecent={[]}
          initialList={{
            status: "ok",
            page: buildAdminPage([rina, dinda], 1, 2),
            followUp: { nearReward: [rina], frequent: [dinda] },
            milestones: [5, 10],
          }}
          services={[{ id: SERVICE_ID, name: "Body Massage", duration: 60 }]}
        />
      </ToastProvider>,
    );
    expect(screen.getByText("Siap follow up")).toBeInTheDocument();
    expect(screen.getByText("Deket reward")).toBeInTheDocument();
    expect(screen.getByText(/1 stamp lagi buat Totok gratis/)).toBeInTheDocument();
    expect(screen.getByText("Sering datang")).toBeInTheDocument();
    expect(screen.getByText("Semua member")).toBeInTheDocument();
    expect(screen.getAllByText("+62 812 3456 4471").length).toBeGreaterThan(0);
    expect(screen.queryByText("Scan QR member buat mulai")).not.toBeInTheDocument();
    expect(screen.queryByText(/····/)).not.toBeInTheDocument();
  });

  test("clicking a list row opens the member card, and back returns to the list", async () => {
    const rina = listRow();
    actions.getMember.mockResolvedValue({ status: "ok", summary: summary(4) });
    render(
      <ToastProvider>
        <MembersClient
          initialRecent={[]}
          initialList={{
            status: "ok",
            page: buildAdminPage([rina], 1, 1),
            followUp: { nearReward: [rina], frequent: [] },
            milestones: [5],
          }}
          services={[{ id: SERVICE_ID, name: "Body Massage", duration: 60 }]}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Buka kartu Rina Maharani" }));
    expect(await screen.findByRole("button", { name: "Kembali ke daftar" })).toBeInTheDocument();
    expect(actions.getMember).toHaveBeenCalledWith(MEMBER_ID);
    expect(screen.getByText(/\+62 812 3456 4471/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kembali ke daftar" }));
    expect(await screen.findByText("Semua member")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kembali ke daftar" })).not.toBeInTheDocument();
    expect(actions.listMembers).toHaveBeenCalled();
  });

  test("shows an empty state when there are no members", () => {
    render(
      <ToastProvider>
        <MembersClient
          initialRecent={[]}
          initialList={emptyListResult()}
          services={[{ id: SERVICE_ID, name: "Body Massage", duration: 60 }]}
        />
      </ToastProvider>,
    );
    expect(screen.getByText("Belum ada member")).toBeInTheDocument();
    expect(screen.queryByText("Siap follow up")).not.toBeInTheDocument();
  });

  test("an older list failure does not hide a newer successful result", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const first = deferred<{ status: "error" }>();
      const rina = listRow();
      const dinda = listRow({
        id: "22222222-2222-4222-8222-222222222222",
        name: "Dinda Salsabilla",
        phone: "6282212347221",
        stampCount: 8,
        nextMilestone: 10,
        nextRewardName: "Treatment gratis",
      });
      actions.listMembers
        .mockReturnValueOnce(first.promise)
        .mockResolvedValueOnce({
          status: "ok",
          page: buildAdminPage([dinda], 1, 1),
          followUp: { nearReward: [], frequent: [] },
          milestones: [5],
        });
      render(
        <ToastProvider>
          <MembersClient
            initialRecent={[]}
            initialList={{
              status: "ok",
              page: buildAdminPage([rina], 1, 1),
              followUp: { nearReward: [], frequent: [] },
              milestones: [5],
            }}
            services={[{ id: SERVICE_ID, name: "Body Massage", duration: 60 }]}
          />
        </ToastProvider>,
      );
      const input = document.getElementById("member-directory-search") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "rin" } });
      await act(async () => {
        vi.advanceTimersByTime(250);
      });
      fireEvent.change(input, { target: { value: "dinda" } });
      await act(async () => {
        vi.advanceTimersByTime(250);
      });
      expect(await screen.findByRole("button", { name: "Buka kartu Dinda Salsabilla" })).toBeInTheDocument();
      await act(async () => {
        first.resolve({ status: "error" });
        await first.promise;
      });
      expect(screen.getByRole("button", { name: "Buka kartu Dinda Salsabilla" })).toBeInTheDocument();
      expect(screen.queryByText("Daftar member gagal dimuat")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("MembersClient deep link and purchases", () => {
  test("opens the member card from ?member=<id>", async () => {
    actions.getMember.mockResolvedValueOnce({ status: "ok", summary: summary(4) });
    render(
      <ToastProvider>
        <MembersClient
          initialRecent={[]}
          initialMember={MEMBER_ID}
          services={[{ id: SERVICE_ID, name: "Body Massage", duration: 60 }]}
        />
      </ToastProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Rina Maharani" })).toBeInTheDocument();
    expect(actions.getMember).toHaveBeenCalledWith(MEMBER_ID);
    expect(await screen.findByText("Riwayat beli voucher")).toBeInTheDocument();
    expect(await screen.findByText("Belum pernah beli voucher online.")).toBeInTheDocument();
  });

  test("opens the member card from a member code", async () => {
    actions.findMember.mockResolvedValueOnce({ status: "ok", summary: summary(4) });
    render(
      <ToastProvider>
        <MembersClient
          initialRecent={[]}
          initialMember="7KQ2X9"
          services={[{ id: SERVICE_ID, name: "Body Massage", duration: 60 }]}
        />
      </ToastProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Rina Maharani" })).toBeInTheDocument();
    expect(actions.findMember).toHaveBeenCalledWith({ scan: "7KQ2X9" });
    expect(actions.getMember).not.toHaveBeenCalled();
  });
});
