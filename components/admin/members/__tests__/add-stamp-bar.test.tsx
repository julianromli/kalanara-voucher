import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

class MockPointerEvent extends Event {
  button: number;
  ctrlKey: boolean;
  pointerType: string;

  constructor(type: string, props: PointerEventInit = {}) {
    super(type, props);
    this.button = props.button || 0;
    this.ctrlKey = props.ctrlKey || false;
    this.pointerType = props.pointerType || "mouse";
  }
}

window.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
window.HTMLElement.prototype.setPointerCapture = vi.fn();

import { AddStampBar } from "@/components/admin/members/add-stamp-bar";

const SERVICES = [
  { id: "svc-1", name: "Bareng Bestie 11.11 (2x Me Time) - Flash Sale 11.11" },
  { id: "svc-2", name: "Deep Sleep (120 menit)" },
  { id: "svc-3", name: "Love Birds 1 (210 menit)" },
];

function renderBar(overrides: Partial<Parameters<typeof AddStampBar>[0]> = {}) {
  const props: Parameters<typeof AddStampBar>[0] = {
    services: SERVICES,
    serviceId: "svc-1",
    onServiceChange: vi.fn(),
    justAdded: false,
    confirm: null,
    error: false,
    pending: false,
    onAdd: vi.fn(),
    onConfirm: vi.fn(),
    onCancelConfirm: vi.fn(),
    onRetry: vi.fn(),
    hasStampToday: false,
    ...overrides,
  };
  return { props, ...render(<AddStampBar {...props} />) };
}

describe("AddStampBar", () => {
  test("uses the custom select, not a native select", async () => {
    const user = userEvent.setup();
    const { props } = renderBar();

    expect(document.querySelector("select")).toBeNull();
    const trigger = screen.getByRole("combobox", { name: "Treatment walk-in hari ini" });
    expect(trigger).toHaveTextContent("Bareng Bestie 11.11 (2x Me Time) - Flash Sale 11.11");

    await user.click(trigger);
    const option = await screen.findByRole("option", { name: "Deep Sleep (120 menit)" });
    await user.click(option);
    expect(props.onServiceChange).toHaveBeenCalledWith("svc-2");
  });

  test("disables the select and add button when there are no treatments", () => {
    renderBar({ services: [], serviceId: "" });
    expect(screen.getByRole("combobox", { name: "Treatment walk-in hari ini" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tambah stamp" })).toBeDisabled();
  });

  test("keeps the trigger the same height as the add button", () => {
    renderBar();
    const trigger = screen.getByRole("combobox", { name: "Treatment walk-in hari ini" });
    const button = screen.getByRole("button", { name: "Tambah stamp" });
    expect(trigger.className).toMatch(/h-11/);
    expect(button.className).toMatch(/h-11/);
  });
});
