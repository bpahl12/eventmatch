import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import Toasts from "@/components/Toasts";

const cormorant = Cormorant_Garamond({
  variable: "--font-display",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-sans",
  weight: ["200", "300", "400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Access Collective",
  description: "A curated network, by invitation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black text-white">
        {children}
        <Toasts />
      </body>
    </html>
  );
}
