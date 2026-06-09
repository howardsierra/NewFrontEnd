import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NewFrontEnd — Multi-Provider AI Studio",
  description:
    "An attractive front end for OpenRouter, Anthropic, OpenAI, and custom OpenAI-compatible providers. Chat, attach files, craft presets.",
};

export const viewport: Viewport = {
  themeColor: "#0b0d12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
