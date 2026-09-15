import { connection, NextResponse } from "next/server";
import { getScalevCheckoutConfig } from "@/lib/scalev/checkout-config";

export async function GET() {
  await connection();

  try {
    return NextResponse.json({
      success: true,
      config: await getScalevCheckoutConfig(),
    });
  } catch (error) {
    console.error("[Scalev] Failed to load payment options:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal memuat metode pembayaran.",
      },
      { status: 500 }
    );
  }
}
