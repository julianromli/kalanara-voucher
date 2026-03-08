import { NextRequest, NextResponse } from "next/server";
import { getPublicVoucherLookupByCode } from "@/lib/actions/vouchers";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "code is required" },
      { status: 400 }
    );
  }

  const voucher = await getPublicVoucherLookupByCode(code);
  if (!voucher) {
    return NextResponse.json(
      { found: false },
      { status: 404 }
    );
  }

  return NextResponse.json({
    found: true,
    voucher,
  });
}
