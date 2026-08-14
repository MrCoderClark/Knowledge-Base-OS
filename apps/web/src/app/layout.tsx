import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KnowledgeOS — Enterprise Hub",
  description:
    "Enterprise knowledge base for documents, videos, and training.",
};

// Nonce-based CSP requires per-request rendering (see src/proxy.ts): a
// statically-rendered page would have no nonce and its scripts would be blocked.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
