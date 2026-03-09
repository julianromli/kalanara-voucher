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

interface TextMeasurer {
  getTextWidth(text: string): number;
  splitTextToSize(text: string, maxWidth: number): string[];
}

interface FontConfig {
  fileName: string;
  fontName: string;
  fontStyle: "normal" | "bold";
  localPath: string;
}

interface RegisteredFonts {
  primary: {
    normal: boolean;
    bold: boolean;
  };
  serif: {
    normal: boolean;
    bold: boolean;
  };
}

interface BoxTextOptions {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  paddingX: number;
  fontSize: number;
  minFontSize: number;
  maxLines: number;
  color: [number, number, number];
}

interface InlineTextOptions {
  text: string;
  maxWidth: number;
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
const BOX_TEXT_BASELINE_OFFSET_RATIO = 0.34;

const FONT_CONFIGS: Record<"primary" | "serif", FontConfig[]> = {
  primary: [
    {
      fileName: "PlusJakartaSans-Regular.ttf",
      fontName: "PlusJakartaSans",
      fontStyle: "normal",
      localPath: "/fonts/PlusJakartaSans-Regular.ttf",
    },
    {
      fileName: "PlusJakartaSans-Bold.ttf",
      fontName: "PlusJakartaSans",
      fontStyle: "bold",
      localPath: "/fonts/PlusJakartaSans-Bold.ttf",
    },
  ],
  serif: [],
};

// jsPDF expects custom fonts as binary strings inside its virtual file system.
function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
  if (typeof window !== "undefined") {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return binary;
  } else {
    return Buffer.from(buffer).toString("latin1");
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

async function loadFontFile(localPath: string): Promise<string | null> {
  try {
    if (typeof window !== "undefined") {
      // Client-side: use fetch  
      const response = await fetch(localPath);
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();
      return arrayBufferToBinaryString(buffer);
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
      return buffer.toString("latin1");
    }
  } catch (error) {
    console.warn(`Failed to load font from ${localPath}:`, error);
    return null;
  }
}

export function wrapTextToLines(
  measurer: TextMeasurer,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const normalizedText = text.trim().replace(/\s+/g, " ");
  if (!normalizedText) return [];

  const lines = measurer
    .splitTextToSize(normalizedText, maxWidth)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= maxLines) {
    return lines;
  }

  const truncatedLines = lines.slice(0, maxLines);
  const ellipsis = "...";
  let lastLine = truncatedLines[maxLines - 1] ?? "";

  while (lastLine && measurer.getTextWidth(`${lastLine}${ellipsis}`) > maxWidth) {
    lastLine = lastLine.slice(0, -1).trimEnd();
  }

  truncatedLines[maxLines - 1] = lastLine ? `${lastLine}${ellipsis}` : ellipsis;
  return truncatedLines;
}

async function registerCustomFonts(doc: jsPDF): Promise<RegisteredFonts> {
  const registeredFonts: RegisteredFonts = {
    primary: { normal: false, bold: false },
    serif: { normal: false, bold: false },
  };

  for (const [family, configs] of Object.entries(FONT_CONFIGS) as Array<[
    keyof typeof FONT_CONFIGS,
    FontConfig[],
  ]>) {
    for (const config of configs) {
      const fontBase64 = await loadFontFile(config.localPath);
      if (!fontBase64) continue;

      try {
        doc.addFileToVFS(config.fileName, fontBase64);
        doc.addFont(config.fileName, config.fontName, config.fontStyle);
        registeredFonts[family][config.fontStyle] = true;
      } catch (error) {
        console.warn(`Failed to register PDF font ${config.fontName} (${config.fontStyle})`, error);
      }
    }
  }

  return registeredFonts;
}

function drawTextInBox(
  doc: jsPDF,
  options: BoxTextOptions,
): void {
  const normalizedText = options.text.trim().replace(/\s+/g, " ");
  if (!normalizedText) return;

  for (let fontSize = options.fontSize; fontSize >= options.minFontSize; fontSize -= 1) {
    doc.setFontSize(fontSize);

    const lineHeight = Math.round(fontSize * 1.2);
    const availableWidth = Math.max(options.width - options.paddingX * 2, 1);
    const lines = wrapTextToLines(doc, normalizedText, availableWidth, options.maxLines);
    const totalHeight = fontSize + lineHeight * Math.max(lines.length - 1, 0);
    const availableHeight = options.height - 24;

    if (totalHeight > availableHeight && fontSize > options.minFontSize) {
      continue;
    }

    const firstLineBaseline =
      options.y +
      (options.height / 2) -
      (lineHeight * Math.max(lines.length - 1, 0)) / 2 +
      fontSize * BOX_TEXT_BASELINE_OFFSET_RATIO;

    doc.setTextColor(...options.color);
    doc.text(lines, options.x + options.paddingX, firstLineBaseline, {
      baseline: "alphabetic",
      lineHeightFactor: 1.2,
    });
    return;
  }
}

function fitInlineText(
  doc: jsPDF,
  options: InlineTextOptions,
): { text: string; width: number } {
  const normalizedText = options.text.trim().replace(/\s+/g, " ");
  if (!normalizedText) {
    return { text: "", width: 0 };
  }

  if (doc.getTextWidth(normalizedText) <= options.maxWidth) {
    return { text: normalizedText, width: doc.getTextWidth(normalizedText) };
  }

  let truncated = normalizedText;
  const ellipsis = "...";

  while (truncated && doc.getTextWidth(`${truncated}${ellipsis}`) > options.maxWidth) {
    truncated = truncated.slice(0, -1).trimEnd();
  }

  const text = truncated ? `${truncated}${ellipsis}` : ellipsis;
  return { text, width: doc.getTextWidth(text) };
}

export async function generateVoucherPDF(data: VoucherPDFData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [PAGE_WIDTH, PAGE_HEIGHT],
  });

  const registeredFonts = await registerCustomFonts(doc);

  // Helper function to set font with proper style
  const setFont = (fontFamily: "primary" | "serif", style: "normal" | "bold") => {
    try {
      if (registeredFonts[fontFamily][style]) {
        const config = FONT_CONFIGS[fontFamily].find((font) => font.fontStyle === style);
        if (config) {
          doc.setFont(config.fontName, style);
          return;
        }
      }

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
  setFont("primary", "normal");
  drawTextInBox(doc, {
    text: data.recipientName,
    x: 926,
    y: 181,
    width: 755,
    height: boxHeight,
    paddingX: 53,
    fontSize: 35,
    minFontSize: 24,
    maxLines: 2,
    color: COLORS.brown,
  });

  // --- Row 2: Service ---
  // Label removed per user request

  // Input Box
  // Figma: x=926, y=289
  drawPillBox(926, 289, 755);

  // Value: Service Name
  // Figma: x=979, y=312
  setFont("primary", "normal");
  drawTextInBox(doc, {
    text: data.serviceName,
    x: 926,
    y: 289,
    width: 755,
    height: boxHeight,
    paddingX: 53,
    fontSize: 35,
    minFontSize: 24,
    maxLines: 2,
    color: COLORS.brown,
  });

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

    const lineHeight = Math.round(28 * 1.35);
    const maxLines = Math.max(Math.floor((519 - 80) / lineHeight), 1);
    const messageLines = wrapTextToLines(doc, data.senderMessage, msgWidth, maxLines);
    doc.text(messageLines, msgX, msgY + 28, {
      lineHeightFactor: 1.35,
    });
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
  const messageBoxRight = 670 + 1076;
  const signatureRight = messageBoxRight - 48;
  const signatureGap = 20;

  doc.setFontSize(24);
  setFont("primary", "bold");
  const sender = fitInlineText(doc, {
    text: data.senderName,
    maxWidth: 240,
  });

  setFont("primary", "normal");
  const fromLabel = fitInlineText(doc, {
    text: "from:",
    maxWidth: 80,
  });

  const labelRight = signatureRight - sender.width - signatureGap;

  doc.setTextColor(...COLORS.black);
  doc.text(fromLabel.text, labelRight, signatureY, { align: "right" });

  setFont("primary", "bold");
  doc.setTextColor(...COLORS.darkTeal);
  doc.text(sender.text, signatureRight, signatureY, { align: "right" });


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
