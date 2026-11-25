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
    const input = screen.getByLabelText("Nama atau nomor HP member");
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
    const input = screen.getByLabelText("Nama atau nomor HP member");
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
    expect(screen.getByLabelText("Nama atau nomor HP member")).toHaveValue(token);
  });

  test("labels the field as name or phone and hides +62 for dinda", () => {
    const { onManualSubmit } = renderPanel("dinda");
    expect(screen.getByText("Cari nama atau nomor HP")).toBeInTheDocument();
    expect(screen.queryByText("+62")).not.toBeInTheDocument();
    const input = screen.getByLabelText("Nama atau nomor HP member");
    expect(input).toHaveValue("dinda");
    expect(input).toHaveAttribute("inputMode", "text");
    fireEvent.submit(input.closest("form")!);
    expect(onManualSubmit).toHaveBeenCalledOnce();
  });

  test("lists name matches with the full phone number", () => {
    const onPickNameResult = vi.fn();
    render(
      <MemberScanPanel
        onScan={vi.fn()}
        status="idle"
        manualValue="dinda"
        onManualChange={vi.fn()}
        onManualSubmit={vi.fn()}
        nameResults={[
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Dinda Salsabilla",
            phone: "6282212347221",
            memberCode: "7KQ2X9",
          },
        ]}
        onPickNameResult={onPickNameResult}
      />,
    );
    expect(screen.getByText("Dinda Salsabilla")).toBeInTheDocument();
    expect(screen.getByText("+62 822 1234 7221")).toBeInTheDocument();
    expect(screen.queryByText(/····/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Dinda Salsabilla/ }));
    expect(onPickNameResult).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
  });

  test("shows a name-miss message without the QR rejected banner", () => {
    render(
      <MemberScanPanel
        onScan={vi.fn()}
        status="idle"
        manualValue="dinda"
        onManualChange={vi.fn()}
        onManualSubmit={vi.fn()}
        nameStatus="empty"
      />,
    );
    expect(screen.getByText("Nama ini belum terdaftar.")).toBeInTheDocument();
    expect(screen.queryByText("QR ini bukan kartu member Kalanara")).not.toBeInTheDocument();
    expect(screen.queryByText("Nomor ini belum terdaftar.")).not.toBeInTheDocument();
  });
});
