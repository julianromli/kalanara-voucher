import {
  buildPaymentSnapshot,
  buildPublicOrderStatusWithItems,
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
        paid_time: "2026-09-14T11:58:00.000Z",
      },
      null
    );

    expect(snapshot.orderPk).toBe(123);
    expect(snapshot.orderId).toBe("ORD-1");
    expect(snapshot.pgReferenceId).toBe("PG-1");
    expect(snapshot.paymentMethod).toBe("qris");
    expect(snapshot.normalizedStatus).toBe("COMPLETED");
    expect(snapshot.paymentLink).toBe("https://example.com/pay");
    expect(snapshot.providerEventAt).toBe("2026-09-14T11:58:00.000Z");
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
      "https://app.scalev.id/order/public/secret-token"
    );
  });

  it("preserves a direct Scalev payment_link before using secret_slug", () => {
    const snapshot = buildPaymentSnapshot(
      {
        payment_status: "pending",
        payment_link: "https://scalev.example/direct",
        secret_slug: "fallback-secret",
      },
      null
    );

    expect(snapshot.paymentLink).toBe("https://scalev.example/direct");
  });

  it("extracts QRIS instructions from pg_payment_info when no hosted link is available", () => {
    const snapshot = buildPaymentSnapshot(
      {
        id: 789,
        order_id: "ORD-3",
        payment_status: "unpaid",
        status: "pending",
        pg_payment_info: {
          amount: 10000,
          payment_method: {
            qr_code: {
              amount: 10000,
              channel_code: "XENDIT",
              channel_properties: {
                expires_at: "2026-03-12T04:05:55.854402Z",
                qr_string: "00020101021226TESTQRSTRING6304ABCD",
              },
            },
          },
        },
      },
      null
    );

    expect(snapshot.paymentInstructions).toEqual({
      kind: "qris",
      amount: 10000,
      channelCode: "XENDIT",
      expiresAt: "2026-03-12T04:05:55.854402Z",
      qrString: "00020101021226TESTQRSTRING6304ABCD",
    });
  });

  it("chooses the first non-empty valid Scalev event timestamp", () => {
    const snapshot = buildPaymentSnapshot(
      {
        payment_status: "paid",
        settled_time: "not-a-date",
        paid_time: "2026-09-14T11:58:00.000Z",
      },
      null
    );

    expect(snapshot.providerEventAt).toBe("2026-09-14T11:58:00.000Z");
  });
});

describe("buildPublicOrderStatusWithItems", () => {
  it("orders public items deterministically by sort_order then created_at", () => {
    const baseItem = {
      voucher_id: null,
      vouchers: null,
      original_unit_price: 100,
      unit_price: 100,
    };
    const payload = buildPublicOrderStatusWithItems({
      id: "order-1",
      payment_status: "PENDING",
      payment_order_id: "KSP-1",
      order_items: [
        { ...baseItem, id: "item-3", sort_order: 2, created_at: "2026-01-01T00:00:00Z", services: { name: "Tiga", duration: 60 } },
        { ...baseItem, id: "item-2", sort_order: 1, created_at: "2026-01-02T00:00:00Z", services: { name: "Dua", duration: 60 } },
        { ...baseItem, id: "item-1", sort_order: 1, created_at: "2026-01-01T00:00:00Z", services: { name: "Satu", duration: 60 } },
      ],
    } as never);

    expect(payload.orderDetails?.items.map((item) => item.serviceName)).toEqual([
      "Satu", "Dua", "Tiga",
    ]);
  });
});
