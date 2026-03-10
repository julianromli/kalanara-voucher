import type { Metadata } from "next";
import { Suspense } from "react";
import { Outfit, Playfair_Display, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/context/StoreContext";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import Navbar from "@/components/navbar";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://voucher.kalanaraspa.com"),
  title: "Kalanara Spa Galaxy Bekasi | Voucher Spa Premium untuk Wanita",
  description:
    "Beli voucher spa premium di Kalanara Spa Galaxy, Bekasi. Hadiah spesial untuk diri sendiri atau orang tersayang. Terapis profesional, khusus wanita. Langsung dikirim via WhatsApp dan Email.",
  keywords: [
    "voucher spa bekasi",
    "gift card spa",
    "hadiah spa wanita",
    "voucher massage bekasi",
    "kalanara spa",
    "spa galaxy bekasi",
    "voucher treatment",
    "hadiah relaksasi",
    "spa khusus wanita",
    "voucher pijat bekasi",
  ],
  openGraph: {
    title: "Kalanara Spa Galaxy Bekasi | Voucher Spa Premium",
    description:
      "Hadiah spesial untuk me time. Voucher spa premium dari Kalanara Spa Galaxy, Bekasi. Khusus wanita, terapis profesional.",
    url: "https://voucher.kalanaraspa.com",
    siteName: "Kalanara Spa",
    type: "website",
    locale: "id_ID",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Voucher premium Kalanara Spa Galaxy Bekasi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kalanara Spa Galaxy Bekasi | Voucher Spa Premium",
    description:
      "Hadiah spesial untuk me time. Voucher spa premium dari Kalanara Spa Galaxy, Bekasi. Khusus wanita, terapis profesional.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  alternates: {
    canonical: "https://voucher.kalanaraspa.com",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="scroll-smooth" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${outfit.variable} ${playfair.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <AuthProvider>
          <StoreProvider>
            <ToastProvider>
              <Suspense fallback={null}>
                <Navbar />
              </Suspense>
              <main>{children}</main>
            </ToastProvider>
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
