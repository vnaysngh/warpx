import type { Metadata } from "next";
import { Work_Sans, Mochiy_Pop_One } from "next/font/google";
import "@warpx/theme/globals.css";
import { Providers } from "./providers";
import { ClientLayout } from "@/components/layout/ClientLayout";

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-work-sans",
  display: "swap"
});

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
      className={`${workSans.variable} ${mochiyPopOne.variable}`}
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
