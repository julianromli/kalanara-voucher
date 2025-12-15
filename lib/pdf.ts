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

// Page dimensions from Figma
const PAGE_WIDTH = 1772;
const PAGE_HEIGHT = 1181;

// Helper to convert ArrayBuffer to Base64 (Isomorphic)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof window !== "undefined") {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  } else {
    return Buffer.from(buffer).toString("base64");
  }
}

// Load and convert image to base64
async function loadImageAsBase64(imagePath: string): Promise<string> {
  try {
    if (typeof window !== "undefined") {
      // Client-side: Use fetch and FileReader
      const response = await fetch(imagePath);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      // Server-side: Use fs to read from public directory
      const fs = await import("fs");
      const path = await import("path");

      // Remove leading slash if present to join correctly
      const relativePath = imagePath.startsWith("/") ? imagePath.slice(1) : imagePath;
      const filePath = path.join(process.cwd(), "public", relativePath);

      const buffer = await fs.promises.readFile(filePath);
      const base64 = buffer.toString("base64");

      const ext = path.extname(filePath).toLowerCase();
      let mimeType = "image/png";
      if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
      if (ext === ".webp") mimeType = "image/webp";
      if (ext === ".svg") mimeType = "image/svg+xml";

      return `data:${mimeType};base64,${base64}`;
    }
  } catch (error) {
    console.error(`Failed to load image ${imagePath}:`, error);
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

// Font configuration for jsPDF
interface FontConfig {
  fileName: string;        // The filename to register with VFS
  fontName: string;        // Font family name 
  fontStyle: string;       // 'normal', 'bold', 'italic', 'bolditalic'
  localPath: string;       // Path in public folder
}

async function loadFontFile(localPath: string): Promise<string | null> {
  try {
    if (typeof window !== "undefined") {
      // Client-side: use fetch  
      const response = await fetch(localPath);
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();
      return arrayBufferToBase64(buffer);
    } else {
      // Server-side: use fs
      const fs = await import("fs");
      const path = await import("path");
      const relativePath = localPath.startsWith("/") ? localPath.slice(1) : localPath;
      const fullPath = path.join(process.cwd(), "public", relativePath);

      if (!fs.existsSync(fullPath)) {
        console.warn(`Font file not found: ${fullPath}`);
        return null;
      }

      const buffer = await fs.promises.readFile(fullPath);
      return buffer.toString("base64");
    }
  } catch (error) {
    console.warn(`Failed to load font from ${localPath}:`, error);
    return null;
  }
}

export async function generateVoucherPDF(data: VoucherPDFData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [PAGE_WIDTH, PAGE_HEIGHT],
  });

  // Use jsPDF built-in fonts for server-side reliability
  // helvetica for sans-serif, times for serif
  // Custom Google Fonts (Plus Jakarta Sans, Playfair Display) would require special processing 
  // to work with jsPDF in a server environment, so we use built-in fonts as a reliable fallback.

  // Helper function to set font with proper style
  const setFont = (fontFamily: "primary" | "serif", style: "normal" | "bold") => {
    try {
      if (fontFamily === "primary") {
        doc.setFont("helvetica", style);
      } else if (fontFamily === "serif") {
        doc.setFont("times", style);
      }
    } catch (e) {
      // Ultimate fallback
      doc.setFont("helvetica", "normal");
    }
  };


  // =========================================================================
  // BACKGROUND LAYER
  // =========================================================================
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");

  // Load background image
  try {
    const bgImage = await loadImageAsBase64("/voucher/voucher-pdf-bg.webp");
    if (bgImage) {
      doc.addImage(bgImage, "WEBP", 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    }
  } catch (error) {
    console.error("Failed to load background image:", error);
  }

  // =========================================================================
  // LOGO (Top Left)
  // =========================================================================
  // Figma: x=116, y=62, w=266, h=236
  try {
    const logo = await loadImageAsBase64("/voucher/logo.png");
    if (logo) {
      doc.addImage(logo, "PNG", 116, 62, 266, 236);
    }
  } catch (e) {
    // ignore
  }

  // =========================================================================
  // MESSAGE BOX (Bottom Right area)
  // =========================================================================
  // Figma: x=670, y=578, w=1076, h=519, Radius=10
  // Color: #fbfbfb (lightGray), Border: #dbdbdb (borderGray)
  doc.setFillColor(...COLORS.lightGray);
  doc.setDrawColor(...COLORS.borderGray);
  doc.setLineWidth(1);
  doc.roundedRect(670, 578, 1076, 519, 10, 10, "FD");

  // =========================================================================
  // TITLE (REMOVED)
  // =========================================================================
  // Title text removed per user request

  // =========================================================================
  // LABELS & INPUTS
  // =========================================================================

  // Helper for Pill Boxes
  const boxHeight = 93;
  const boxRadius = 47; // Fully rounded
  const boxBorderWidth = 6;

  function drawPillBox(bx: number, by: number, width: number) {
    // Shadow (approximate from design if any, or just solid colors)
    // Design shows: Fill White, Border Gold.
    // Previous code had a shadow. Figma metadata shows just "Rectangle".
    // We'll stick to simple flat or match previous shadow if it looked good.
    // Let's do simple flat to match "modern" clean look unless specified.

    // White fill
    doc.setFillColor(...COLORS.white);
    doc.roundedRect(bx, by, width, boxHeight, boxRadius, boxRadius, "F");

    // Gold border
    doc.setDrawColor(...COLORS.goldBorder);
    doc.setLineWidth(boxBorderWidth);
    doc.roundedRect(bx, by, width, boxHeight, boxRadius, boxRadius, "S");
  }

  // Label Style
  doc.setTextColor(...COLORS.white);
  setFont("primary", "bold");
  doc.setFontSize(60); // Figma metadata doesn't give font size directly but text element height is 82. 60 seems appropriate.

  // --- Row 1: Recipient ---
  // Label removed per user request

  // Input Box
  // Figma: x=926, y=181
  drawPillBox(926, 181, 755);

  // Value: Recipient Name 
  // Figma: x=979, y=208 (Text start)
  doc.setTextColor(...COLORS.brown); // #8e734a
  setFont("primary", "normal");
  doc.setFontSize(35);
  doc.text(data.recipientName, 979, 181 + (boxHeight / 2) + 12); // Vertically centered

  // --- Row 2: Service ---
  // Label removed per user request

  // Input Box
  // Figma: x=926, y=289
  drawPillBox(926, 289, 755);

  // Value: Service Name
  // Figma: x=979, y=312
  doc.setTextColor(...COLORS.brown);
  setFont("primary", "normal");
  doc.setFontSize(35);
  doc.text(data.serviceName, 979, 289 + (boxHeight / 2) + 12);

  // --- Row 3: Valid & Code ---
  // Label removed per user request

  // Valid Box (Left)
  // Figma: x=926, y=397, w=347
  drawPillBox(926, 397, 347);

  // Value: Date
  // Centered in box
  doc.setTextColor(...COLORS.brown);
  setFont("primary", "normal");
  doc.setFontSize(30);
  const validDate = formatDate(data.expiryDate);
  doc.text(validDate, 926 + (347 / 2), 397 + (boxHeight / 2) + 10, { align: "center" });

  // Code Box (Right)
  // Figma: x=1284, y=397, w=397 (approx 1284+397 = 1681? check width)
  // Metadata: w=396.699 -> 397.
  drawPillBox(1284, 397, 397);

  // Value: Code
  // Centered in box
  doc.text(data.code, 1284 + (397 / 2), 397 + (boxHeight / 2) + 10, { align: "center" });


  // =========================================================================
  // MESSAGE TEXT
  // =========================================================================
  // Inside the big message box (x=670, y=578)
  if (data.senderMessage) {
    doc.setTextColor(...COLORS.black);
    setFont("primary", "normal"); // Or italic?
    doc.setFontSize(28);

    // Padding from box edges
    const msgX = 670 + 40;
    const msgY = 578 + 40;
    const msgWidth = 1076 - 80;

    const messageLines = doc.splitTextToSize(data.senderMessage, msgWidth);
    // Limit lines?
    doc.text(messageLines, msgX, msgY + 28);
  }

  // =========================================================================
  // SENDER INFO
  // =========================================================================
  // "from: [Sender Name]"
  // Figma "Footer" x=1102 y=1109 seems to be something else (ticket icon?).
  // Previous code had: x=1449, y=1050 inside the box.
  // We'll place it bottom-right of the Message Box.
  // Message Box bottom is 578 + 519 = 1097.
  const signatureY = 1060;
  const signatureX = 1680; // Right aligned

  doc.setFontSize(24);
  setFont("primary", "normal"); // italic?
  doc.setTextColor(...COLORS.black);
  doc.text("from:", signatureX - 20, signatureY, { align: "right" });

  setFont("primary", "bold");
  doc.setTextColor(...COLORS.darkTeal);
  doc.text(data.senderName, signatureX, signatureY, { align: "left" });


  // =========================================================================
  // QR CODE
  // =========================================================================
  // Previous: x=23, y=975, w=187.
  // If design doesn't specify, we keep it or check available space.
  // Bottom left seems empty in the overlay description.
  const qrDataUrl = await QRCode.toDataURL(data.code, {
    width: 300,
    margin: 1,
    color: {
      dark: "#243a3e",
      light: "#ffffff",
    },
  });
  doc.addImage(qrDataUrl, "PNG", 50, 950, 180, 180);

  // =========================================================================
  // FOOTER / CONTACT INFO (REMOVED)
  // =========================================================================
  // Footer text and ticket icon removed per user request


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
