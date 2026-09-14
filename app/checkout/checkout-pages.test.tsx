import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ScalevCheckoutConfig } from "@/lib/scalev/types";

const {
  getServiceByIdMock,
  getScalevCheckoutConfigMock,
  checkoutPageClientMock,
  cartCheckoutClientMock,
} = vi.hoisted(() => ({
  getServiceByIdMock: vi.fn(),
  getScalevCheckoutConfigMock: vi.fn(),
  checkoutPageClientMock: vi.fn(),
  cartCheckoutClientMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not found");
  }),
}));

vi.mock("@/lib/actions/services", () => ({
  getServiceById: getServiceByIdMock,
}));

vi.mock("@/lib/scalev/checkout-config", () => ({
  getScalevCheckoutConfig: getScalevCheckoutConfigMock,
}));

vi.mock("@/lib/utils/serviceImages", () => ({
  resolveServiceImageUrl: (url: string | null) => url ?? "",
}));

vi.mock("@/app/checkout/[id]/checkout-page-client", () => ({
  CheckoutPageClient: checkoutPageClientMock,
}));

vi.mock("@/app/checkout/cart/cart-checkout-client", () => ({
  CartCheckoutClient: cartCheckoutClientMock,
}));

const initialPaymentConfig: ScalevCheckoutConfig = {
  storeUniqueId: "store-123",
  paymentOptions: [{ code: "qris", label: "QRIS" }],
};

describe("checkout payment option preloading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getScalevCheckoutConfigMock.mockResolvedValue(initialPaymentConfig);
  });

  test("starts single-service and payment config fetches concurrently", async () => {
    const { default: CheckoutPage } = await import(
      "@/app/checkout/[id]/page"
    );
    let resolveService:
      | ((service: {
          id: string;
          name: string;
          description: string;
          duration: number;
          price: number;
          is_active: boolean;
          category_id: string;
          category_relation: null;
          image_url: null;
        }) => void)
      | undefined;
    getServiceByIdMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveService = resolve;
        })
    );

    const pagePromise = CheckoutPage({
      params: Promise.resolve({ id: "service-1" }),
    });

    await vi.waitFor(() => {
      expect(getServiceByIdMock).toHaveBeenCalledWith("service-1");
      expect(getScalevCheckoutConfigMock).toHaveBeenCalledTimes(1);
    });

    resolveService?.({
      id: "service-1",
      name: "Balinese Massage",
      description: "Relaxing treatment",
      duration: 90,
      price: 450000,
      is_active: true,
      category_id: "massage",
      category_relation: null,
      image_url: null,
    });

    const element = await pagePromise;
    expect(element.props.initialPaymentConfig).toEqual(initialPaymentConfig);
    expect(element.props.service).toEqual(
      expect.objectContaining({ id: "service-1" })
    );
  });

  test("passes the preloaded config to cart checkout", async () => {
    const { default: CartCheckoutPage } = await import(
      "@/app/checkout/cart/page"
    );

    const element = await CartCheckoutPage();

    expect(getScalevCheckoutConfigMock).toHaveBeenCalledTimes(1);
    expect(element.props.initialPaymentConfig).toEqual(initialPaymentConfig);
  });
});
