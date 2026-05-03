"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/cart-store";

interface CartNavLinkProps {
  className?: string;
  label?: string;
  showLabel?: boolean;
  onClick?: () => void;
}

export function CartNavLink({
  className,
  label = "Keranjang",
  showLabel = true,
  onClick,
}: CartNavLinkProps) {
  const itemCount = useCartStore((state) => state.items.length);

  return (
    <Link
      href="/checkout/cart"
      onClick={onClick}
      className={className}
      aria-label={`Keranjang belanja, ${itemCount} voucher`}
    >
      <span className="relative inline-flex">
        <ShoppingBag size={18} aria-hidden="true" />
        {itemCount > 0 ? (
          <span className="absolute -right-2 -top-2 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
            {itemCount > 99 ? "99+" : itemCount}
          </span>
        ) : null}
      </span>
      {showLabel ? <span>{label}</span> : null}
    </Link>
  );
}
