import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeApplier } from "@/components/ThemeApplier";
import { DocumentTitleApplier } from "@/components/DocumentTitleApplier";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Frame",
  description: "Frame — open-source AI image generator. Local-first, fal.ai-powered.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body
        className="min-h-screen font-[family-name:var(--font-sans)]"
        style={{ fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif" }}
      >
        <ThemeApplier />
        <DocumentTitleApplier />
        {children}
      </body>
    </html>
  );
}
