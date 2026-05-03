"use client";

import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/context/ToastContext";
import type { Service } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";

interface AddToCartButtonProps {
  service: Service;
  className?: string;
  iconClassName?: string;
  size?: "default" | "sm" | "lg";
  children?: React.ReactNode;
}

export function AddToCartButton({
  service,
  className,
  iconClassName,
  size = "default",
  children = "Tambah ke Keranjang",
}: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem);
  const { showToast } = useToast();

  const handleAddToCart = () => {
    addItem(service);
    showToast("Voucher ditambahkan ke keranjang. Buka keranjang dari menu atas.", "success");
  };

  return (
    <Button
      type="button"
      size={size}
      onClick={handleAddToCart}
      className={className}
    >
      <ShoppingBag className={cn("size-4", iconClassName)} aria-hidden="true" />
      {children}
    </Button>
  );
}
