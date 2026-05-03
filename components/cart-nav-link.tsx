"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShoppingBag01Icon } from "@hugeicons/core-free-icons";
import { useCartStore } from "@/store/cart-store";
import { cn } from "@/lib/utils";

interface CartNavLinkProps {
  className?: string;
  style?: CSSProperties;
  label?: string;
  showLabel?: boolean;
  onClick?: () => void;
}

export function CartNavLink({
  className,
  style,
  label = "Keranjang",
  showLabel = true,
  onClick,
}: CartNavLinkProps) {
  const itemCount = useCartStore((state) => state.items.length);

  return (
    <Link
      href="/checkout/cart"
      onClick={onClick}
      className={cn("flex items-center gap-1", className)}
      style={style}
      aria-label={`Keranjang belanja, ${itemCount} voucher`}
    >
      <span className="relative inline-flex shrink-0">
        <HugeiconsIcon
          icon={ShoppingBag01Icon}
          size={16}
          className="shrink-0"
          aria-hidden
        />
        {itemCount > 0 ? (
          <span
            className={cn(
              "absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[9px] font-semibold leading-none",
              "bg-destructive text-destructive-foreground ring-2 ring-background",
            )}
          >
            {itemCount > 99 ? "99+" : itemCount}
          </span>
        ) : null}
      </span>
      {showLabel ? <span>{label}</span> : null}
    </Link>
  );
}
