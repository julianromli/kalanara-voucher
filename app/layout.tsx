import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Playfair_Display, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/context/StoreContext";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import Navbar from "@/components/navbar";
import Script from "next/script";

const inter = Inter({
  variable: "--font-inter",
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
    type: "website",
    locale: "id_ID",
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
    <html lang="id" className="scroll-smooth">
      <head>
        {/* put this in the <head> */}
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
        {/* rest of your scripts go under */}
      </head>
      <body
        className={`${inter.variable} ${playfair.variable} ${geistMono.variable} font-sans antialiased`}
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
