import type { Metadata } from "next";
import { Poppins, Mochiy_Pop_One } from "next/font/google";
import "@warpx/theme/globals.css";

// Primary font - Poppins (everything except brand name)
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins",
  display: "swap"
});

// Brand font - Mochiy Pop One (WARPX logo only)
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
    <html
      lang="en"
      className={`${poppins.variable} ${mochiyPopOne.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
