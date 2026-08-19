import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "Kranjang",
  description: "Landing marketing Kranjang untuk pemilik warung dan rumah makan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${inter.variable} ${spaceGrotesk.variable} bg-white text-[#212121] antialiased`}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
