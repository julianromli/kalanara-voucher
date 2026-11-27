import { describe, expect, test } from "vitest";
import { validateCheckoutRequest } from "@/lib/payment/checkout-validation";

const base = {
  customerName: "Tri",
  customerEmail: "tri@gmail.com",
  customerPhone: "081234567890",
  serviceId: "service-1",
  recipientName: "Dias",
  recipientEmail: "dias@gmail.com",
  deliveryMethod: "EMAIL",
  sendTo: "RECIPIENT",
};

describe("checkout email validation", () => {
  test("accepts valid buyer and recipient emails", () => {
    expect(validateCheckoutRequest(base)).not.toBeNull();
  });

  test("rejects a buyer email without a domain ending", () => {
    expect(validateCheckoutRequest({ ...base, customerEmail: "tri@gmail" })).toBeNull();
  });

  test("rejects a recipient email without a domain ending", () => {
    expect(validateCheckoutRequest({ ...base, recipientEmail: "dias@gmail" })).toBeNull();
  });

  test("one bad recipient email in a cart rejects the whole checkout", () => {
    const item = {
      serviceId: "service-1",
      recipientName: "Dias",
      recipientEmail: "dias@gmail.com",
      deliveryMethod: "EMAIL",
      sendTo: "RECIPIENT",
    };
    const cart = {
      customerName: base.customerName,
      customerEmail: base.customerEmail,
      customerPhone: base.customerPhone,
      lineItems: [item, { ...item, recipientEmail: "rani@yahoo" }],
    };
    expect(validateCheckoutRequest(cart)).toBeNull();
    expect(
      validateCheckoutRequest({ ...cart, lineItems: [item, { ...item, recipientEmail: "rani@yahoo.com" }] })?.lineItems
    ).toHaveLength(2);
  });
});
