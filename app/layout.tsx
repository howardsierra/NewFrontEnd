import type { Metadata, Viewport } from "next";
import { DM_Sans, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const display = Manrope({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Flux.AI — Multi-Provider AI Workspace",
  description:
    "An attractive workspace for OpenRouter, Anthropic, OpenAI, Gemini, and custom OpenAI-compatible providers. Chat, attach files, generate images, and craft presets, personas, themes & regex.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0b10" },
    { media: "(prefers-color-scheme: light)", color: "#f8f7f4" },
  ],
  width: "device-width",
  initialScale: 1,
  // Lets the layout extend under the notch / home indicator; the composer pads
  // itself with env(safe-area-inset-bottom).
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
