import type { Metadata } from "next";
import { Mochiy_Pop_One } from "next/font/google";
import "@warpx/theme/globals.css";

const mochiyPopOne = Mochiy_Pop_One({
  subsets: ["latin"],
  weight: ["400"],
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
    <html lang="en" className={mochiyPopOne.variable}>
      <body>{children}</body>
    </html>
  );
}
