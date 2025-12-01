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
  title: "Kalanara Spa | Luxury Spa Vouchers in Bali",
  description:
    "Experience the art of relaxation at Kalanara Spa. Gift wellness and serenity with our exclusive spa vouchers. Traditional Balinese treatments in Ubud.",
  keywords: [
    "spa",
    "bali",
    "voucher",
    "gift",
    "massage",
    "wellness",
    "ubud",
    "relaxation",
  ],
  openGraph: {
    title: "Kalanara Spa | Harmony in Every Touch",
    description:
      "Gift the experience of luxury spa treatments. Traditional Balinese healing in a modern sanctuary.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
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
