import { beforeEach, describe, expect, it, vi } from "vitest";

const dnsMocks = vi.hoisted(() => ({
  getDefaultResultOrder: vi.fn(),
  setDefaultResultOrder: vi.fn(),
}));

vi.mock("node:dns", () => ({
  default: {
    getDefaultResultOrder: dnsMocks.getDefaultResultOrder,
    setDefaultResultOrder: dnsMocks.setDefaultResultOrder,
  },
  getDefaultResultOrder: dnsMocks.getDefaultResultOrder,
  setDefaultResultOrder: dnsMocks.setDefaultResultOrder,
}));

import { ensureScalevIpv4First } from "@/lib/scalev/network";

describe("ensureScalevIpv4First", () => {
  beforeEach(() => {
    dnsMocks.getDefaultResultOrder.mockReset();
    dnsMocks.setDefaultResultOrder.mockReset();
  });

  it("forces ipv4first when the runtime still uses verbatim lookup order", () => {
    dnsMocks.getDefaultResultOrder.mockReturnValue("verbatim");

    ensureScalevIpv4First();

    expect(dnsMocks.setDefaultResultOrder).toHaveBeenCalledWith("ipv4first");
  });

  it("does not rewrite the DNS result order when ipv4first is already active", () => {
    dnsMocks.getDefaultResultOrder.mockReturnValue("ipv4first");

    ensureScalevIpv4First();

    expect(dnsMocks.setDefaultResultOrder).not.toHaveBeenCalled();
  });
});
