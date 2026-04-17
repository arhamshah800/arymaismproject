import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aryma ISM AI",
  description:
    "AI assistant for DFW small and medium food enterprises: chatbot, inventory guidance, review resolution, menu suggestions, and personality-based ordering support.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
