"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { ShoppingBag01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { useToast } from "@/context/ToastContext";
import type { Service } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";

export type AddToCartLayout = "default" | "card" | "featured";

const layoutConfig: Record<
  AddToCartLayout,
  { buttonSize: "default" | "sm" | "lg"; className: string; iconSize: number }
> = {
  default: {
    buttonSize: "default",
    className: "",
    iconSize: 16,
  },
  card: {
    buttonSize: "sm",
    className:
      "h-auto w-full gap-2 px-4 py-2.5 text-xs font-medium md:min-h-10 md:py-3 md:text-sm",
    iconSize: 16,
  },
  featured: {
    buttonSize: "default",
    className:
      "btn-hover-lift h-auto w-full gap-2 py-0 leading-[0] text-base font-medium",
    iconSize: 20,
  },
};

interface AddToCartButtonProps {
  service: Service;
  /** `card`: grid paket di beranda · `featured`: blok harga di halaman voucher */
  layout?: AddToCartLayout;
  className?: string;
  iconClassName?: string;
  size?: "default" | "sm" | "lg";
  children?: React.ReactNode;
}

export function AddToCartButton({
  service,
  layout = "default",
  className,
  iconClassName,
  size,
  children = "Tambah ke Keranjang",
}: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem);
  const { showToast } = useToast();

  const preset = layoutConfig[layout];
  const buttonSize = size ?? preset.buttonSize;

  const handleAddToCart = () => {
    addItem(service);
    showToast("Voucher ditambahkan ke keranjang. Buka keranjang dari menu atas.", "success");
  };

  return (
    <Button
      type="button"
      variant="default"
      size={buttonSize}
      onClick={handleAddToCart}
      className={cn(preset.className, className)}
    >
      <HugeiconsIcon
        icon={ShoppingBag01Icon}
        size={preset.iconSize}
        className={cn("shrink-0", iconClassName)}
        aria-hidden
      />
      {children}
    </Button>
  );
}
