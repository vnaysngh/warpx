import type { Metadata } from "next";
import { JetBrains_Mono as jetBrainsMono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const terminal = jetBrainsMono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-terminal",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MegaSwap Terminal",
  description: "Modern MegaETH v2 AMM desk for swaps and liquidity.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={terminal.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
