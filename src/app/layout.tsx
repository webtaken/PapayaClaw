import type { Metadata } from "next";
import { Syne, DM_Sans } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: "PapayaClaw — Deploy Secure OpenClaw Instances in a Few Minutes",
  description:
    "Deploy secure OpenClaw instances in a few minutes. Avoid all technical complexity and one-click deploy your own 24/7 active OpenClaw instance.",
  openGraph: {
    title: "PapayaClaw — Deploy Secure OpenClaw Instances",
    description: "Deploy secure OpenClaw instances in a few minutes. Avoid all technical complexity.",
    url: '/',
    siteName: 'PapayaClaw',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "PapayaClaw — Deploy Secure OpenClaw Instances",
    description: "Avoid all technical complexity and one-click deploy your own 24/7 active OpenClaw instance.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${syne.variable} ${dmSans.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
