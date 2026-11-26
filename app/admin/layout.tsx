import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/icons/admin-favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/admin-favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/admin-favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/admin-favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
    ],
    shortcut: "/icons/admin-favicon.ico",
    apple: [
      { url: "/icons/admin-apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
