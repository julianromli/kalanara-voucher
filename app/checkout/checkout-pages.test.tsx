import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
  getUnavailableScalevCheckoutConfig: () => ({
    availability: "unavailable",
    storeUniqueId: "",
    paymentOptions: [],
  }),
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
  availability: "available",
  storeUniqueId: "store-123",
  paymentOptions: [{ code: "qris", label: "QRIS" }],
};

describe("checkout payment option preloading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getScalevCheckoutConfigMock.mockResolvedValue(initialPaymentConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("loads payment config only after confirming the service exists", async () => {
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
    });
    expect(getScalevCheckoutConfigMock).not.toHaveBeenCalled();

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
    expect(getScalevCheckoutConfigMock).not.toHaveBeenCalled();
    const fallback = element.props.fallback.type(
      element.props.fallback.props
    );
    render(fallback);
    expect(
      screen.getByText("Sedang menyiapkan metode pembayaran.")
    ).toHaveClass("sr-only");

    const providerChild = element.props.children;
    const checkoutElement = await providerChild.type(providerChild.props);

    expect(getScalevCheckoutConfigMock).toHaveBeenCalledTimes(1);
    expect(checkoutElement.props.initialPaymentConfig).toEqual(initialPaymentConfig);
    expect(checkoutElement.props.service).toEqual(
      expect.objectContaining({ id: "service-1" })
    );
  });

  test("does not request provider config when the single service is missing", async () => {
    const { default: CheckoutPage } = await import(
      "@/app/checkout/[id]/page"
    );
    getServiceByIdMock.mockResolvedValue(null);

    await expect(
      CheckoutPage({ params: Promise.resolve({ id: "missing" }) })
    ).rejects.toThrow("not found");

    expect(getScalevCheckoutConfigMock).not.toHaveBeenCalled();
  });

  test("renders single-service checkout with unavailable config when preload fails", async () => {
    const { default: CheckoutPage } = await import(
      "@/app/checkout/[id]/page"
    );
    getServiceByIdMock.mockResolvedValue({
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
    const failure = new Error("provider down");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    getScalevCheckoutConfigMock.mockRejectedValue(failure);

    const element = await CheckoutPage({
      params: Promise.resolve({ id: "service-1" }),
    });
    const providerChild = element.props.children;
    const checkoutElement = await providerChild.type(providerChild.props);

    expect(checkoutElement.props.initialPaymentConfig).toEqual({
      availability: "unavailable",
      storeUniqueId: "",
      paymentOptions: [],
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[Scalev] Failed to preload single checkout config:",
      failure
    );
  });

  test("passes the preloaded config to cart checkout", async () => {
    const { default: CartCheckoutPage } = await import(
      "@/app/checkout/cart/page"
    );

    const element = await CartCheckoutPage();
    expect(getScalevCheckoutConfigMock).not.toHaveBeenCalled();
    const fallback = element.props.fallback.type(
      element.props.fallback.props
    );
    render(fallback);
    expect(
      screen.getByText("Sedang menyiapkan metode pembayaran.")
    ).toHaveClass("sr-only");

    const providerChild = element.props.children;
    const checkoutElement = await providerChild.type(providerChild.props);
    expect(getScalevCheckoutConfigMock).toHaveBeenCalledTimes(1);
    expect(checkoutElement.props.initialPaymentConfig).toEqual(initialPaymentConfig);
  });

  test("renders cart checkout with unavailable config when preload fails", async () => {
    const { default: CartCheckoutPage } = await import(
      "@/app/checkout/cart/page"
    );
    const failure = new Error("provider down");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    getScalevCheckoutConfigMock.mockRejectedValue(failure);

    const element = await CartCheckoutPage();
    const providerChild = element.props.children;
    const checkoutElement = await providerChild.type(providerChild.props);

    expect(checkoutElement.props.initialPaymentConfig).toEqual({
      availability: "unavailable",
      storeUniqueId: "",
      paymentOptions: [],
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[Scalev] Failed to preload cart checkout config:",
      failure
    );
  });
});
