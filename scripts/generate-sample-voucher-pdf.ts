// Generates a sample voucher PDF with the server code path (fs reads from public/).
// Usage: bun scripts/generate-sample-voucher-pdf.ts [output.pdf]
import fs from "fs";
import { generateVoucherPDF } from "@/lib/pdf";

const outputPath = process.argv[2] ?? "sample-voucher.pdf";

const blob = await generateVoucherPDF({
  code: "KSP-2026-6MAA8G1W",
  serviceName: "Reflexology Hot Stone (90 menit)",
  recipientName: "Donna",
  senderName: "Faiz Intifada",
  senderMessage: "Selamat ya",
  expiryDate: "2027-01-28T00:00:00.000Z",
});

fs.writeFileSync(outputPath, Buffer.from(await blob.arrayBuffer()));
console.log(`Wrote ${outputPath}`);
