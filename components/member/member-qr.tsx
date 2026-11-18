"use client";

import QRCode from "react-qr-code";

interface MemberQrProps {
  value: string;
  size?: number;
}

export function MemberQr({ value, size = 196 }: MemberQrProps) {
  return (
    <div className="rounded-xl bg-white p-3">
      <QRCode value={value} size={size} style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
    </div>
  );
}
