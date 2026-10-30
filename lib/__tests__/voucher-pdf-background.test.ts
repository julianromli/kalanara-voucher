// @vitest-environment node
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "@/next.config";
import { generateVoucherPDF, VoucherPdfAssetError } from "@/lib/pdf";
import {
  VOUCHER_PDF_SERVER_ASSETS,
  VOUCHER_PDF_SERVER_ROUTES,
} from "@/lib/voucher-pdf-assets";

const SAMPLE_VOUCHER = {
  code: "KSP-2026-6MAA8G1W",
  serviceName: "Reflexology Hot Stone (90 menit)",
  recipientName: "Donna",
  senderName: "Faiz Intifada",
  senderMessage: "Selamat ya",
  expiryDate: "2027-01-28T00:00:00.000Z",
};

async function renderPdfSource(): Promise<string> {
  const blob = await generateVoucherPDF(SAMPLE_VOUCHER);
  return Buffer.from(await blob.arrayBuffer()).toString("latin1");
}

function findImageXObjects(pdfSource: string): Array<{ width: number; height: number }> {
  const images: Array<{ width: number; height: number }> = [];
  const objectPattern = /\d+ 0 obj\s*<<([\s\S]*?)>>\s*stream/g;

  for (const match of pdfSource.matchAll(objectPattern)) {
    const dictionary = match[1];
    if (!/\/Subtype\s*\/Image/.test(dictionary)) continue;

    const width = Number(/\/Width\s+(\d+)/.exec(dictionary)?.[1]);
    const height = Number(/\/Height\s+(\d+)/.exec(dictionary)?.[1]);
    images.push({ width, height });
  }

  return images;
}

function findRoutesThatRenderVoucherPdf(): string[] {
  const apiDir = path.join(process.cwd(), "app", "api");
  const routes: string[] = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (entry.name === "route.ts") {
        const source = fs.readFileSync(entryPath, "utf8");
        if (/from\s+["']@\/lib\/pdf["']/.test(source)) {
          const routeDir = path.relative(path.join(process.cwd(), "app"), dir);
          routes.push(`/${routeDir.split(path.sep).join("/")}`);
        }
      }
    }
  };

  walk(apiDir);
  return routes.sort();
}

describe("voucher PDF background", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("embeds the full-page background image as an image XObject", async () => {
    const images = findImageXObjects(await renderPdfSource());

    expect(images).toContainEqual({ width: 1772, height: 1181 });
  }, 30000);

  it("embeds the Plus Jakarta Sans fonts", async () => {
    const pdfSource = await renderPdfSource();

    expect(pdfSource).toMatch(/\/FontFile2/);
    expect(pdfSource).toMatch(/PlusJakartaSans/);
  }, 30000);

  it("throws instead of rendering a white voucher when the background is missing", async () => {
    const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "voucher-pdf-"));
    vi.spyOn(process, "cwd").mockReturnValue(emptyRoot);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(generateVoucherPDF(SAMPLE_VOUCHER)).rejects.toBeInstanceOf(
      VoucherPdfAssetError,
    );
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("/voucher/voucher-pdf-bg.webp"),
      expect.anything(),
    );
  });
});

describe("voucher PDF server asset tracing", () => {
  it("keeps every server asset in public/", () => {
    for (const assetPath of VOUCHER_PDF_SERVER_ASSETS) {
      expect(fs.existsSync(path.join(process.cwd(), "public", assetPath))).toBe(true);
    }
  });

  it("lists every API route that renders the voucher PDF", () => {
    expect([...VOUCHER_PDF_SERVER_ROUTES].sort()).toEqual(findRoutesThatRenderVoucherPdf());
  });

  it("traces the server assets into those routes", () => {
    const includes = nextConfig.outputFileTracingIncludes ?? {};

    for (const route of VOUCHER_PDF_SERVER_ROUTES) {
      expect(includes[route]).toEqual(
        VOUCHER_PDF_SERVER_ASSETS.map((assetPath) => `./public${assetPath}`),
      );
    }
  });
});
