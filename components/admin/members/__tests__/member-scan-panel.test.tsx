import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemberScanPanel } from "@/components/admin/members/member-scan-panel";

const token = "a".repeat(48);
const cardUrl = `https://voucher.kalanaraspa.com/m/${token}`;

function renderPanel(manualValue: string, onManualChange = vi.fn(), onManualSubmit = vi.fn()) {
  render(
    <MemberScanPanel
      onScan={vi.fn()}
      status="idle"
      manualValue={manualValue}
      onManualChange={onManualChange}
      onManualSubmit={onManualSubmit}
    />,
  );
  return { onManualChange, onManualSubmit };
}

describe("MemberScanPanel phone lookup", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(() => Promise.reject(new Error("denied"))) },
    });
  });

  test("shows +62 for a phone number and submits the digits", () => {
    const { onManualChange, onManualSubmit } = renderPanel("81234567890");
    expect(screen.getByText("+62")).toBeInTheDocument();
    const input = screen.getByLabelText("Nomor HP member");
    expect(input).toHaveValue("81234567890");
    expect(input).toHaveAttribute("inputMode", "numeric");
    fireEvent.change(input, { target: { value: "81234567891" } });
    expect(onManualChange).toHaveBeenCalledWith("81234567891");
    fireEvent.submit(input.closest("form")!);
    expect(onManualSubmit).toHaveBeenCalledOnce();
  });

  test("hides +62 when a card URL is pasted and still submits the URL", () => {
    const { onManualChange, onManualSubmit } = renderPanel(cardUrl);
    expect(screen.queryByText("+62")).not.toBeInTheDocument();
    const input = screen.getByLabelText("Nomor HP member");
    expect(input).toHaveValue(cardUrl);
    expect(input).toHaveAttribute("inputMode", "url");
    fireEvent.change(input, { target: { value: token } });
    expect(onManualChange).toHaveBeenCalledWith(token);
    fireEvent.submit(input.closest("form")!);
    expect(onManualSubmit).toHaveBeenCalledOnce();
  });

  test("hides +62 for a raw card token", () => {
    renderPanel(token);
    expect(screen.queryByText("+62")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nomor HP member")).toHaveValue(token);
  });
});
