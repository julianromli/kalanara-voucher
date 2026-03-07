import {
  buildPaymentSnapshot,
  mapScalevPaymentMethodToLocal,
  normalizeScalevStatus,
} from "@/lib/scalev/mappers";

describe("normalizeScalevStatus", () => {
  it("maps paid and settled states to COMPLETED", () => {
    expect(normalizeScalevStatus("paid", "confirmed")).toBe("COMPLETED");
    expect(normalizeScalevStatus("settled", "completed")).toBe("COMPLETED");
  });

  it("maps cancelled and expired states to FAILED", () => {
    expect(normalizeScalevStatus("expired", "pending")).toBe("FAILED");
    expect(normalizeScalevStatus("unpaid", "closed")).toBe("FAILED");
  });

  it("keeps conflict states as pending", () => {
    expect(normalizeScalevStatus("conflict", "confirmed")).toBe("PENDING");
  });

  it("maps refund states to REFUNDED", () => {
    expect(normalizeScalevStatus("refunded", "completed")).toBe("REFUNDED");
  });
});

describe("mapScalevPaymentMethodToLocal", () => {
  it("maps va and invoice to BANK_TRANSFER", () => {
    expect(mapScalevPaymentMethodToLocal("va")).toBe("BANK_TRANSFER");
    expect(mapScalevPaymentMethodToLocal("invoice")).toBe("BANK_TRANSFER");
  });

  it("maps qris and wallets to E_WALLET", () => {
    expect(mapScalevPaymentMethodToLocal("qris")).toBe("E_WALLET");
    expect(mapScalevPaymentMethodToLocal("gopay")).toBe("E_WALLET");
  });

  it("maps card to CREDIT_CARD", () => {
    expect(mapScalevPaymentMethodToLocal("card")).toBe("CREDIT_CARD");
  });
});

describe("buildPaymentSnapshot", () => {
  it("prefers payment payload values and normalizes the result", () => {
    const snapshot = buildPaymentSnapshot(
      {
        id: 123,
        order_id: "ORD-1",
        payment_status: "paid",
        status: "completed",
        pg_reference_id: "PG-1",
        payment_method: "qris",
        sub_payment_method: null,
        invoice_url: "https://example.com/pay",
      },
      null
    );

    expect(snapshot.orderPk).toBe(123);
    expect(snapshot.orderId).toBe("ORD-1");
    expect(snapshot.pgReferenceId).toBe("PG-1");
    expect(snapshot.paymentMethod).toBe("qris");
    expect(snapshot.normalizedStatus).toBe("COMPLETED");
    expect(snapshot.paymentLink).toBe("https://example.com/pay");
  });

  it("builds a hosted Scalev URL when only secret_slug is returned", () => {
    const snapshot = buildPaymentSnapshot(
      {
        id: 456,
        order_id: "ORD-2",
        payment_status: "pending",
        status: "created",
        secret_slug: "secret-token",
      },
      null
    );

    expect(snapshot.paymentLink).toBe(
      "https://app.scalev.id/order/public/secret-token/success"
    );
  });
});
