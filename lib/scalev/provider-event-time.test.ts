import { afterEach, describe, expect, test, vi } from "vitest";
import {
  SCALEV_PROVIDER_EVENT_MAX_CLOCK_SKEW_MS,
  resolveScalevProviderEventAt,
} from "@/lib/scalev/provider-event-time";

describe("resolveScalevProviderEventAt", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  test("marks valid provider timestamps as genuine", () => {
    expect(
      resolveScalevProviderEventAt(
        "2026-09-14T11:58:00.000Z",
        "2026-09-14T12:00:00.000Z",
        "webhook"
      )
    ).toEqual({
      timestamp: "2026-09-14T11:58:00.000Z",
      isFallback: false,
    });
  });

  test("accepts a provider timestamp at the clock-skew boundary", () => {
    const receiptTime = "2026-09-14T12:00:00.000Z";
    const boundaryTime = new Date(
      Date.parse(receiptTime) + SCALEV_PROVIDER_EVENT_MAX_CLOCK_SKEW_MS
    ).toISOString();

    expect(
      resolveScalevProviderEventAt(boundaryTime, receiptTime, "webhook")
    ).toEqual({
      timestamp: boundaryTime,
      isFallback: false,
    });
  });

  test("falls back for future completion/refund event timestamps so they cannot outrank genuine events", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "production");
    const receiptTime = "2026-09-14T12:00:00.000Z";
    const futureTime = new Date(
      Date.parse(receiptTime) + SCALEV_PROVIDER_EVENT_MAX_CLOCK_SKEW_MS + 1
    ).toISOString();

    expect(
      resolveScalevProviderEventAt(futureTime, receiptTime, "webhook")
    ).toEqual({
      timestamp: receiptTime,
      isFallback: true,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  test("marks receipt-time fallback and suppresses noisy production warnings", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "production");

    expect(
      resolveScalevProviderEventAt(
        "invalid",
        "2026-09-14T12:00:00.000Z",
        "reconciliation"
      )
    ).toEqual({
      timestamp: "2026-09-14T12:00:00.000Z",
      isFallback: true,
    });
    expect(warn).not.toHaveBeenCalled();
  });
});
