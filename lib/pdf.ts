import { jsPDF } from "jspdf";
import QRCode from "qrcode";

interface VoucherPDFData {
  code: string;
  serviceName: string;
  recipientName: string;
  senderName: string;
  senderMessage?: string;
  expiryDate: string;
}

// Design System Colors from Figma
const COLORS = {
  gold: [230, 191, 109] as [number, number, number], // #e6bf6d
  goldLight: [253, 230, 169] as [number, number, number], // #fde6a9
  goldBorder: [255, 226, 182] as [number, number, number], // #ffe2b6
  brown: [142, 115, 74] as [number, number, number], // #8e734a
  darkTeal: [36, 58, 62] as [number, number, number], // #243a3e
  white: [255, 255, 255] as [number, number, number],
  lightGray: [251, 251, 251] as [number, number, number], // #fbfbfb
  borderGray: [219, 219, 219] as [number, number, number], // #dbdbdb
  black: [0, 0, 0] as [number, number, number],
};

// Page dimensions from Figma (in px, using px as unit)
const PAGE_WIDTH = 1772;
const PAGE_HEIGHT = 1163;

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

// Format date to Indonesian format
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}


export async function generateVoucherPDF(data: VoucherPDFData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [PAGE_WIDTH, PAGE_HEIGHT],
  });

  // =========================================================================
  // BACKGROUND LAYER
  // =========================================================================
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");

  // Load background images
  try {
    const bgOverlay = await loadImageAsBase64("/voucher/bg-overlay.jpg");
    if (bgOverlay) {
      doc.addImage(bgOverlay, "JPEG", 0, 0, PAGE_WIDTH, 551);
    }

    const decorLeft = await loadImageAsBase64("/voucher/decor-left.png");
    if (decorLeft) {
      doc.addImage(decorLeft, "PNG", -31, 302, 689, 861);
    }

    const decorBottom = await loadImageAsBase64("/voucher/decor-bottom.png");
    if (decorBottom) {
      doc.addImage(decorBottom, "PNG", 268, 760, 540, 403);
    }

    const logo = await loadImageAsBase64("/voucher/logo.png");
    if (logo) {
      doc.addImage(logo, "PNG", 116, 62, 266, 236);
    }
  } catch (error) {
    console.error("Failed to load background images:", error);
  }

  // =========================================================================
  // MESSAGE BOX (white rounded rectangle)
  // =========================================================================
  doc.setFillColor(...COLORS.lightGray);
  doc.setDrawColor(...COLORS.borderGray);
  doc.setLineWidth(1);
  doc.roundedRect(670, 578, 1076, 519, 10, 10, "FD");


  // =========================================================================
  // TITLE - "You've Got Treatment Gift Voucher" (Gold text)
  // =========================================================================
  doc.setTextColor(...COLORS.gold);
  doc.setFontSize(70);
  doc.setFont("helvetica", "bold");
  doc.text("You've Got Treatment Gift Voucher", 724, 130);

  // =========================================================================
  // FORM LABELS ("For:", "Service:", "Valid:")
  // =========================================================================
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(62);
  doc.setFont("helvetica", "bold");
  
  doc.text("For :", 724, 240);
  doc.text("Service :", 724, 348);
  doc.text("Valid :", 724, 456);

  // =========================================================================
  // RECIPIENT BOXES (pill-shaped input fields)
  // =========================================================================
  const boxHeight = 93;
  const boxRadius = 47;
  const boxBorderWidth = 6;
  
  function drawPillBox(bx: number, by: number, width: number) {
    // Shadow
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(bx + 3, by + 7, width, boxHeight, boxRadius, boxRadius, "F");
    
    // White fill
    doc.setFillColor(...COLORS.white);
    doc.roundedRect(bx, by, width, boxHeight, boxRadius, boxRadius, "F");
    
    // Gold border
    doc.setDrawColor(...COLORS.goldBorder);
    doc.setLineWidth(boxBorderWidth);
    doc.roundedRect(bx, by, width, boxHeight, boxRadius, boxRadius, "S");
  }

  // For: input box
  drawPillBox(926, 181, 755);
  
  // Service: input box
  drawPillBox(926, 289, 755);
  
  // Valid: input box (left half)
  drawPillBox(926, 397, 347);
  
  // Code: input box (right half)
  drawPillBox(1284, 397, 397);


  // =========================================================================
  // FORM VALUES (inside pill boxes)
  // =========================================================================
  doc.setTextColor(...COLORS.brown);
  doc.setFontSize(30);
  doc.setFont("helvetica", "normal");
  
  // Recipient name
  doc.text(data.recipientName, 979, 238);
  
  // Service name
  doc.text(data.serviceName, 979, 346);
  
  // Valid date (centered)
  const validDate = formatDate(data.expiryDate);
  doc.text(validDate, 1098, 454, { align: "center" });
  
  // Voucher code (centered)
  doc.text(data.code, 1478, 454, { align: "center" });

  // =========================================================================
  // MESSAGE AREA (sender message in white box)
  // =========================================================================
  if (data.senderMessage) {
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(28);
    doc.setFont("helvetica", "italic");
    
    const maxWidth = 959;
    const messageLines = doc.splitTextToSize(data.senderMessage, maxWidth);
    const displayLines = messageLines.slice(0, 10);
    doc.text(displayLines, 737, 650);
  }

  // =========================================================================
  // FROM: SENDER INFO (bottom right of message box)
  // =========================================================================
  doc.setTextColor(...COLORS.black);
  doc.setFontSize(18);
  doc.setFont("helvetica", "italic");
  doc.text("from:", 1382, 1050);
  
  doc.setTextColor(...COLORS.darkTeal);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(data.senderName, 1449, 1050);


  // =========================================================================
  // QR CODE (bottom left)
  // =========================================================================
  const qrDataUrl = await QRCode.toDataURL(data.code, {
    width: 300,
    margin: 1,
    color: {
      dark: "#243a3e",
      light: "#ffffff",
    },
  });
  
  doc.addImage(qrDataUrl, "PNG", 23, 975, 187, 187);

  // =========================================================================
  // FOOTER - WhatsApp instruction
  // =========================================================================
  try {
    const ticketIcon = await loadImageAsBase64("/voucher/ticket-icon.png");
    if (ticketIcon) {
      doc.addImage(ticketIcon, "PNG", 1102, 1109, 28, 28);
    }
  } catch {
    // Skip icon if not available
  }
  
  doc.setTextColor(...COLORS.darkTeal);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bolditalic");
  doc.text("*show this voucher by messaging our admin 0851-1708-9696", 1140, 1127);

  return doc.output("blob");
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
