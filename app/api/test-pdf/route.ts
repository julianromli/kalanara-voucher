import { NextResponse } from "next/server";
import { generateVoucherPDF } from "@/lib/pdf";

export async function GET() {
  try {
    const sampleData = {
      code: "F2Q7N",
      serviceName: "Me Time 90 Menit",
      recipientName: "Lutvia",
      senderName: "Faiz Intifada",
      senderMessage: "Halo aku sayang kamu Halo aku sayang kamu Halo aku sayang kamu Halo aku sayang kamu Halo aku sayang kamu Halo aku sayang kamu Halo aku sayang kamu Halo aku sayang kamu",
      expiryDate: "2026-03-13",
    };

    const blob = await generateVoucherPDF(sampleData);
    const arrayBuffer = await blob.arrayBuffer();
    
    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=sample-voucher.pdf",
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
