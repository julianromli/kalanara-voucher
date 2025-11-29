import { jsPDF } from "jspdf";
import QRCode from "qrcode";

interface VoucherPDFData {
  code: string;
  serviceName: string;
  serviceDescription?: string;
  duration: number;
  amount: number;
  recipientName: string;
  senderName: string;
  senderMessage?: string;
  expiryDate: string;
  purchaseDate: string;
}

export async function generateVoucherPDF(data: VoucherPDFData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const sageColor = [75, 85, 72] as [number, number, number]; // sage-800
  const sandColor = [245, 241, 235] as [number, number, number]; // sand-100
  const goldColor = [180, 155, 120] as [number, number, number]; // warm accent

  // Background
  doc.setFillColor(...sandColor);
  doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), "F");

  // Header banner
  doc.setFillColor(...sageColor);
  doc.rect(0, 0, pageWidth, 50, "F");

  // Logo text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("KALANARA", pageWidth / 2, 25, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Luxury Spa & Wellness", pageWidth / 2, 35, { align: "center" });

  // Gift Voucher title
  doc.setTextColor(...goldColor);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("GIFT VOUCHER", pageWidth / 2, 70, { align: "center" });

  // Decorative line
  doc.setDrawColor(...goldColor);
  doc.setLineWidth(0.5);
  doc.line(margin + 40, 78, pageWidth - margin - 40, 78);

  // Service name
  doc.setTextColor(...sageColor);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(data.serviceName, pageWidth / 2, 95, { align: "center" });

  // Duration
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.duration} minutes of relaxation`, pageWidth / 2, 105, {
    align: "center",
  });

  // Recipient section
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("For:", margin, 125);
  doc.setFont("helvetica", "normal");
  doc.text(data.recipientName, margin + 15, 125);

  doc.setFont("helvetica", "bold");
  doc.text("From:", margin, 135);
  doc.setFont("helvetica", "normal");
  doc.text(data.senderName, margin + 18, 135);

  // Gift message if present
  if (data.senderMessage) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    const messageLines = doc.splitTextToSize(
      `"${data.senderMessage}"`,
      contentWidth
    );
    doc.text(messageLines, pageWidth / 2, 150, { align: "center" });
  }

  // QR Code
  const qrDataUrl = await QRCode.toDataURL(data.code, {
    width: 200,
    margin: 1,
    color: {
      dark: "#4B5548",
      light: "#F5F1EB",
    },
  });
  doc.addImage(qrDataUrl, "PNG", pageWidth / 2 - 25, 165, 50, 50);

  // Voucher code
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...sageColor);
  doc.text(data.code, pageWidth / 2, 225, { align: "center" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Scan QR code or enter code to redeem", pageWidth / 2, 232, {
    align: "center",
  });

  // Value box
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, 245, contentWidth, 25, 3, 3, "F");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Value:", margin + 10, 258);
  doc.setFontSize(16);
  doc.text(
    `Rp ${data.amount.toLocaleString("id-ID")}`,
    pageWidth - margin - 10,
    258,
    { align: "right" }
  );

  // Footer details
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);

  const footerY = 280;
  doc.text(`Purchase Date: ${formatDate(data.purchaseDate)}`, margin, footerY);
  doc.text(`Valid Until: ${formatDate(data.expiryDate)}`, pageWidth - margin, footerY, {
    align: "right",
  });

  // Terms
  doc.setFontSize(7);
  doc.text(
    "This voucher is non-refundable and cannot be exchanged for cash.",
    pageWidth / 2,
    290,
    { align: "center" }
  );
  doc.text(
    "Please present this voucher (digital or printed) upon arrival.",
    pageWidth / 2,
    295,
    { align: "center" }
  );

  return doc.output("blob");
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function downloadPDF(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
