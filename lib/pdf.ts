import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { APP_CONFIG } from "./constants";

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

// Design System Colors (exact match to globals.css)
const COLORS = {
  sage900: [52, 63, 44] as [number, number, number],
  sage800: [61, 73, 50] as [number, number, number],
  sage600: [93, 112, 72] as [number, number, number],
  sage500: [119, 140, 93] as [number, number, number],
  sage300: [179, 192, 161] as [number, number, number],
  sage100: [232, 235, 227] as [number, number, number],
  sand100: [243, 239, 232] as [number, number, number],
  sand200: [230, 221, 208] as [number, number, number],
  sand300: [213, 198, 177] as [number, number, number],
  sand900: [93, 74, 59] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

// Draw ornate corner flourish
function drawCornerFlourish(
  doc: jsPDF,
  x: number,
  y: number,
  rotation: number,
  color: [number, number, number]
) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);

  const size = 12;
  const cos = Math.cos((rotation * Math.PI) / 180);
  const sin = Math.sin((rotation * Math.PI) / 180);

  const transform = (px: number, py: number) => ({
    x: x + px * cos - py * sin,
    y: y + px * sin + py * cos,
  });

  // Main curl
  const p1 = transform(0, 0);
  const p2 = transform(size, 0);
  const p3 = transform(size, size * 0.3);
  doc.line(p1.x, p1.y, p2.x, p2.y);
  doc.line(p2.x, p2.y, p3.x, p3.y);

  // Inner decorative curl
  const p4 = transform(size * 0.4, size * 0.4);
  const p5 = transform(size * 0.7, size * 0.15);
  doc.line(p4.x, p4.y, p5.x, p5.y);
}

// Draw ornate border frame
function drawOrnateBorder(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  color: [number, number, number]
) {
  doc.setDrawColor(...color);

  // Outer rectangle
  doc.setLineWidth(0.8);
  doc.rect(x, y, width, height);

  // Inner rectangle (double border effect)
  doc.setLineWidth(0.3);
  doc.rect(x + 3, y + 3, width - 6, height - 6);

  // Corner flourishes
  drawCornerFlourish(doc, x + 6, y + 6, 0, color);
  drawCornerFlourish(doc, x + width - 6, y + 6, 90, color);
  drawCornerFlourish(doc, x + width - 6, y + height - 6, 180, color);
  drawCornerFlourish(doc, x + 6, y + height - 6, 270, color);
}

// Draw decorative leaf motif
function drawLeafMotif(
  doc: jsPDF,
  x: number,
  y: number,
  scale: number,
  color: [number, number, number],
  mirror: boolean = false
) {
  doc.setDrawColor(...color);
  doc.setFillColor(...color);
  doc.setLineWidth(0.2);

  const dir = mirror ? -1 : 1;

  // Main leaf shape (simplified)
  const leafLength = 8 * scale;
  const leafWidth = 3 * scale;

  // Stem
  doc.line(x, y, x + dir * leafLength * 0.3, y - leafWidth * 0.5);

  // Leaf curves (approximated with lines)
  doc.line(x + dir * leafLength * 0.3, y - leafWidth * 0.5, x + dir * leafLength, y);
  doc.line(x + dir * leafLength * 0.3, y - leafWidth * 0.5, x + dir * leafLength * 0.6, y + leafWidth * 0.3);
}

// Draw decorative divider with leaf ornament
function drawOrnamentDivider(
  doc: jsPDF,
  y: number,
  pageWidth: number,
  margin: number,
  color: [number, number, number]
) {
  const centerX = pageWidth / 2;
  const lineLength = 50;

  doc.setDrawColor(...color);
  doc.setLineWidth(0.4);

  // Left line
  doc.line(centerX - lineLength - 8, y, centerX - 8, y);

  // Right line
  doc.line(centerX + 8, y, centerX + lineLength + 8, y);

  // Center leaf motifs
  drawLeafMotif(doc, centerX - 4, y, 0.5, color, true);
  drawLeafMotif(doc, centerX + 4, y, 0.5, color, false);
}

// Draw elegant value box
function drawValueBox(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  value: string
) {
  // Background
  doc.setFillColor(...COLORS.sage100);
  doc.roundedRect(x, y, width, height, 2, 2, "F");

  // Border
  doc.setDrawColor(...COLORS.sage500);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, width, height, 2, 2, "S");

  // Inner decorative line
  doc.setLineWidth(0.2);
  doc.roundedRect(x + 2, y + 2, width - 4, height - 4, 1, 1, "S");

  // Value text
  doc.setTextColor(...COLORS.sage800);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Value", x + 10, y + height / 2 + 1);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(value, x + width - 10, y + height / 2 + 2, { align: "right" });
}

// Load and convert image to base64
async function loadImageAsBase64(imagePath: string): Promise<string> {
  try {
    const response = await fetch(imagePath);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

export async function generateVoucherPDF(data: VoucherPDFData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // =========================================================================
  // BACKGROUND
  // =========================================================================
  doc.setFillColor(...COLORS.sand100);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Subtle gradient effect (top)
  doc.setFillColor(...COLORS.sage100);
  doc.rect(0, 0, pageWidth, 8, "F");

  // =========================================================================
  // MAIN ORNATE BORDER
  // =========================================================================
  drawOrnateBorder(doc, margin - 5, margin - 5, contentWidth + 10, pageHeight - margin * 2 + 10, COLORS.sage600);

  // Inner content frame
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(margin + 5, margin + 5, contentWidth - 10, pageHeight - margin * 2 - 10, 3, 3, "F");

  // =========================================================================
  // HEADER SECTION
  // =========================================================================
  const headerY = margin + 15;

  // Try to load logo
  try {
    const logoBase64 = await loadImageAsBase64("/logo-kalanara-dark.png");
    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", pageWidth / 2 - 25, headerY, 50, 15);
    } else {
      // Fallback to text logo
      doc.setTextColor(...COLORS.sage800);
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.text("KALANARA", pageWidth / 2, headerY + 10, { align: "center" });
    }
  } catch {
    // Fallback to text logo
    doc.setTextColor(...COLORS.sage800);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("KALANARA", pageWidth / 2, headerY + 10, { align: "center" });
  }

  // Tagline
  doc.setTextColor(...COLORS.sage600);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Luxury Spa & Wellness", pageWidth / 2, headerY + 22, { align: "center" });

  // Decorative divider
  drawOrnamentDivider(doc, headerY + 30, pageWidth, margin, COLORS.sage500);

  // =========================================================================
  // GIFT VOUCHER TITLE
  // =========================================================================
  const titleY = headerY + 45;

  // Leaf decorations
  drawLeafMotif(doc, pageWidth / 2 - 45, titleY - 2, 0.8, COLORS.sage500, true);
  drawLeafMotif(doc, pageWidth / 2 + 45, titleY - 2, 0.8, COLORS.sage500, false);

  doc.setTextColor(...COLORS.sage800);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("GIFT VOUCHER", pageWidth / 2, titleY, { align: "center" });

  // Decorative line under title
  doc.setDrawColor(...COLORS.sand300);
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 35, titleY + 5, pageWidth / 2 + 35, titleY + 5);

  // =========================================================================
  // SERVICE INFORMATION
  // =========================================================================
  const serviceY = titleY + 20;

  doc.setTextColor(...COLORS.sage900);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.serviceName, pageWidth / 2, serviceY, { align: "center" });

  doc.setTextColor(...COLORS.sage600);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.duration} minutes of pure relaxation`, pageWidth / 2, serviceY + 8, {
    align: "center",
  });

  // Service description if available
  if (data.serviceDescription) {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.sand900);
    const descLines = doc.splitTextToSize(data.serviceDescription, contentWidth - 40);
    doc.text(descLines.slice(0, 2), pageWidth / 2, serviceY + 16, { align: "center" });
  }

  // =========================================================================
  // RECIPIENT SECTION
  // =========================================================================
  const recipientY = serviceY + 35;

  // Decorative box for recipient info
  doc.setFillColor(...COLORS.sage100);
  doc.roundedRect(margin + 20, recipientY - 5, contentWidth - 40, 35, 2, 2, "F");

  doc.setTextColor(...COLORS.sage600);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Presented to", pageWidth / 2, recipientY + 3, { align: "center" });

  doc.setTextColor(...COLORS.sage900);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(data.recipientName, pageWidth / 2, recipientY + 12, { align: "center" });

  doc.setTextColor(...COLORS.sage600);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`With love from ${data.senderName}`, pageWidth / 2, recipientY + 22, {
    align: "center",
  });

  // Gift message
  if (data.senderMessage) {
    const messageY = recipientY + 40;
    doc.setTextColor(...COLORS.sand900);
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");

    // Decorative quotes
    doc.setFontSize(16);
    doc.text('"', margin + 25, messageY);

    doc.setFontSize(9);
    const messageLines = doc.splitTextToSize(data.senderMessage, contentWidth - 60);
    doc.text(messageLines.slice(0, 2), pageWidth / 2, messageY, { align: "center" });

    doc.setFontSize(16);
    doc.text('"', pageWidth - margin - 25, messageY + (messageLines.length > 1 ? 5 : 0), {
      align: "right",
    });
  }

  // =========================================================================
  // QR CODE SECTION
  // =========================================================================
  const qrY = recipientY + (data.senderMessage ? 60 : 45);

  // QR Code
  const qrDataUrl = await QRCode.toDataURL(data.code, {
    width: 300,
    margin: 1,
    color: {
      dark: "#343f2c", // sage-900
      light: "#f3efe8", // sand-100
    },
  });

  // QR background frame
  doc.setFillColor(...COLORS.sand100);
  doc.roundedRect(pageWidth / 2 - 27, qrY - 2, 54, 54, 2, 2, "F");
  doc.setDrawColor(...COLORS.sage500);
  doc.setLineWidth(0.3);
  doc.roundedRect(pageWidth / 2 - 27, qrY - 2, 54, 54, 2, 2, "S");

  doc.addImage(qrDataUrl, "PNG", pageWidth / 2 - 25, qrY, 50, 50);

  // Voucher code
  const codeY = qrY + 58;
  doc.setTextColor(...COLORS.sage800);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(data.code, pageWidth / 2, codeY, { align: "center" });

  doc.setTextColor(...COLORS.sage600);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Scan QR code or present this voucher to redeem", pageWidth / 2, codeY + 6, {
    align: "center",
  });

  // =========================================================================
  // VALUE BOX
  // =========================================================================
  const valueY = codeY + 15;
  const valueText = `Rp ${data.amount.toLocaleString("id-ID")}`;
  drawValueBox(doc, margin + 30, valueY, contentWidth - 60, 18, valueText);

  // =========================================================================
  // VALIDITY DATES
  // =========================================================================
  const validityY = valueY + 28;

  doc.setTextColor(...COLORS.sage600);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  doc.text(`Purchased: ${formatDate(data.purchaseDate)}`, margin + 20, validityY);
  doc.text(`Valid until: ${formatDate(data.expiryDate)}`, pageWidth - margin - 20, validityY, {
    align: "right",
  });

  // =========================================================================
  // CONTACT INFORMATION
  // =========================================================================
  const contactY = validityY + 12;

  // Contact box
  doc.setFillColor(...COLORS.sage100);
  doc.roundedRect(margin + 15, contactY - 3, contentWidth - 30, 22, 2, 2, "F");

  doc.setTextColor(...COLORS.sage800);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Visit Us", pageWidth / 2, contactY + 3, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.sage600);
  doc.setFontSize(7);
  doc.text(APP_CONFIG.contact.address, pageWidth / 2, contactY + 9, { align: "center" });
  doc.text(
    `${APP_CONFIG.contact.phone}  |  ${APP_CONFIG.contact.email}`,
    pageWidth / 2,
    contactY + 14,
    { align: "center" }
  );

  // =========================================================================
  // HOW TO REDEEM
  // =========================================================================
  const redeemY = contactY + 28;

  doc.setTextColor(...COLORS.sage800);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("How to Redeem", pageWidth / 2, redeemY, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.sage600);

  const steps = [
    "1. Contact us via WhatsApp or call to book your appointment",
    "2. Present this voucher (digital or printed) upon arrival",
    "3. Relax and enjoy your spa experience",
  ];

  steps.forEach((step, index) => {
    doc.text(step, pageWidth / 2, redeemY + 7 + index * 5, { align: "center" });
  });

  // =========================================================================
  // FOOTER - TERMS
  // =========================================================================
  const footerY = pageHeight - margin - 15;

  // Decorative divider
  doc.setDrawColor(...COLORS.sage300);
  doc.setLineWidth(0.3);
  doc.line(margin + 20, footerY - 5, pageWidth - margin - 20, footerY - 5);

  doc.setTextColor(...COLORS.sand900);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");

  const terms = [
    "This voucher is non-refundable and cannot be exchanged for cash.",
    "Valid for one-time use only. Please book in advance to ensure availability.",
    `© ${new Date().getFullYear()} ${APP_CONFIG.name}. All rights reserved.`,
  ];

  terms.forEach((term, index) => {
    doc.text(term, pageWidth / 2, footerY + index * 4, { align: "center" });
  });

  // Bottom decorative border
  doc.setFillColor(...COLORS.sage600);
  doc.rect(margin - 5, pageHeight - margin + 3, contentWidth + 10, 2, "F");

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
