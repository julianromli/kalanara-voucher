// Paths under `public/` that `lib/pdf.ts` reads with `fs` on the server.
// Vercel serves `public/` from its CDN and does not copy it into serverless
// functions, so `next.config.ts` adds these files to the trace of every route
// that renders the voucher PDF. Keep both lists in sync with `lib/pdf.ts`.
export const VOUCHER_PDF_BACKGROUND_PATH = "/voucher/voucher-pdf-bg.webp";

export const VOUCHER_PDF_FONT_PATHS = {
  regular: "/fonts/PlusJakartaSans-Regular.ttf",
  bold: "/fonts/PlusJakartaSans-Bold.ttf",
} as const;

export const VOUCHER_PDF_SERVER_ASSETS = [
  VOUCHER_PDF_BACKGROUND_PATH,
  ...Object.values(VOUCHER_PDF_FONT_PATHS),
];

export const VOUCHER_PDF_SERVER_ROUTES = [
  "/api/email/send-voucher",
  "/api/vouchers/pdf",
];
