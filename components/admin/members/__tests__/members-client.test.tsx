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
import { ToastProvider } from "@/context/ToastContext";

const BRONZE_BANNER = /kebuka, dan Rina naik ke Bronze/;
const MEMBER_ID = "11111111-1111-4111-8111-111111111111";
const SERVICE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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
});
