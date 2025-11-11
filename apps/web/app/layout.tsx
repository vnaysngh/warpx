import type { Metadata } from "next";
import { Mochiy_Pop_One } from "next/font/google";
import "@warpx/theme/globals.css";
import { Providers } from "./providers";
import { ClientLayout } from "@/components/layout/ClientLayout";

const mochiyPopOne = Mochiy_Pop_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mochiy",
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
    <html
      lang="en"
      className={mochiyPopOne.variable}
      suppressHydrationWarning
    >
      <body>
        <Providers>
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  );
}
