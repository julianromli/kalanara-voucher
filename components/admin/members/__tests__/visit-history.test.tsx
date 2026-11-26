import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { listStampHistoryMock } = vi.hoisted(() => ({ listStampHistoryMock: vi.fn() }));

vi.mock("@/lib/actions/members", () => ({
  listStampHistory: listStampHistoryMock,
  addPastStamp: vi.fn(),
  correctStampDate: vi.fn(),
  correctStampService: vi.fn(),
  correctVoidStamp: vi.fn(),
}));

import { VisitHistory } from "@/components/admin/members/visit-history";
import type { MemberSummary } from "@/lib/membership/summary";

function summary(): MemberSummary {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Riesti",
    phone: "6282211117221",
    birthDate: "1990-01-01",
    waConsent: true,
    memberCode: "7KQ2X9",
    source: "cashier",
    createdAt: "2026-03-12T03:00:00Z",
    cardToken: "a".repeat(48),
    stampCount: 1,
    baseTier: 0,
    effectiveTier: 0,
    cycleStart: "2026-03-12",
    rolledCycles: 0,
    tierBefore: null,
    resetOn: "2027-03-12",
    birthday: {
      eligible: false,
      redeemed: false,
      occurrence: "2027-01-01",
      windowStart: "2026-12-29",
      windowEnd: "2027-01-04",
      birthdayYear: 2027,
    },
    lastTreatment: null,
    rewards: [],
    stamps: [],
    claims: [],
    birthdayRedemptions: [],
  };
}

const history = {
  status: "ok" as const,
  history: {
    cycleStart: "2026-03-12",
    resetOn: "2027-03-12",
    today: "2026-11-26",
    stamps: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        visitDate: "2026-11-25",
        serviceId: "s1",
        serviceName: "Deep Sleep",
        createdAt: "2026-11-25T03:00:00Z",
        createdByName: "Rina Kasir",
        voidedAt: null,
        voidedByName: null,
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        visitDate: "2026-11-24",
        serviceId: "s2",
        serviceName: "Me Time",
        createdAt: "2026-11-24T03:00:00Z",
        createdByName: "Rina Kasir",
        voidedAt: "2026-11-26T02:00:00Z",
        voidedByName: "Wildan",
      },
    ],
    audit: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        stampId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        action: "void" as const,
        oldValue: "aktif",
        newValue: "dibatalkan",
        serviceName: "Me Time",
        visitDate: "2026-11-24",
        reason: "salah member",
        claimsKept: [],
        changedByName: "Wildan",
        changedByEmail: "wildan@kalanaraspa.com",
        changedByRole: "STAFF",
        createdAt: "2026-11-26T02:00:00Z",
      },
    ],
  },
};

describe("VisitHistory corrections", () => {
  beforeEach(() => {
    listStampHistoryMock.mockReset();
    listStampHistoryMock.mockResolvedValue(history);
  });

  test("marks voided rows, gives live rows a menu, and shows the correction log", async () => {
    render(
      <VisitHistory
        summary={summary()}
        services={[{ id: "s1", name: "Deep Sleep" }]}
        onCorrected={vi.fn()}
      />,
    );

    expect(await screen.findByText("Riwayat koreksi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Koreksi stamp Deep Sleep 25 Nov 2026" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Koreksi stamp Me Time/ })).not.toBeInTheDocument();
    expect(screen.getByText("Me Time")).toHaveClass("line-through");
    expect(screen.getByText("Dihapus")).toBeInTheDocument();
    expect(screen.getByText("Alasan: salah member")).toBeInTheDocument();
    expect(screen.getByText(/Wildan \(Staff\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tambah stamp lama" })).toBeEnabled();
  });

  test("without a correction handler it stays read-only and loads nothing", () => {
    render(<VisitHistory summary={summary()} />);
    expect(screen.queryByRole("button", { name: "Tambah stamp lama" })).not.toBeInTheDocument();
    expect(listStampHistoryMock).not.toHaveBeenCalled();
  });

  test("keeps Tambah stamp lama disabled until the history loads", () => {
    listStampHistoryMock.mockReturnValue(new Promise(() => {}));
    render(<VisitHistory summary={summary()} services={[{ id: "s1", name: "Deep Sleep" }]} onCorrected={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Tambah stamp lama" })).toBeDisabled();
  });

  test("a late answer for the previous member never shows on the next one", async () => {
    let resolveFirst: (value: typeof history) => void = () => {};
    listStampHistoryMock
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
      .mockReturnValueOnce(new Promise(() => {}));
    const first = summary();
    const { rerender } = render(<VisitHistory summary={first} services={[]} onCorrected={vi.fn()} />);
    rerender(
      <VisitHistory
        summary={{ ...first, id: "22222222-2222-4222-8222-222222222222", name: "Budi" }}
        services={[]}
        onCorrected={vi.fn()}
      />,
    );
    await act(async () => {
      resolveFirst(history);
    });
    expect(screen.queryByText("Riwayat koreksi")).not.toBeInTheDocument();
    expect(screen.queryByText("Me Time")).not.toBeInTheDocument();
  });

  test("an older reload for the same member never replaces a newer one", async () => {
    let resolveOld: (value: typeof history) => void = () => {};
    let resolveNew: (value: typeof history) => void = () => {};
    listStampHistoryMock
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveNew = resolve; }));
    const first = summary();
    const { rerender } = render(<VisitHistory summary={first} services={[]} onCorrected={vi.fn()} />);
    rerender(<VisitHistory summary={{ ...first, stampCount: 2 }} services={[]} onCorrected={vi.fn()} />);
    const newer = {
      ...history,
      history: { ...history.history, audit: [], stamps: [{ ...history.history.stamps[0], serviceName: "Rejuvenate Me" }] },
    };
    await act(async () => {
      resolveNew(newer);
    });
    await act(async () => {
      resolveOld(history);
    });
    expect(screen.getByText("Rejuvenate Me")).toBeInTheDocument();
    expect(screen.queryByText("Riwayat koreksi")).not.toBeInTheDocument();
  });
});
