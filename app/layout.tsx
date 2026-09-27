import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SPREEBnB — Somewhere you would rather be",
  description: "Discover distinctive homes, save your favorite escapes, and plan your next stay.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

