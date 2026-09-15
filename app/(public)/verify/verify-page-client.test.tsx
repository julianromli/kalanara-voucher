import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { VerifyPageClient } from "@/app/(public)/verify/verify-page-client";

vi.mock("@/components/qr-scanner", () => ({
  default: ({ onScan }: { onScan: (code: string) => void }) => (
    <div>
      <button onClick={() => onScan("voucher-a")}>Scan A</button>
      <button onClick={() => onScan("voucher-b")}>Scan B</button>
    </div>
  ),
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function voucherResponse(code: string, serviceName: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      found: true,
      voucher: {
        id: `voucher-${code}`,
        code,
        recipientName: "Faiz",
        expiryDate: "2026-12-31T00:00:00.000Z",
        isRedeemed: false,
        amount: 450000,
        service: {
          name: serviceName,
          duration: 90,
          image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=200&q=80",
        },
      },
    }),
  } as Response;
}

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
        expect.objectContaining({
          cache: "no-store",
          signal: expect.any(AbortSignal),
        })
      );
    });

    expect(await screen.findByText("Relaxing Massage")).toBeInTheDocument();
    expect(screen.getByText("Faiz")).toBeInTheDocument();
  });

  test.each([
    ["the older request resolves first", "a-first"],
    ["the newer request resolves first", "b-first"],
  ])("keeps request B as the result when %s", async (_label, resolutionOrder) => {
    const user = userEvent.setup();
    const requestA = deferred<Response>();
    const requestB = deferred<Response>();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(requestA.promise)
      .mockReturnValueOnce(requestB.promise);
    vi.stubGlobal("fetch", fetchMock);

    render(<VerifyPageClient />);
    await user.click(screen.getByRole("button", { name: "Scan QR Code" }));
    await user.click(screen.getByRole("button", { name: "Scan A" }));
    await user.click(screen.getByRole("button", { name: "Scan B" }));

    if (resolutionOrder === "a-first") {
      await act(async () => {
        requestA.resolve(voucherResponse("VOUCHER-A", "Perawatan A"));
        await requestA.promise;
      });
      expect(screen.queryByText("Perawatan A")).not.toBeInTheDocument();
      await act(async () => {
        requestB.resolve(voucherResponse("VOUCHER-B", "Perawatan B"));
        await requestB.promise;
      });
    } else {
      await act(async () => {
        requestB.resolve(voucherResponse("VOUCHER-B", "Perawatan B"));
        await requestB.promise;
      });
      expect(await screen.findByText("Perawatan B")).toBeInTheDocument();
      await act(async () => {
        requestA.resolve(voucherResponse("VOUCHER-A", "Perawatan A"));
        await requestA.promise;
      });
    }

    expect(await screen.findByText("Perawatan B")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Perawatan A")).not.toBeInTheDocument();
    });
  });

  test("aborts the replaced request and does not let its finally clear newer loading", async () => {
    const user = userEvent.setup();
    const requestA = deferred<Response>();
    const requestB = deferred<Response>();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(requestA.promise)
      .mockReturnValueOnce(requestB.promise);
    vi.stubGlobal("fetch", fetchMock);

    render(<VerifyPageClient />);
    await user.click(screen.getByRole("button", { name: "Scan QR Code" }));
    await user.click(screen.getByRole("button", { name: "Scan A" }));
    const firstSignal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;
    expect(firstSignal.aborted).toBe(false);

    await user.click(screen.getByRole("button", { name: "Scan B" }));
    expect(firstSignal.aborted).toBe(true);

    await act(async () => {
      requestA.reject(new DOMException("Aborted", "AbortError"));
      await requestA.promise.catch(() => undefined);
    });
    await user.click(screen.getByRole("button", { name: "Ketik Kode" }));
    expect(screen.getByRole("button", { name: "..." })).toBeDisabled();
    expect(screen.queryByText("Voucher Tidak Ditemukan")).not.toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();

    await act(async () => {
      requestB.resolve(voucherResponse("VOUCHER-B", "Perawatan B"));
      await requestB.promise;
    });
    expect(await screen.findByText("Perawatan B")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cek" })).toBeEnabled();
  });

  test("preserves not-found behavior for a 404 response", async () => {
    const request = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(request.promise));

    render(<VerifyPageClient initialCode="missing-code" />);
    await act(async () => {
      request.resolve({ ok: false, status: 404 } as Response);
      await request.promise;
    });

    expect(await screen.findByText("Voucher Tidak Ditemukan")).toBeInTheDocument();
    expect(screen.getByText("MISSING-CODE")).toBeInTheDocument();
  });

  test("preserves not-found behavior and logging for a network failure", async () => {
    const user = userEvent.setup();
    const request = deferred<Response>();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(request.promise));

    render(<VerifyPageClient />);
    await user.type(
      screen.getByPlaceholderText("Masukkan kode voucher (contoh: KSP-2024-XXXX)"),
      "network-error"
    );
    await user.click(screen.getByRole("button", { name: "Cek" }));
    const failure = new Error("Network unavailable");
    await act(async () => {
      request.reject(failure);
      await request.promise.catch(() => undefined);
    });

    expect(await screen.findByText("Voucher Tidak Ditemukan")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith("Voucher verification failed:", failure);
  });

  test("aborts the active request on unmount without logging or rendering not-found", async () => {
    const request = deferred<Response>();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockReturnValue(request.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(<VerifyPageClient initialCode="pending-code" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const signal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;

    unmount();

    expect(signal.aborted).toBe(true);
    await act(async () => {
      request.reject(new DOMException("Aborted", "AbortError"));
      await request.promise.catch(() => undefined);
    });
    expect(consoleError).not.toHaveBeenCalled();
  });
});
