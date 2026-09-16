import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { ToastProvider } from "@/context/ToastContext";
import type { Service } from "@/lib/types";

const service: Service = {
  id: "svc-1",
  name: "Balinese Massage",
  description: "Traditional balinese massage",
  duration: 60,
  price: 150000,
  category: {
    id: "massage",
    slug: "massage",
    name: "Massage",
    isActive: true,
  },
  image: "/images/services/balinese.jpg",
};

function renderButton(
  props: Partial<ComponentProps<typeof AddToCartButton>> = {},
) {
  return render(
    <ToastProvider>
      <AddToCartButton service={service} {...props} />
    </ToastProvider>,
  );
}

describe("AddToCartButton", () => {
  it("gives the catalog CTA a 44px hit target and horizontal padding", () => {
    renderButton({ layout: "card" });

    const button = screen.getByRole("button", { name: "Tambah ke Keranjang" });

    expect(button.className).toContain("min-h-11");
    expect(button.className).toContain("px-4");
    expect(button.className).toContain("has-[>svg]:px-4");
    expect(button.className).toContain("gap-2");
  });

  it("keeps the featured voucher CTA tappable on a stacked mobile row", () => {
    renderButton({ layout: "featured" });

    const button = screen.getByRole("button", { name: "Tambah ke Keranjang" });

    expect(button.className).toContain("min-h-11");
    expect(button.className).toContain("px-4");
    expect(button.className).toContain("whitespace-normal");
  });
});
