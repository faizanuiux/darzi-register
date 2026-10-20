import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Darzi Register — Admin",
  description: "Admin dashboard for Darzi Register license and device management.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 font-sans text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
