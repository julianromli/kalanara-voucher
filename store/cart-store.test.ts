import { beforeEach, describe, expect, test } from "vitest";
import type { CartItem } from "@/store/cart-store";
import { useCartStore } from "@/store/cart-store";

function createCartItem(id: string, serviceId: string): CartItem {
  return {
    id,
    service: {
      id: serviceId,
      name: `Service ${serviceId}`,
      description: "Voucher spa",
      duration: 60,
      price: 100000,
    },
  };
}

describe("useCartStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useCartStore.setState({ items: [], pendingCheckout: null });
  });

  test("completes pending checkout without removing unrelated items", () => {
    useCartStore.setState({
      items: [
        createCartItem("cart-1", "service-1"),
        createCartItem("cart-2", "service-2"),
        createCartItem("cart-3", "service-3"),
      ],
      pendingCheckout: null,
    });

    useCartStore.getState().startPendingCheckout("KSP-123", ["cart-1", "cart-3", "cart-1"]);
    useCartStore.getState().completePendingCheckout("KSP-123");

    expect(useCartStore.getState().pendingCheckout).toBeNull();
    expect(useCartStore.getState().items.map((item) => item.id)).toEqual(["cart-2"]);
  });

  test("does not clear pending checkout for a different order id", () => {
    useCartStore.setState({
      items: [createCartItem("cart-1", "service-1")],
      pendingCheckout: {
        paymentOrderId: "KSP-123",
        cartItemIds: ["cart-1"],
        createdAt: 1,
      },
    });

    useCartStore.getState().clearPendingCheckout("KSP-999");

    expect(useCartStore.getState().pendingCheckout).toEqual({
      paymentOrderId: "KSP-123",
      cartItemIds: ["cart-1"],
      createdAt: 1,
    });
  });
});
