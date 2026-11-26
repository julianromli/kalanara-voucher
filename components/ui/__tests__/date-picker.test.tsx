import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import {
  DatePicker,
  formatDateLabel,
  formatISODate,
  parseISODate,
} from "@/components/ui/date-picker";

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

describe("parseISODate / formatISODate", () => {
  test("round-trips a calendar date without a UTC shift", () => {
    const date = parseISODate("1994-03-12");
    expect(date).toBeDefined();
    expect(date?.getFullYear()).toBe(1994);
    expect(date?.getMonth()).toBe(2);
    expect(date?.getDate()).toBe(12);
    expect(formatISODate(date!)).toBe("1994-03-12");
    expect(formatDateLabel(date!)).toBe("12 Maret 1994");
  });

  test("rejects an impossible date", () => {
    expect(parseISODate("2026-02-31")).toBeUndefined();
    expect(parseISODate("")).toBeUndefined();
  });
});

describe("DatePicker", () => {
  test("uses a custom trigger, not a native date input", () => {
    render(<DatePicker id="birth" value={undefined} onChange={vi.fn()} />);
    expect(document.querySelector("input[type=date]")).toBeNull();
    expect(document.querySelector("select")).toBeNull();
    const trigger = screen.getByRole("button", { name: "Pilih tanggal" });
    expect(trigger).toHaveAttribute("id", "birth");
    expect(trigger.className).toMatch(/h-11/);
    expect(trigger.className).toMatch(/text-base/);
    expect(trigger.className).toMatch(/rounded-md/);
  });

  test("shows an Indonesian date and lets the user pick another day", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker value={parseISODate("1994-03-12")} onChange={onChange} />);

    const trigger = screen.getByRole("button", { name: "12 Maret 1994" });
    await user.click(trigger);
    expect(screen.getByRole("combobox", { name: "Bulan" })).toHaveTextContent("Maret");
    expect(screen.getByRole("combobox", { name: "Tahun" })).toHaveTextContent("1994");

    await user.click(screen.getByRole("button", { name: /15 Maret 1994/ }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as Date;
    expect(formatISODate(next)).toBe("1994-03-15");
  });

  test("jumps years from the year dropdown", async () => {
    const user = userEvent.setup();
    render(
      <DatePicker
        value={parseISODate("1994-03-12")}
        onChange={vi.fn()}
        min={parseISODate("1900-01-01")}
        max={parseISODate("2026-11-26")}
      />,
    );

    await user.click(screen.getByRole("button", { name: "12 Maret 1994" }));
    await user.click(screen.getByRole("combobox", { name: "Tahun" }));
    await user.click(await screen.findByRole("option", { name: "2000" }));
    expect(screen.getByRole("combobox", { name: "Tahun" })).toHaveTextContent("2000");
    expect(screen.getByRole("button", { name: /15 Maret 2000/ })).toBeInTheDocument();
  });

  test("clears an optional value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DatePicker
        value={parseISODate("2026-11-20")}
        onChange={onChange}
        max={parseISODate("2026-11-20")}
        clearable
      />,
    );

    await user.click(screen.getByRole("button", { name: "Hapus tanggal" }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  test("disables days after max", async () => {
    const user = userEvent.setup();
    render(
      <DatePicker
        value={parseISODate("2026-11-20")}
        onChange={vi.fn()}
        max={parseISODate("2026-11-20")}
      />,
    );
    await user.click(screen.getByRole("button", { name: "20 November 2026" }));
    expect(screen.getByRole("button", { name: /21 November 2026/ })).toBeDisabled();
  });
});
