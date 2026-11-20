"use client";

import QRCode from "react-qr-code";
import { cn } from "@/lib/utils";

interface MemberQrProps {
  value: string;
  size?: number;
  className?: string;
}

// One white box that hugs the QR and sits centered in whatever holds it.
// It shrinks with a narrow parent and never grows past the QR size.
export function MemberQr({ value, size = 196, className }: MemberQrProps) {
  return (
    <div
      className={cn("mx-auto w-full rounded-xl bg-white p-3", className)}
      style={{ maxWidth: size + 24 }}
    >
      <QRCode
        value={value}
        size={size}
        style={{ display: "block", height: "auto", width: "100%", maxWidth: size }}
      />
    </div>
  );
}
