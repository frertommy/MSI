import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MSI — Match Strength Index",
  description:
    "Proprietary Elo ratings for top European football clubs, computed from 3,500+ real match results.",
  openGraph: {
    title: "MSI — Match Strength Index",
    description:
      "Independent Elo ratings computed from real match data.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
