import type { Metadata } from "next";
import { JetBrains_Mono as jetBrainsMono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ClientLayout } from "@/components/layout/ClientLayout";

const terminal = jetBrainsMono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-terminal",
  display: "swap"
});

export const metadata: Metadata = {
  title: "WarpX",
  description: "MegaETH v2 AMM desk for swaps and liquidity."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={terminal.variable}>
      <body>
        <Providers>
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  );
}
