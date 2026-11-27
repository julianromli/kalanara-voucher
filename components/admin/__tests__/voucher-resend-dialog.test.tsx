import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { resendVoucherEmailMock, getVoucherWhatsAppLinkMock, recordCopiedMock } = vi.hoisted(() => ({
  resendVoucherEmailMock: vi.fn(),
  getVoucherWhatsAppLinkMock: vi.fn(),
  recordCopiedMock: vi.fn(),
}));

vi.mock("@/lib/actions/voucher-resend", () => ({
  getVoucherWhatsAppLink: getVoucherWhatsAppLinkMock,
  recordVoucherWhatsAppLinkCopied: recordCopiedMock,
}));

vi.mock("@/lib/voucher-resend/client", () => ({
  requestVoucherResend: resendVoucherEmailMock,
}));

import {
  ResendVoucherDialog,
  VoucherDeliveryStatus,
} from "@/components/admin/voucher-resend-dialog";
import type { VoucherDeliveryOverview } from "@/lib/voucher-resend/shared";

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const ORDER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function overview(partial: Partial<VoucherDeliveryOverview> = {}): VoucherDeliveryOverview {
  return {
    voucherId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    orderItemId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    code: "KSP-2026-VX9ZD3PF",
    serviceName: "Love Birds 1 (210 menit)",
    recipientName: "Dias Sagita",
    recipientEmail: "dias@gmail.com",
    buyerEmail: "buyer@gmail.com",
    whatsAppTarget: { kind: "RECIPIENT", phone: "+62 812 1111 2222" },
    isRedeemed: false,
    isExpired: false,
    email: { state: "SENT", at: "2026-11-27T09:51:41.000Z" },
    lastResend: null,
    ...partial,
  };
}

function renderDialog(partial: Partial<VoucherDeliveryOverview> = {}) {
  const props = {
    open: true,
    orderId: ORDER_ID,
    overview: overview(partial),
    onOpenChange: vi.fn(),
    onSent: vi.fn(),
    onWhatsAppCopied: vi.fn(),
  };
  render(<ResendVoucherDialog {...props} />);
  return props;
}

describe("VoucherDeliveryStatus", () => {
  test("shows where the email went and a 44px resend button", () => {
    render(
      <VoucherDeliveryStatus overview={overview()} loading={false} failed={false} onResend={vi.fn()} />
    );
    expect(screen.getByText("Email terkirim ke dias@gmail.com · 27 Nov 16.51")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kirim ulang" })).toHaveClass("min-h-11");
  });

  test("shows a never-emailed voucher and still allows a resend", async () => {
    const onResend = vi.fn();
    render(
      <VoucherDeliveryStatus
        overview={overview({ email: { state: "NONE", at: null } })}
        loading={false}
        failed={false}
        onResend={onResend}
      />
    );
    expect(screen.getByText("Belum pernah dikirim lewat email")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Kirim ulang" }));
    expect(onResend).toHaveBeenCalled();
  });

  test("disables the resend for a redeemed voucher and says why", () => {
    render(
      <VoucherDeliveryStatus
        overview={overview({ isRedeemed: true })}
        loading={false}
        failed={false}
        onResend={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Kirim ulang" })).toBeDisabled();
    expect(screen.getByText("Voucher sudah dipakai.")).toBeInTheDocument();
  });
});

describe("ResendVoucherDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("uses the custom select, defaults to the recipient and sends", async () => {
    const user = userEvent.setup();
    resendVoucherEmailMock.mockResolvedValue({
      status: "sent",
      to: "dias@gmail.com",
      recipientEmailUpdated: false,
    });
    const props = renderDialog();

    // Radix keeps a hidden native select for form autofill; nothing visible is native.
    expect(document.querySelector("select:not([aria-hidden='true'])")).toBeNull();
    const trigger = screen.getByRole("combobox", { name: "Kirim ke" });
    expect(trigger).toHaveTextContent("Penerima · dias@gmail.com");
    expect(trigger).toHaveClass("min-h-11");

    await user.click(screen.getByRole("button", { name: "Kirim email" }));

    expect(resendVoucherEmailMock).toHaveBeenCalledWith({
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      orderId: ORDER_ID,
      voucherId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      target: "RECIPIENT",
      email: undefined,
      saveAsRecipient: undefined,
    });
    expect(props.onSent).toHaveBeenCalledWith("Voucher dikirim ulang ke dias@gmail.com.");
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  test("Email lain shows a 16px email field that validates on blur, then saves the fix", async () => {
    const user = userEvent.setup();
    resendVoucherEmailMock.mockResolvedValue({
      status: "sent",
      to: "dias.benar@gmail.com",
      recipientEmailUpdated: true,
    });
    const props = renderDialog();

    await user.click(screen.getByRole("combobox", { name: "Kirim ke" }));
    await user.click(await screen.findByRole("option", { name: /Email lain/ }));

    const input = screen.getByLabelText("Email tujuan");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveClass("text-base");
    await user.type(input, "dias@gmail");
    await user.tab();
    expect(await screen.findByText("Format email belum benar. Contoh: nama@gmail.com")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");

    await user.click(screen.getByRole("button", { name: "Kirim email" }));
    expect(resendVoucherEmailMock).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, "dias.benar@gmail.com");
    expect(screen.queryByText(/Format email belum benar/)).toBeNull();
    await user.click(screen.getByRole("checkbox", { name: /Simpan sebagai email penerima/ }));
    await user.click(screen.getByRole("button", { name: "Kirim email" }));

    expect(resendVoucherEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ target: "CUSTOM", email: "dias.benar@gmail.com", saveAsRecipient: true })
    );
    expect(props.onSent).toHaveBeenCalledWith(
      "Voucher dikirim ulang ke dias.benar@gmail.com. Email penerima diganti."
    );
  });

  test("shows the rate limit inline and keeps the dialog open", async () => {
    const user = userEvent.setup();
    resendVoucherEmailMock.mockResolvedValue({ status: "rate_limited", retryAfterSeconds: 1200 });
    const props = renderDialog();
    await user.click(screen.getByRole("button", { name: "Kirim email" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Voucher ini sudah dikirim ulang 3 kali dalam 1 jam. Coba lagi 20 menit lagi."
    );
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });

  test("says Koneksi putus only when the request itself fails", async () => {
    const user = userEvent.setup();
    resendVoucherEmailMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Kirim email" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/^Koneksi putus/);

    resendVoucherEmailMock.mockResolvedValueOnce({ status: "provider_error" });
    await user.click(screen.getByRole("button", { name: "Kirim email" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Email ditolak penyedia email.")
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("Koneksi putus");
  });

  test("shows one option when buyer and recipient share an email", () => {
    renderDialog({ recipientEmail: "Buyer@gmail.com" });
    expect(screen.getByRole("combobox", { name: "Kirim ke" })).toHaveTextContent(
      "Penerima (sama dengan pembeli) · Buyer@gmail.com"
    );
  });

  test("defaults to Email lain when the voucher has no address", () => {
    renderDialog({ recipientEmail: null, buyerEmail: null });
    expect(screen.getByLabelText("Email tujuan")).toBeInTheDocument();
  });

  test("copies the WhatsApp link, then logs it, without sending anything", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    getVoucherWhatsAppLinkMock.mockResolvedValue({ status: "ok", url: "https://wa.me/6281211112222?text=hi" });
    recordCopiedMock.mockResolvedValue({ status: "ok" });
    const props = renderDialog();

    await user.click(screen.getByRole("button", { name: "Salin link WhatsApp" }));

    expect(getVoucherWhatsAppLinkMock).toHaveBeenCalledWith(
      expect.objectContaining({ target: "RECIPIENT" })
    );
    expect(writeText).toHaveBeenCalledWith("https://wa.me/6281211112222?text=hi");
    expect(recordCopiedMock).toHaveBeenCalledWith(expect.objectContaining({ target: "RECIPIENT" }));
    expect(writeText.mock.invocationCallOrder[0]).toBeLessThan(recordCopiedMock.mock.invocationCallOrder[0]);
    expect(props.onWhatsAppCopied).toHaveBeenCalled();
    expect(resendVoucherEmailMock).not.toHaveBeenCalled();
  });

  test("does not log a WhatsApp copy when the clipboard write fails", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    getVoucherWhatsAppLinkMock.mockResolvedValue({ status: "ok", url: "https://wa.me/6281211112222?text=hi" });
    const props = renderDialog();

    await user.click(screen.getByRole("button", { name: "Salin link WhatsApp" }));

    expect(await screen.findByText(/Link WhatsApp gagal disalin/)).toBeInTheDocument();
    expect(recordCopiedMock).not.toHaveBeenCalled();
    expect(props.onWhatsAppCopied).not.toHaveBeenCalled();
  });

  test("says the copy was not logged when the audit write fails", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    getVoucherWhatsAppLinkMock.mockResolvedValue({ status: "ok", url: "https://wa.me/6281211112222?text=hi" });
    recordCopiedMock.mockResolvedValue({ status: "error" });
    const props = renderDialog();

    await user.click(screen.getByRole("button", { name: "Salin link WhatsApp" }));

    expect(
      await screen.findByText("Link WhatsApp sudah disalin, tapi catatannya gagal disimpan.")
    ).toBeInTheDocument();
    expect(props.onWhatsAppCopied).not.toHaveBeenCalled();
  });

  test("the WhatsApp button stays busy until the copy is logged", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    getVoucherWhatsAppLinkMock.mockResolvedValue({ status: "ok", url: "https://wa.me/6281211112222?text=hi" });
    let finishLog: (value: { status: "ok" }) => void = () => undefined;
    recordCopiedMock.mockReturnValue(new Promise((resolve) => (finishLog = resolve)));
    renderDialog();

    const button = screen.getByRole("button", { name: "Salin link WhatsApp" });
    await user.click(button);
    await waitFor(() => expect(recordCopiedMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Kirim email" })).toBeDisabled();
    await user.click(button);
    expect(recordCopiedMock).toHaveBeenCalledTimes(1);
    finishLog({ status: "ok" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Kirim email" })).toBeEnabled());
  });

  test("sent but not logged closes the dialog and says not to resend", async () => {
    const user = userEvent.setup();
    resendVoucherEmailMock.mockResolvedValue({ status: "sent_not_logged", to: "dias@gmail.com" });
    const props = renderDialog();

    await user.click(screen.getByRole("button", { name: "Kirim email" }));

    await waitFor(() =>
      expect(props.onSent).toHaveBeenCalledWith(
        "Voucher terkirim ke dias@gmail.com, tapi catatannya gagal disimpan. Jangan kirim ulang lagi."
      )
    );
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  test("a retry after a dropped connection reuses the request id, even through a cooldown", async () => {
    const user = userEvent.setup();
    resendVoucherEmailMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ status: "cooldown", retryAfterSeconds: 40 })
      .mockResolvedValueOnce({ status: "provider_error" })
      .mockResolvedValueOnce({ status: "sent", to: "dias@gmail.com", recipientEmailUpdated: false });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Kirim email" }));
    expect(await screen.findByText(/Koneksi putus/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Kirim email" }));
    await screen.findByText(/Tunggu 40 detik/);
    await user.click(screen.getByRole("button", { name: "Kirim email" }));
    await screen.findByText(/ditolak penyedia email/);
    await user.click(screen.getByRole("button", { name: "Kirim email" }));

    const ids = resendVoucherEmailMock.mock.calls.map(([input]) => input.requestId);
    expect(ids[1]).toBe(ids[0]);
    expect(ids[2]).toBe(ids[0]);
    expect(ids[3]).not.toBe(ids[2]);
  });
});
