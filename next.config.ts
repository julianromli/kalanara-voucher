import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import {
  VOUCHER_PDF_SERVER_ASSETS,
  VOUCHER_PDF_SERVER_ROUTES,
} from "./lib/voucher-pdf-assets";

const voucherPdfTraceFiles = VOUCHER_PDF_SERVER_ASSETS.map(
  (assetPath) => `./public${assetPath}`
);

const nextConfig: NextConfig = {
  cacheComponents: true,
  outputFileTracingIncludes: Object.fromEntries(
    VOUCHER_PDF_SERVER_ROUTES.map((route) => [route, voucherPdfTraceFiles])
  ),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kginxwtmcdvqbnwmlctw.supabase.co",
        pathname: "/storage/v1/object/**",
      },
      {
        protocol: "https",
        hostname: "**.ufs.sh",
        pathname: "/f/**",
      },
      {
        protocol: "https",
        hostname: "utfs.io",
        pathname: "/f/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  telemetry: false,
});
