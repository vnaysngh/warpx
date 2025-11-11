import type { Metadata } from "next";
import { JetBrains_Mono as jetBrainsMono } from "next/font/google";
import "@warpx/theme/globals.css";

const terminal = jetBrainsMono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mochiy",
  display: "swap"
});

export const metadata: Metadata = {
  title: "WarpX — MegaETH v2 AMM",
  description:
    "Discover WarpX, the MegaETH-native AMM for swaps and liquidity. Learn how to provide liquidity and launch the dApp."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={terminal.variable}>
      <body>{children}</body>
    </html>
  );
}
