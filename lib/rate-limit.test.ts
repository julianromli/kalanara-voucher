import { afterEach, describe, expect, test, vi } from "vitest";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("allows up to the limit per key, then blocks until the window resets", () => {
    vi.useFakeTimers();
    const check = createRateLimiter({ limit: 2, windowMs: 1000 });

    expect(check("a")).toBe(true);
    expect(check("a")).toBe(true);
    expect(check("a")).toBe(false);
    expect(check("b")).toBe(true);

    vi.advanceTimersByTime(1001);
    expect(check("a")).toBe(true);
  });

  test("keeps no more than maxKeys keys and evicts the oldest first", () => {
    vi.useFakeTimers();
    const check = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 2 });

    expect(check("a")).toBe(true);
    expect(check("b")).toBe(true);
    expect(check("c")).toBe(true);

    // "a" was evicted, so it starts a new window; "c" is still counted.
    expect(check("a")).toBe(true);
    expect(check("c")).toBe(false);
  });
});

describe("getClientIp", () => {
  test("uses the first x-forwarded-for address, then x-real-ip", () => {
    expect(
      getClientIp(new Request("http://localhost", {
        headers: { "x-forwarded-for": " 203.0.113.1 , 10.0.0.1" },
      }))
    ).toBe("203.0.113.1");
    expect(
      getClientIp(new Request("http://localhost", {
        headers: { "x-real-ip": "203.0.113.2" },
      }))
    ).toBe("203.0.113.2");
    expect(getClientIp(new Request("http://localhost"))).toBe("unknown");
  });
});
